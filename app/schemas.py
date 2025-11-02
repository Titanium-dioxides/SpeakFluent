# schemas.py

# 定义了多个数据模型，用于API请求和响应的数据验证和序列化
from pydantic import BaseModel  # 导入Pydantic基础模型类
from typing import List, Optional  # 导入类型提示相关模块

class UserCreate(BaseModel):

    # 用户创建模型，用于验证用户注册请求的数据
    username: str  # 用户名，必需字符串类型
    password: str  # 密码，必需字符串类型

class UserLogin(BaseModel):

    # 用户登录模型，用于验证用户登录请求的数据
    username: str  # 用户名，必需字符串类型
    password: str  # 密码，必需字符串类型

class Token(BaseModel):

    # 令牌模型，用于返回认证后的访问令牌信息
    access_token: str  # 访问令牌，必需字符串类型
    token_type: str  # 令牌类型，必需字符串类型

class ConversationCreate(BaseModel):

    # 对话创建模型，用于验证创建新对话请求的数据
    title: str  # 对话标题，必需字符串类型

class Conversation(BaseModel):

    # 对话模型，用于表示对话的数据结构
    id: int  # 对话ID，必需整数类型
    title: str  # 对话标题，必需字符串类型
    history: Optional[str] = None  # 对话历史，可选字符串类型，默认为None

class Message(BaseModel):

    # 消息模型，用于表示对话中的单条消息
    role: str  # 消息发送者角色，必需字符串类型
    content: str  # 消息内容，必需字符串类型