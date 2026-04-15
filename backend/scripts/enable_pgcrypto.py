import asyncio
from app.core.database import async_engine


async def run():
    async with async_engine.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    print("pgcrypto extension enabled")


if __name__ == "__main__":
    asyncio.run(run())
