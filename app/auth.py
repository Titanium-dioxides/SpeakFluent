from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, User
from app.schemas import UserCreate
from sqlalchemy.future import select
import logging

# 配置日志记录
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 安全配置常量
SECRET_KEY ="yuguvbfvoahfbvgaf73e7268r7ehfb"
              # 请更换为安全的随机密钥)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 密码加密配置
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__ident="2y")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_user(db: AsyncSession, username: str):
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()

def verify_password(plain_password, hashed_password):
    byte_length = len(plain_password.encode('utf-8'))
    logger.info(f"Verifying password: byte_length={byte_length}, chars={list(plain_password)}")
    if byte_length > 72:
        raise HTTPException(status_code=400, detail="密码长度不能超过72字节")
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    byte_length = len(password.encode('utf-8'))
    logger.info(f"Hashing password: byte_length={byte_length}, chars={list(password)}")
    if byte_length > 72:
        raise HTTPException(status_code=400, detail="密码长度不能超过72字节")
    return pwd_context.hash(password)

async def authenticate_user(db: AsyncSession, username: str, password: str):
    logger.info(f"Authenticating user: username={username}")
    user = await get_user(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user(db, username=username)
    if user is None:
        raise credentials_exception
    return user

async def create_user(db: AsyncSession, user: UserCreate):
    existing = await db.execute(select(User).where(User.username == user.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    logger.info(f"Creating user: username={user.username}, password_byte_length={len(user.password.encode('utf-8'))}")
    hashed = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user