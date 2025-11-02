from sqlalchemy.ext.asyncio import AsyncSession
from app.database import SessionLocal  # 假设数据库配置在 app/database.py

async def get_db() -> AsyncSession:

    """
    获取数据库会话的异步生成器函数

    该函数用于创建和管理异步数据库会话，使用依赖注入模式。
    当请求到达时创建会话，请求结束后自动关闭会话，确保资源的正确释放。

    Returns:
        AsyncSession: 返回一个异步数据库会话对象

    Yields:
        AsyncSession: 生成一个异步数据库会话供其他函数使用
    """
    db = SessionLocal()  # 创建一个新的数据库会话
    try:
        yield db  # 将会话传递给调用者
    finally:
        await db.close()  # 确保会话最终被关闭，释放资源