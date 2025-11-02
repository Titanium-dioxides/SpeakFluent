# app/stt.py
import whisper
import soundfile as sf
import io
import asyncio
import numpy as np
import logging

"""
语音转文本模块 (Speech-to-Text)
使用 OpenAI 的 Whisper 模型实现语音识别功能
支持中英双语语音识别
"""
# 配置日志系统
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载 Whisper 模型，当前使用英文基础模型，建议改为通用基础模型以支持中英双语
model = whisper.load_model("base.en")  # 建议改成 "base" 支持中英


async def speech_to_text(audio_data: bytes) -> str:

    """
    将音频数据转换为文本

    参数:
        audio_data (bytes): 音频文件的二进制数据

    返回:
        str: 识别出的文本内容

    处理流程:
        1. 将字节数据转换为 BytesIO 对象
        2. 使用 soundfile 读取音频数据
        3. 处理多声道音频，转换为单声道
        4. 将音频数据类型转换为 float32
        5. 使用 Whisper 模型进行语音识别
        6. 记录并返回识别结果
    """
    await asyncio.sleep(0)  # 确保异步执行
    with io.BytesIO(audio_data) as f:
        # 读取音频文件
        audio, sr = sf.read(f)
        # 如果是多声道音频，转换为单声道
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)

        # 关键：转换为 float32！
        audio = audio.astype(np.float32)

        result = await asyncio.to_thread(model.transcribe, audio)
    logger.info(f"STT Result: {result['text']}")
    return result['text']