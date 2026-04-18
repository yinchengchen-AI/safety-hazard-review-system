import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

commands = [
    'sudo docker exec safety-backend python scripts/seed_admin.py',
    'sudo systemctl status nginx --no-pager -l | head -5',
    'curl -s http://localhost:8000/docs | head -5 || echo no_docs',
    'sudo docker ps --format "table {{.Names}}\t{{.Status}}"',
]
for cmd in commands:
    print(f'=== {cmd[:60]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(out or err)

client.close()
