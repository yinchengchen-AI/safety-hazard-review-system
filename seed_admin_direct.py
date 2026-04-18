import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

# bcrypt hash of 'admin123'
admin_hash = '$2b$12$KDipGGNrhl4N/CDe0cRbXO9fRegVNTwBWa9ZJko/GGkWbX.PaYQTC'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

sql = (
    f"INSERT INTO users (username, password_hash, role, created_at) "
    f"VALUES ('admin', '{admin_hash}', 'admin', NOW()) "
    f"ON CONFLICT (username) DO NOTHING;"
)

commands = [
    # Check db name
    f'sudo docker exec safety-postgres psql -U postgres -d safety_hazard -c "{sql}"',
    'sudo docker exec safety-postgres psql -U postgres -d safety_hazard -c "SELECT username, role FROM users LIMIT 5;"',
    # Check nginx
    'sudo nginx -t 2>&1',
    'sudo systemctl is-active nginx',
    # Test frontend
    'curl -s -o /dev/null -w "%{http_code}" http://localhost:80/',
    # Test backend auth
    'curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin&password=admin123" | head -c 200',
]

for cmd in commands:
    print(f'=== {cmd[:80]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err and 'trapped' not in err and 'bcrypt' not in err:
        print('STDERR:', err[:400])

client.close()
print('Done!')
