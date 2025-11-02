# database.py
from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.future import select

# 导入异步MySQL数据库连接配置
SQLALCHEMY_DATABASE_URL = "mysql+aiomysql://root:600160@localhost/oral_trainer_db"
# 创建异步数据库引擎，echo=True会打印所有SQL语句
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=True)

# 关键：实例化 async_sessionmaker
async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# 导入SQLAlchemy的declarative_base，用于创建基类
from sqlalchemy.ext.declarative import declarative_base
# 导入SQLAlchemy的相关组件
from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
# 创建SQLAlchemy的基类
Base = declarative_base()

# 定义User模型类，对应数据库中的users表
class User(Base):
    __tablename__ = "users"  # 指定表名为"users"
    # 定义id字段，整数类型，主键，创建索引
    id = Column(Integer, primary_key=True, index=True)
    # 定义用户名字段，字符串类型，最大长度50，唯一约束，创建索引
    username = Column(String(50), unique=True, index=True)
    hashed_password = Column(String(255))
    conversations = relationship("Conversation", back_populates="user")

# 定义一个名为Conversation的类，继承自Base类
class Conversation(Base):
    # 设置表名为"conversations"
    __tablename__ = "conversations"
    # 定义id字段，类型为Integer，作为主键，并创建索引
    id = Column(Integer, primary_key=True, index=True)
    # 定义user_id字段，类型为Integer，作为外键关联到users表的id字段
    user_id = Column(Integer, ForeignKey("users.id"))
    # 定义title字段，类型为String，最大长度为100
    title = Column(String(100))
    # 定义history字段，类型为Text，用于存储对话历史记录
    history = Column(Text)
    # 定义与User模型的关系，一个User可以有多个Conversation
    user = relationship("User", back_populates="conversations")

# 正确使用数据库会话的异步生成器函数
async def get_db():
    # 使用异步上下文管理器创建数据库会话
    async with async_session() as session:  # 正确！
        # 将会话传递给调用者
        yield session

# 初始化数据库的异步函数
async def init_db():
    # 使用异步上下文管理器创建数据库连接
    async with engine.begin() as conn:
        # 运行同步方法创建所有表
        await conn.run_sync(Base.metadata.create_all)