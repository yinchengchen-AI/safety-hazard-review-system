import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

commands = [
    # 检查系统 nginx 配置文件内容
    'cat /etc/nginx/sites-enabled/safety-hazard 2>/dev/null || echo "no sites-enabled"',
    # 检查 nginx 是否代理到正确端口
    'sudo docker port safety-frontend',
    # 检查前端容器是否正常响应
    'curl -s http://localhost:8080/ | head -5',
    # 检查实际 nginx 配置
    'sudo nginx -T 2>/dev/null | grep -A 20 "listen 80"',
]

for cmd in commands:
    print(f'=== {cmd[:60]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(out or err)

client.close()
