# 导入所需的库
import aiohttp  # 异步HTTP客户端/服务器库
import asyncio  # 异步I/O库
import json  # JSON数据处理库
import logging  # 日志记录库

# 配置日志记录
logging.basicConfig(level=logging.INFO)  # 设置日志级别为INFO
logger = logging.getLogger(__name__)  # 创建当前模块的日志记录器

# 定义常量
OLLAMA_URL = "http://localhost:11434/api/generate"  # Ollama API的URL
MODEL_NAME = "qwen2.5:0.5b"  # 使用的模型名称


async def generate_response(prompt: str, history: str = "") -> str:
    """
    生成模型响应的异步函数
    参数:
        prompt (str): 用户输入的提示
        history (str, optional): 对话历史，默认为空字符串
    返回:
        str: 模型生成的响应文本
    异常:
        Exception: 当API调用失败时抛出
    """
    # 构建完整的提示，包含历史对话（如果有）
    full_prompt = f"{history}\nUser: {prompt}\nAssistant: Respond in English for oral practice:" if history else f"Respond in English for oral practice: {prompt}"

    # 构建发送给API的请求体
    payload = {
        "model": MODEL_NAME,  # 使用的模型名称
        "prompt": full_prompt,  # 完整的提示文本
        "stream": False,  # 不使用流式响应
        "options": {  # 模型生成选项
            "temperature": 0.7,  # 控制随机性的参数
            "max_tokens": 200  # 生成的最大token数量
        }
    }

    # 记录发送的提示信息
    logger.info(f"Sending prompt to Ollama: {full_prompt}")
    # 使用异步HTTP会话发送请求
    async with aiohttp.ClientSession() as session:
        try:
            # 发送POST请求到Ollama API
            async with session.post(OLLAMA_URL, json=payload) as response:
                # 检查响应状态码
                if response.status == 200:
                    # 解析JSON响应
                    result = await response.json()
                    # 获取响应文本并去除前后空白
                    response_text = result.get("response", "").strip()
                    # 如果响应以"Assistant:"开头，则移除它
                    if response_text.startswith("Assistant:"):
                        response_text = response_text[len("Assistant:"):].strip()
                    # 记录模型响应
                    logger.info(f"Ollama response: {response_text}")
                    return response_text
                else:
                    # 处理API错误响应
                    error_text = await response.text()
                    logger.error(f"Ollama API 错误: {response.status} - {error_text}")
                    raise Exception(f"Ollama API 错误: {response.status} - {error_text}")
        except Exception as e:
            # 处理请求过程中的异常
            logger.error(f"调用 Ollama 失败: {str(e)}")
            raise Exception(f"调用 Ollama 失败: {str(e)}")
