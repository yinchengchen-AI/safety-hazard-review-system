import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

# Check DB name from backend env, then seed admin
commands = [
    # Check what DB the backend is using
    'sudo docker exec safety-backend env | grep DATABASE',
    # Re-run seed admin with full output
    'sudo docker exec -w /app safety-backend python scripts/seed_admin.py 2>&1 | tail -20',
    # Check container status
    'sudo docker ps --format "table {{.Names}}\t{{.Status}}"',
    # Test backend API
    'curl -s http://localhost:8000/api/v1/ 2>&1 | head -3 || curl -s http://localhost:8000/ 2>&1 | head -3',
]

for cmd in commands:
    print(f'=== {cmd[:80]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err and 'trapped' not in err and 'bcrypt' not in err:
        print('STDERR:', err[:300])

client.close()
print('Done!')
