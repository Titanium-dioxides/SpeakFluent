from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.security import OAuth2PasswordBearer
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

logger = logging.getLogger(__name__)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.post("/register")
async def register(user: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    logger.debug(f"Register request: Content-Type={request.headers.get('content-type')}, body={await request.body()}")
    await create_user(db, user)
    return {"msg": "用户注册成功"}

@router.post("/token", response_model=Token)
async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
    logger.debug(f"Login attempt: username={user.username}")
    authenticated = await authenticate_user(db, user.username, user.password)
    if not authenticated:
        logger.warning(f"Authentication failed for username={user.username}")
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": authenticated.username}, expires_delta=access_token_expires)
    logger.info(f"Token generated for username={user.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/validate-token")
async def validate_token(current_user: User = Depends(get_current_user)):
    logger.debug(f"Token validated for user_id={current_user.id}, username={current_user.username}")
    return {"msg": "Token is valid"}

@router.post("/conversations")
async def create_conversation(conv: ConversationCreate, current_user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db)):
    logger.debug(f"Creating conversation: title={conv.title}, user_id={current_user.id}")
    new_conv = Conversation(title=conv.title, user_id=current_user.id, history=json.dumps([]))
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    logger.info(f"Conversation created: id={new_conv.id}, title={new_conv.title}")
    return ConvSchema(id=str(new_conv.id), title=new_conv.title)

@router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    logger.debug(f"Fetching conversations for user_id={current_user.id}")
    result = await db.execute(select(Conversation).where(Conversation.user_id == current_user.id))
    convs = result.scalars().all()
    logger.info(f"Found {len(convs)} conversations for user_id={current_user.id}")
    return [ConvSchema(id=str(c.id), title=c.title) for c in convs]

@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, current_user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    logger.debug(f"Fetching conversation: conv_id={conv_id}, user_id={current_user.id}")
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == current_user.id))
    conv = result.scalar_one_or_none()
    if not conv:
        logger.warning(f"Conversation not found: conv_id={conv_id}, user_id={current_user.id}")
        raise HTTPException(status_code=404, detail="对话未找到")
    logger.info(f"Conversation retrieved: id={conv.id}, title={conv.title}")
    return ConvSchema(id=str(conv.id), title=conv.title, history=conv.history)

@router.post("/conversations/{conv_id}/chat")
async def chat(
        conv_id: str,
        text: Optional[str] = None,
        audio: UploadFile = File(None),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    logger.debug(f"Chat request received: conv_id={conv_id}, user_id={current_user.id}, text={text}, audio_filename={audio.filename if audio else None}")
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        logger.warning(f"Conversation not found: conv_id={conv_id}, user_id={current_user.id}")
        raise HTTPException(status_code=404, detail="对话未找到")

    history = json.loads(conv.history) if conv.history else []

    # 处理输入
    user_text = None
    if audio:
        try:
            audio_data = await audio.read()
            logger.debug(f"Audio data received: size={len(audio_data)} bytes")
            user_text = await speech_to_text(audio_data)
            logger.info(f"User text from audio: {user_text}")
        except Exception as e:
            logger.error(f"Speech-to-text error: {str(e)}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"音频处理失败: {str(e)}")
    elif text:
        user_text = text
        logger.info(f"User text from text: {user_text}")
    else:
        logger.warning("No text or audio provided in chat request")
        raise HTTPException(status_code=400, detail="需要提供文本或音频")

    history.append({"role": "user", "content": user_text})

    # 生成 AI 回复
    try:
        prompt = user_text
        assistant_text = await generate_response(prompt, json.dumps(history))
        logger.debug(f"AI response generated: {assistant_text[:50]}...")
        history.append({"role": "assistant", "content": assistant_text})
    except Exception as e:
        logger.error(f"AI response generation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"生成回复失败: {str(e)}")

    # 更新会话历史
    conv.history = json.dumps(history)
    await db.commit()

    # 合成音频
    try:
        audio_bytes = await text_to_speech(assistant_text)
        logger.debug(f"Audio generated: size={len(audio_bytes)} bytes, hex sample: {audio_bytes[:4].hex()}")
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        logger.info(f"Text-to-speech completed for: {assistant_text[:50]}...")
        return {"reply": assistant_text, "audio": audio_base64}
    except Exception as e:
        logger.error(f"Text-to-speech error: {str(e)}", exc_info=True)
        return {"reply": assistant_text, "audio": None, "error": f"音频生成失败: {str(e)}"}