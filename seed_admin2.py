import paramiko
import uuid

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

admin_hash = '$2b$12$KDipGGNrhl4N/CDe0cRbXO9fRegVNTwBWa9ZJko/GGkWbX.PaYQTC'
admin_id = str(uuid.uuid4())

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

sql = (
    f"INSERT INTO users (id, username, password_hash, role, created_at) "
    f"VALUES ('{admin_id}', 'admin', '{admin_hash}', 'admin', NOW()) "
    f"ON CONFLICT (username) DO NOTHING;"
)

commands = [
    f'sudo docker exec safety-postgres psql -U postgres -d safety_hazard -c "{sql}"',
    'sudo docker exec safety-postgres psql -U postgres -d safety_hazard -c "SELECT username, role, created_at FROM users;"',
    'curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin&password=admin123"',
]

for cmd in commands:
    print(f'=== {cmd[:80]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err:
        print('STDERR:', err[:300])

client.close()
print('Done!')
