from sqlalchemy.ext.asyncio import AsyncSession
from app.database import SessionLocal  # 假设数据库配置在 app/database.py

async def get_db() -> AsyncSession:
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()