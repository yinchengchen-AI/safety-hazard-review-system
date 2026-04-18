import paramiko

host = '43.133.14.168'
user = 'ubuntu'
passwd = 'Ycc19831107'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

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

sftp = client.open_sftp()
with sftp.file('/tmp/create_tables.py', 'w') as f:
    f.write(setup_script)
sftp.close()

commands = [
    # Copy script into container app dir
    'sudo docker cp /tmp/create_tables.py safety-backend:/app/create_tables.py',
    # Run from /app directory so app module is found
    'sudo docker exec -w /app safety-backend python create_tables.py',
    # Drop alembic_version and re-stamp
    'sudo docker exec safety-postgres psql -U postgres -d safety_hazard_db -c "DROP TABLE IF EXISTS alembic_version;"',
    'sudo docker exec -w /app safety-backend alembic stamp head',
    # Seed admin
    'sudo docker exec -w /app safety-backend python scripts/seed_admin.py',
    # Clean up temp script
    'sudo docker exec safety-backend rm /app/create_tables.py',
]

for cmd in commands:
    print(f'=== {cmd[:80]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err:
        print('STDERR:', err[:500])

client.close()
print('Done!')
