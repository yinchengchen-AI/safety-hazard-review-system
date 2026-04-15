import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models import User


async def seed():
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                role="admin",
            )
            db.add(user)
            await db.commit()
            print("Admin user created: admin / admin123")
        else:
            print("Admin user already exists")


if __name__ == "__main__":
    asyncio.run(seed())
