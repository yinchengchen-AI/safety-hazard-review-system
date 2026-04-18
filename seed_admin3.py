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

# Delete existing broken admin user first
sql_delete = "DELETE FROM users WHERE username='admin';\n"
sql_insert = (
    f"INSERT INTO users (id, username, password_hash, role, created_at) "
    f"VALUES ('{admin_id}', 'admin', '{admin_hash}', 'admin', NOW());\n"
)
sql_check = "SELECT username, role, length(password_hash) as hash_len FROM users;\n"

# Use stdin to pipe SQL, avoiding shell variable expansion issues
for label, sql in [('delete', sql_delete), ('insert', sql_insert), ('check', sql_check)]:
    print(f'=== {label} ===')
    stdin, stdout, stderr = client.exec_command(
        'sudo docker exec -i safety-postgres psql -U postgres -d safety_hazard',
        timeout=30
    )
    stdin.write(sql)
    stdin.channel.shutdown_write()
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err:
        print('STDERR:', err[:200])

# Test login
print('=== test login ===')
stdin, stdout, stderr = client.exec_command(
    'curl -s -X POST http://localhost:8000/api/v1/auth/login '
    '-H "Content-Type: application/x-www-form-urlencoded" '
    '-d "username=admin&password=admin123"',
    timeout=15
)
print(stdout.read().decode()[:300])

client.close()
print('Done!')
