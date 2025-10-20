# 导入所需的SQLAlchemy模块
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.future import select

# 定义数据库连接URL，使用MySQL数据库和aiomysql异步驱动
SQLALCHEMY_DATABASE_URL = "mysql+aiomysql://root:600160@localhost/oral_trainer_db"
# 创建异步数据库引擎，echo=True表示会打印SQL语句
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=True)
# 创建异步会话工厂，用于创建数据库会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

# 创建 declarative_base 实例，用于定义模型类
Base = declarative_base()

# 定义用户模型类
class User(Base):
    __tablename__ = "users"  # 指定表名
    id = Column(Integer, primary_key=True, index=True)  # 主键，索引
    username = Column(String(50), unique=True, index=True)  # 用户名，唯一且索引
    hashed_password = Column(String(255))  # 哈希密码
    conversations = relationship("Conversation", back_populates="user")  # 与Conversation模型的关系

# 定义对话模型类
class Conversation(Base):
    __tablename__ = "conversations"  # 指定表名
    id = Column(Integer, primary_key=True, index=True)  # 主键，索引
    user_id = Column(Integer, ForeignKey("users.id"))  # 外键，关联到users表的id
    title = Column(String(100))  # 对话标题
    history = Column(Text)  # 对话历史记录
    user = relationship("User", back_populates="conversations")  # 与User模型的关系

# 定义获取数据库会话的异步函数
async def get_db():
    async with SessionLocal() as session:
        yield session

# 定义初始化数据库的异步函数
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)  # 创建所有表