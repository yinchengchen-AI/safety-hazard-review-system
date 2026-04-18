import paramiko

HOST = '43.133.14.168'
USER = 'ubuntu'
PASSWORD = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
print('连接成功')

cmds = [
    ('拉取代码', 'cd /opt/safety-hazard-review-system && sudo git pull'),
    ('删除旧前端镜像', 'sudo docker rmi safety-hazard-review-system-frontend 2>&1 || true'),
    ('重建前端（无缓存）', 'cd /opt/safety-hazard-review-system && sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env build --no-cache frontend 2>&1'),
    ('启动前端', 'cd /opt/safety-hazard-review-system && sudo docker compose -f docker-compose.prod.yml --env-file /etc/safety-hazard.env up -d frontend 2>&1'),
]

for desc, cmd in cmds:
    print(f'\n[{desc}]')
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=300)
    stdin.write(PASSWORD + '\n')
    stdin.flush()
    out = stdout.read().decode('utf-8', errors='replace')
    print(out[-3000:] if len(out) > 3000 else out)

client.close()
print('完成!')
