import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

# Install bcrypt 3.2.2 in the backend and celery containers
commands = [
    'sudo docker exec safety-backend pip install bcrypt==3.2.2 -q',
    'sudo docker exec safety-celery pip install bcrypt==3.2.2 -q',
    'sudo docker exec safety-celery-beat pip install bcrypt==3.2.2 -q',
    # Restart backend to pick up new bcrypt
    'sudo docker restart safety-backend',
    # Wait a bit
    'sleep 5',
    # Test login
    'curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin&password=admin123" | head -c 300',
]

for cmd in commands:
    print(f'=== {cmd[:80]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err and 'WARNING' not in err and 'DEPRECATION' not in err:
        print('STDERR:', err[:300])

client.close()
print('Done!')
