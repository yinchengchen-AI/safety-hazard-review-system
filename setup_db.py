import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

# Write a Python script to the backend container and execute it
setup_script = r"""import asyncio
from sqlalchemy import text
from app.core.database import engine, Base
import app.models

async def create_all():
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto'))
        await conn.run_sync(Base.metadata.create_all)
    print('SUCCESS: All tables created with pgcrypto')

asyncio.run(create_all())
"""

# Write script to /tmp on host, then copy into container
sftp = client.open_sftp()
with sftp.file('/tmp/create_tables.py', 'w') as f:
    f.write(setup_script)
sftp.close()

commands = [
    'sudo docker cp /tmp/create_tables.py safety-backend:/tmp/create_tables.py',
    'sudo docker exec safety-backend python /tmp/create_tables.py',
    'sudo docker exec safety-backend alembic stamp head',
    'sudo docker exec safety-backend python scripts/seed_admin.py',
]

for cmd in commands:
    print(f'=== {cmd[:70]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err:
        print('STDERR:', err)

client.close()
print('Done!')
