#!/bin/bash
set -e

# ============================================================
# 安全生产隐患复核系统 - 腾讯云服务器一键部署脚本
# 用法: sudo bash deploy-remote.sh
# ============================================================

PROJECT_DIR="/opt/safety-hazard-review-system"
GITHUB_REPO="https://github.com/yinchengchen-AI/safety-hazard-review-system.git"
SERVER_IP="43.133.14.168"

echo "=========================================="
echo "  Safety Hazard Review System - Deploy"
echo "=========================================="

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] 请使用 sudo 运行此脚本"
    exit 1
fi

# 1. 更新系统
echo "[1/8] 更新系统..."
apt update && apt upgrade -y

# 2. 安装基础工具
echo "[2/8] 安装基础工具..."
apt install -y curl wget git nginx

# 3. 安装 Docker
echo "[3/8] 安装 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ${SUDO_USER:-root}
    systemctl enable docker
    systemctl start docker
fi

# 安装 Docker Compose plugin（现代方式）
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
fi

# 定义统一的 compose 调用函数
dc() { docker compose "$@"; }

echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker compose version 2>/dev/null || echo '未安装')"

# 4. 克隆/更新代码
echo "[4/8] 获取代码..."
if [ -d "$PROJECT_DIR/.git" ]; then
    echo "  代码已存在，执行更新..."
    cd "$PROJECT_DIR"
    git pull
else
    echo "  克隆代码..."
    git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# 5. 配置环境变量
echo "[5/8] 配置环境变量..."
ENV_FILE="/etc/safety-hazard.env"

# 先加载已有的环境变量（保留旧密码，防止 postgres 数据卷认证失败）
if [ -f "$ENV_FILE" ]; then
    echo "  加载已有环境变量..."
    set -a
    source "$ENV_FILE"
    set +a
fi

export SECRET_KEY=${SECRET_KEY:-$(openssl rand -hex 32)}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}
export MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-$(openssl rand -hex 16)}

cat > "$ENV_FILE" << EOF
SECRET_KEY=$SECRET_KEY
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
ALLOWED_ORIGINS=http://$SERVER_IP
EOF

echo "  SECRET_KEY: ${SECRET_KEY:0:8}..."
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:8}..."
echo "  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:0:8}..."

# 6. 启动 Docker 服务
echo "[6/8] 构建并启动 Docker 服务..."
cd "$PROJECT_DIR"
set -a
source "$ENV_FILE"
set +a

# 使用生产配置启动
dc -f docker-compose.prod.yml up -d --build

# 等待数据库就绪
echo "  等待数据库就绪..."
sleep 5
until docker exec safety-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "    等待 postgres..."
    sleep 2
done

# 7. 数据库迁移和初始化
echo "[7/8] 运行数据库迁移..."
# 检查 alembic_version 表是否存在（判断是否首次部署）
TABLES_EXIST=$(docker exec safety-postgres psql -U postgres -d safety_hazard -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='alembic_version';" 2>/dev/null || echo "0")

if [ "$TABLES_EXIST" = "0" ] || [ "$TABLES_EXIST" = "" ]; then
    echo "  首次部署：通过 SQLAlchemy 创建所有表..."
    docker exec safety-backend python -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine, Base
import app.models  # 确保所有模型已注册

async def create_all():
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto'))
        await conn.run_sync(Base.metadata.create_all)
    print('  所有表创建成功')

asyncio.run(create_all())
"
    echo "  标记 alembic 迁移状态为最新..."
    docker exec safety-backend alembic stamp head
else
    echo "  已有数据库，运行增量迁移..."
    docker exec safety-backend alembic upgrade head
fi

echo "  初始化管理员账号..."
docker exec safety-backend python scripts/seed_admin.py || echo "  警告：seed_admin 失败，可能需要手动初始化"

# 8. 配置 Nginx
echo "[8/8] 配置 Nginx..."

# 内联生成 nginx 配置（项目1固定使用端口80，不影响其他项目的配置）
cat > /etc/nginx/sites-available/safety-hazard << 'NGINXEOF'
server {
    listen 80;
    server_name SERVER_IP_PLACEHOLDER;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }
}
NGINXEOF

# 替换服务器IP占位符
sed -i "s/SERVER_IP_PLACEHOLDER/$SERVER_IP/" /etc/nginx/sites-available/safety-hazard

ln -sf /etc/nginx/sites-available/safety-hazard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
# 注意: 不删除其他项目的 sites-enabled 配置（如 project2 等）

nginx -t && systemctl reload nginx
systemctl enable nginx

# 健康检查
echo ""
echo "=========================================="
echo "  健康检查"
echo "=========================================="
sleep 2

curl -sf http://localhost/health > /dev/null 2>&1 && echo "  Frontend: OK" || echo "  Frontend: FAIL"
curl -sf http://localhost:8000/health > /dev/null 2>&1 && echo "  Backend:  OK" || echo "  Backend:  FAIL"

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo "访问地址:"
echo "  前端: http://$SERVER_IP"
echo "  API文档: http://$SERVER_IP:8000/docs"
echo ""
echo "管理员账号:"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "[重要] 请立即登录并修改管理员密码!"
echo ""
echo "环境变量已保存到: $ENV_FILE"
echo "日常运维命令:"
echo "  cd $PROJECT_DIR"
echo "  docker compose -f docker-compose.prod.yml ps    # 查看状态"
echo "  docker compose -f docker-compose.prod.yml logs -f backend  # 查看日志"
