#!/bin/bash
set -e

# ============================================================
# 第二个项目 - 腾讯云服务器部署脚本
# 用法: sudo bash deploy-remote.sh
# 注意: 需要先部署好项目1（安全隐患复核系统）
# ============================================================

# ============================================================
# !! 必须修改的配置 !!
PROJECT_NAME="project2"                          # 项目短名，用于容器命名
PROJECT_DIR="/opt/project2"                      # 部署目录
GITHUB_REPO="https://github.com/your-org/project2.git"  # 替换为你的仓库
SERVER_IP="43.133.14.168"                        # 服务器IP
SERVER_PORT=81                                   # 对外暴露端口（项目1用80，项目2用81）
FRONTEND_CONTAINER_PORT=8180                     # 前端容器映射端口
BACKEND_CONTAINER_PORT=8100                      # 后端容器映射端口
DB_NAME="project2_db"                           # 数据库名
# ============================================================

echo "=========================================="
echo "  $PROJECT_NAME - 部署"
echo "=========================================="

if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] 请使用 sudo 运行此脚本"
    exit 1
fi

# 1. 安装依赖（如已安装则跳过）
echo "[1/7] 检查依赖..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ${SUDO_USER:-root}
    systemctl enable docker
    systemctl start docker
fi

if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
fi

dc() { docker compose "$@"; }

# 2. 克隆/更新代码
echo "[2/7] 获取代码..."
if [ -d "$PROJECT_DIR/.git" ]; then
    echo "  代码已存在，执行更新..."
    cd "$PROJECT_DIR"
    git pull
else
    echo "  克隆代码..."
    git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# 3. 配置环境变量
echo "[3/7] 配置环境变量..."
ENV_FILE="/etc/${PROJECT_NAME}.env"

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
POSTGRES_DB=$DB_NAME
ALLOWED_ORIGINS=http://$SERVER_IP:$SERVER_PORT
EOF

# 4. 启动 Docker 服务
echo "[4/7] 构建并启动 Docker 服务..."
cd "$PROJECT_DIR"
set -a
source "$ENV_FILE"
set +a

dc -f docker-compose.prod.yml up -d --build

# 等待数据库就绪
echo "  等待数据库就绪..."
sleep 5
until docker exec ${PROJECT_NAME}-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "    等待 postgres..."
    sleep 2
done

# 5. 数据库迁移和初始化
echo "[5/7] 运行数据库迁移..."
TABLES_EXIST=$(docker exec ${PROJECT_NAME}-postgres psql -U postgres -d $DB_NAME -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='alembic_version';" 2>/dev/null || echo "0")

if [ "$TABLES_EXIST" = "0" ] || [ "$TABLES_EXIST" = "" ]; then
    echo "  首次部署：通过 SQLAlchemy 创建所有表..."
    docker exec ${PROJECT_NAME}-backend python -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine, Base
import app.models

async def create_all():
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto'))
        await conn.run_sync(Base.metadata.create_all)
    print('  所有表创建成功')

asyncio.run(create_all())
"
    echo "  标记 alembic 迁移状态为最新..."
    docker exec ${PROJECT_NAME}-backend alembic stamp head
else
    echo "  已有数据库，运行增量迁移..."
    docker exec ${PROJECT_NAME}-backend alembic upgrade head
fi

docker exec ${PROJECT_NAME}-backend python scripts/seed_admin.py || echo "  警告：seed_admin 失败，可能需要手动初始化"

# 6. 配置 Nginx
echo "[6/7] 配置 Nginx..."

# 生成 nginx 配置（不覆盖其他项目的配置）
cat > /etc/nginx/sites-available/${PROJECT_NAME} << NGINXEOF
server {
    listen $SERVER_PORT;
    server_name $SERVER_IP;

    location / {
        proxy_pass http://localhost:$FRONTEND_CONTAINER_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://localhost:$BACKEND_CONTAINER_PORT/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50M;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://localhost:$BACKEND_CONTAINER_PORT/health;
        access_log off;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
# 注意: 不要 rm default 或其他项目的配置！

nginx -t && systemctl reload nginx

# 7. 健康检查
echo "[7/7] 健康检查..."
sleep 2
curl -sf http://localhost:$SERVER_PORT/health > /dev/null 2>&1 \
    && echo "  Frontend: OK" || echo "  Frontend: FAIL（前端容器可能还在启动）"
curl -sf http://localhost:$BACKEND_CONTAINER_PORT/health > /dev/null 2>&1 \
    && echo "  Backend:  OK" || echo "  Backend:  FAIL"

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo "访问地址: http://$SERVER_IP:$SERVER_PORT"
echo ""
echo "注意: 请确保腾讯云安全组已开放端口 $SERVER_PORT (TCP)"
echo "环境变量已保存到: $ENV_FILE"
echo ""
echo "日常运维命令:"
echo "  cd $PROJECT_DIR"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  docker compose -f docker-compose.prod.yml logs -f backend"
