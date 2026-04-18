import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

# Install the nginx config and reload
commands = [
    'sudo cp /opt/safety-hazard-review-system/nginx.conf /etc/nginx/sites-available/safety-hazard',
    'sudo ln -sf /etc/nginx/sites-available/safety-hazard /etc/nginx/sites-enabled/safety-hazard',
    'sudo rm -f /etc/nginx/sites-enabled/default',
    'sudo nginx -t',
    'sudo systemctl reload nginx',
    'curl -s http://localhost:80/ | head -5',
]

for cmd in commands:
    print(f'=== {cmd[:60]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(out or err)

client.close()
print('Done!')
