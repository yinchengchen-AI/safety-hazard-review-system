#!/bin/bash
set -e

# 安全生产隐患复核系统 - 生产环境部署脚本
# 用法: ./deploy.sh

echo "=========================================="
echo "  Safety Hazard Review System - Deploy"
echo "=========================================="

# 检查环境
if [ -z "$SECRET_KEY" ]; then
    echo "[WARN] SECRET_KEY not set, generating one..."
    export SECRET_KEY=$(openssl rand -hex 32)
    echo "SECRET_KEY=$SECRET_KEY"
    echo "[WARN] Please save this SECRET_KEY to your environment!"
fi

# 检查 Docker
docker --version >/dev/null 2>&1 || { echo "[ERROR] Docker not installed"; exit 1; }
docker-compose --version >/dev/null 2>&1 || { echo "[ERROR] docker-compose not installed"; exit 1; }

# 构建并启动
echo "[1/5] Building and starting containers..."
docker-compose up --build -d

# 等待数据库就绪
echo "[2/5] Waiting for database..."
sleep 5
until docker exec safety-postgres pg_isready -U postgres >/dev/null 2>&1; do
    echo "  Waiting for postgres..."
    sleep 2
done

# 运行迁移
echo "[3/5] Running database migrations..."
docker exec safety-backend alembic upgrade head

# 初始化管理员
echo "[4/5] Seeding admin account..."
docker exec safety-backend python scripts/seed_admin.py

# 健康检查
echo "[5/5] Health check..."
sleep 2
curl -sf http://localhost/health >/dev/null 2>&1 && echo "  Frontend: OK" || echo "  Frontend: FAIL"
curl -sf http://localhost:8000/health >/dev/null 2>&1 && echo "  Backend:  OK" || echo "  Backend:  FAIL"

echo ""
echo "=========================================="
echo "  Deploy Complete!"
echo "=========================================="
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo "MinIO Console: http://localhost:9001"
echo ""
echo "Admin Login:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "[IMPORTANT] Change admin password after first login!"
