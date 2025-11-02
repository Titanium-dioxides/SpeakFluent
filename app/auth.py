# auth.py
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import logging
from .database import get_db, User
from .schemas import Token, UserCreate

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 安全配置（最后这个key要改一下或者搞到环境变量什么的，我也不太懂
SECRET_KEY = "your-secret-key-please-change-this"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__ident="2y")

# OAuth2 （！！！tokenUrl 必须和路由路径一致）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")  # 注意：这里是相对路径，对应根路由 /token

# 创建路由器
# 导入APIRouter，用于创建路由
router = APIRouter()

# 异步函数：根据用户名获取用户
async def get_user(db: AsyncSession, username: str):
    # 执行数据库查询，查找匹配用户名的用户
    result = await db.execute(select(User).where(User.username == username))
    # 返回单个结果或None
    return result.scalar_one_or_none()

# 函数：验证密码是否匹配
def verify_password(plain_password, hashed_password):
    # 使用pwd_context验证密码
    return pwd_context.verify(plain_password, hashed_password)

# 函数：获取密码的哈希值
def get_password_hash(password):
    # 记录密码哈希操作
    logger.info(f"Hashing password: {repr(password)}")
    # 返回密码的哈希值
    return pwd_context.hash(password)

# 异步函数：验证用户身份
async def authenticate_user(db: AsyncSession, username: str, password: str):
    # 获取用户信息
    user = await get_user(db, username)
    # 如果用户不存在或密码不匹配，返回False
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

# 函数：创建访问令牌
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    # 复制要编码的数据
    to_encode = data.copy()
    # 设置过期时间，默认为15分钟后
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    # 添加过期时间到编码数据中
    to_encode.update({"exp": expire})
    # 使用JWT编码数据并返回令牌
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# 异步函数：获取当前用户
async def get_current_user(
    token: str = Depends(oauth2_scheme),  # 依赖oauth2_scheme获取token
    db: AsyncSession = Depends(get_db)    # 依赖get_db获取数据库会话
):
    # 创建凭据异常
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 解码JWT令牌
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # 从令牌中获取用户名
        username: str = payload.get("sub")
        # 如果用户名为空，抛出异常
        if username is None:
            raise credentials_exception
    except JWTError:
        # JWT解码错误时抛出异常
        raise credentials_exception
    # 从数据库获取用户
    user = await get_user(db, username=username)
    # 如果用户不存在，抛出异常
    if user is None:
        raise credentials_exception
    return user

# 异步函数：创建新用户
async def create_user(db: AsyncSession, user: UserCreate):
    # 检查用户名是否已存在
    existing = await db.execute(select(User).where(User.username == user.username))
    if existing.scalar_one_or_none():
        # 如果用户名已存在，抛出异常
        raise HTTPException(status_code=400, detail="用户名已存在")
    # 获取密码的哈希值
    hashed = get_password_hash(user.password)
    # 创建新用户实例
    new_user = User(username=user.username, hashed_password=hashed)
    # 添加新用户到数据库
    db.add(new_user)
    # 提交数据库事务
    await db.commit()
    # 刷新新用户实例
    await db.refresh(new_user)
    return new_user

# ==================== 路由接口 ====================

# 用户认证和注册相关路由
@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),  # 从请求中获取表单数据，包含用户名和密码
    db: AsyncSession = Depends(get_db)  # 获取数据库会话
):
    """
    OAuth2 Password Flow: 登录获取 token
    Swagger UI 会自动调用此接口
    """
    # 验证用户提供的用户名和密码
    user = await authenticate_user(db, form_data.username, form_data.password)
    # 如果用户验证失败，抛出401未授权异常
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 设置token过期时间
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # 创建访问token
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    # 返回token和token类型
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register")
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    注册新用户（可选）
    """
    # 调用创建用户函数，在数据库中创建新用户
    return await create_user(db, user)