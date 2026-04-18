#!/bin/bash
set -e

# 安全生产隐患复核系统 - 服务器初始化脚本
# 在腾讯云服务器上运行此脚本完成全部部署
# 用法: sudo ./setup-server.sh

echo "=========================================="
echo "  Safety Hazard Review System - Setup"
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
apt install -y curl wget git nginx certbot python3-certbot-nginx

# 3. 安装 Docker
echo "[3/8] 安装 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $SUDO_USER
    systemctl enable docker
    systemctl start docker
fi

# 安装 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt install -y docker-compose-plugin
fi

echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker compose version)"

# 4. 克隆代码
echo "[4/8] 克隆代码..."
PROJECT_DIR="/opt/safety-hazard-review-system"
if [ -d "$PROJECT_DIR" ]; then
    echo "  目录已存在，执行 git pull..."
    cd "$PROJECT_DIR"
    git pull
else
    git clone https://github.com/yinchengchen-AI/safety-hazard-review-system.git "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# 5. 配置环境变量
echo "[5/8] 配置环境变量..."
export SECRET_KEY=${SECRET_KEY:-$(openssl rand -hex 32)}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}
export MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-$(openssl rand -hex 16)}

# 保存到环境文件
cat > /etc/safety-hazard.env << EOF
SECRET_KEY=$SECRET_KEY
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
ALLOWED_ORIGINS=http://43.133.14.168
EOF

echo "  SECRET_KEY: ${SECRET_KEY:0:8}..."
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:8}..."
echo "  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:0:8}..."

# 6. 启动服务
echo "[6/8] 启动 Docker 服务..."
source /etc/safety-hazard.env
docker-compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d --build

# 等待数据库就绪
echo "  等待数据库..."
sleep 5
until docker exec safety-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "    等待 postgres..."
    sleep 2
done

# 7. 运行数据库迁移
echo "[7/8] 运行数据库迁移..."
docker exec safety-backend alembic upgrade head

# 初始化管理员
echo "  初始化管理员账号..."
docker exec safety-backend python scripts/seed_admin.py

# 8. 配置 Nginx
echo "[8/8] 配置 Nginx..."
cp nginx.conf /etc/nginx/sites-available/safety-hazard
ln -sf /etc/nginx/sites-available/safety-hazard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 修改 Nginx 配置中的 server_name
sed -i "s/server_name _;/server_name 43.133.14.168;/" /etc/nginx/sites-available/safety-hazard

nginx -t && systemctl restart nginx
systemctl enable nginx

# 健康检查
echo ""
echo "=========================================="
echo "  健康检查"
echo "=========================================="
sleep 2

curl -sf http://localhost/health > /dev/null 2>&1 && echo "  Frontend: OK" || echo "  Frontend: FAIL"
curl -sf http://localhost:8000/health > /dev/null 2>&1 && echo "  Backend:  OK" || echo "  Backend:  FAIL"
curl -sf http://localhost:8000/docs > /dev/null 2>&1 && echo "  API Docs: OK" || echo "  API Docs: FAIL"

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo "访问地址:"
echo "  前端: http://43.133.14.168"
echo "  API:  http://43.133.14.168:8000"
echo "  文档: http://43.133.14.168:8000/docs"
echo ""
echo "管理员账号:"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "[重要] 请立即登录并修改管理员密码!"
echo ""
echo "环境变量已保存到: /etc/safety-hazard.env"
echo "请妥善保管此文件!"
