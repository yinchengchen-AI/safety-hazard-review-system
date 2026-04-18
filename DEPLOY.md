# 生产环境部署指南

## 快速开始

```bash
# 1. 上传代码到服务器
scp -r safety-hazard-review-system root@your-tencent-ip:/opt/

# 2. SSH 登录服务器
ssh root@your-tencent-ip

# 3. 进入项目目录
cd /opt/safety-hazard-review-system

# 4. 设置环境变量并部署
export SECRET_KEY=$(openssl rand -hex 32)
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
export MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
./deploy.sh
```

## 腾讯云特定配置

### 1. 安全组规则

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 22 | TCP | 你的IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

注意：8000/9000/9001/5432/6379 端口**不要**对外开放，通过 Nginx 反向代理访问。

### 2. 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo cp nginx.conf /etc/nginx/sites-available/safety-hazard
sudo ln -s /etc/nginx/sites-available/safety-hazard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. 配置 HTTPS (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 4. 使用生产环境配置

```bash
# 创建环境变量文件
sudo tee /opt/safety-hazard-review-system/.env.prod << 'EOF'
SECRET_KEY=your-generated-secret
POSTGRES_PASSWORD=your-postgres-password
MINIO_ROOT_PASSWORD=your-minio-password
ALLOWED_ORIGINS=https://your-domain.com
EOF

# 使用生产配置启动
sudo docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

## 日常运维

### 查看日志
```bash
docker-compose logs -f backend      # 后端日志
docker-compose logs -f celery-worker # Celery 日志
docker-compose logs -f frontend     # 前端日志
```

### 数据库备份
```bash
# 手动备份
docker exec safety-postgres pg_dump -U postgres safety_hazard > backup_$(date +%Y%m%d).sql

# 自动备份 (添加到 crontab)
0 2 * * * cd /opt/safety-hazard-review-system && docker exec safety-postgres pg_dump -U postgres safety_hazard > backups/backup_$(date +\%Y\%m\%d).sql
```

### 更新部署

> ⚠️ **重要**：必须带 `--env-file` 加载保存的密码，否则容器会使用默认密码 `postgres`，导致数据库认证失败、无法登录。

```bash
cd /opt/safety-hazard-review-system
git pull

# 只重建前端（推荐，速度快，不影响后端）
sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d --build frontend

# 重建全部服务
sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d --build
```

## 故障排查

| 问题 | 排查命令 |
|------|----------|
| 服务无法启动 | `docker compose ps` |
| 数据库连接失败 | `docker compose logs postgres` |
| 后端报错 | `docker compose logs backend` |
| Nginx 502 | `sudo tail -f /var/log/nginx/error.log` |
| 磁盘空间不足 | `df -h` 和 `docker system prune` |

### 登录失败 / Internal Server Error

**症状**：前端可以打开，但登录时报错或提示服务器错误。

**排查**：
```bash
# 1. 查看后端日志，若出现 InvalidPasswordError 则是密码问题
sudo docker logs safety-backend --tail 30

# 2. 确认后端容器实际使用的数据库 URL
sudo docker exec safety-backend env | grep DATABASE_URL
```

**根因**：使用 `docker compose up --build` 时若未指定 `--env-file`，`POSTGRES_PASSWORD` 会回退为默认值 `postgres`，而数据库卷中存储的是首次部署时随机生成的密码，导致认证失败。

**修复**：
```bash
# 用保存的环境变量文件重启后端
sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d backend

# 验证登录接口是否正常
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
# 正常应返回 {"access_token": "...", "token_type": "bearer"}
```
