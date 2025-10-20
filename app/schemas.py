# schemas.py
from pydantic import BaseModel
from typing import List, Optional

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ConversationCreate(BaseModel):
    title: str

class Conversation(BaseModel):
    id: int
    title: str
    history: Optional[str] = None

class Message(BaseModel):
    role: str
    content: str