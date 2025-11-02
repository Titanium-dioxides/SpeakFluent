"""
FastAPI 路由模块，提供用户认证和对话管理的 API 端点
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File,Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import json
import logging
from datetime import timedelta
from typing import Optional
from app.database import get_db, User, Conversation
from app.schemas import UserCreate, UserLogin, Token, ConversationCreate, Conversation as ConvSchema
from app.auth import authenticate_user, create_access_token, get_current_user, create_user
from app.llm import generate_response
from app.stt import speech_to_text
from app.tts import text_to_speech

# 配置日志记录
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建路由实例
router = APIRouter()
@router.post("/register")
async def register(user: UserCreate,                    # 请求体：用户注册数据
                   request: Request,                    # 依赖：HTTP 请求对象
                   db: AsyncSession = Depends(get_db)): # 依赖    # ← 加这一行
    logger.info(f"Content-Type: {request.headers.get('content-type')}")
    logger.info(f"Raw body: {await request.body()}")
    logger.info(f"Parsed user.password = {repr(user.password)}")
    await create_user(db, user)
    return {"msg": "用户注册成功"}
@router.post("/token", response_model=Token)
async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
    authenticated = await authenticate_user(db, user.username, user.password)
    if not authenticated:
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": authenticated.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/conversations")
async def create_conversation(conv: ConversationCreate, current_user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db)):
    new_conv = Conversation(title=conv.title, user_id=current_user.id, history=json.dumps([]))
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    return ConvSchema(id=new_conv.id, title=new_conv.title)

@router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.user_id == current_user.id))
    convs = result.scalars().all()
    return [ConvSchema(id=c.id, title=c.title) for c in convs]

@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, current_user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == current_user.id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话未找到")
    return ConvSchema(id=conv.id, title=conv.title, history=conv.history)

@router.post("/conversations/{conv_id}/chat")
async def chat(
    conv_id: str,
    text: Optional[str] = None,
    audio: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话未找到")

    history = json.loads(conv.history) if conv.history else []

    # 处理输入
    user_text = None
    if audio:
        audio_data = await audio.read()
        user_text = await speech_to_text(audio_data)
        logger.info(f"User Text from audio: {user_text}")
    elif text:
        user_text = text
        logger.info(f"User Text from text: {user_text}")
    else:
        raise HTTPException(status_code=400, detail="需要提供文本或音频")

    history.append({"role": "user", "content": user_text})

    # 生成 AI 回复
    prompt = user_text
    assistant_text = await generate_response(prompt, json.dumps(history))
    history.append({"role": "assistant", "content": assistant_text})

    conv.history = json.dumps(history)
    await db.commit()

    # 合成音频
    audio_bytes = await text_to_speech(assistant_text)
    return {"reply": assistant_text, "audio": audio_bytes.hex()}