# app/tts.py
import asyncio  # 导入异步IO库，用于处理异步操作
import edge_tts  # 导入Edge TTS库，用于文本转语音
from io import BytesIO  # 导入BytesIO，用于在内存中处理二进制数据


async def text_to_speech(text: str) -> bytes:
    """
    使用 Microsoft Edge TTS 将文本转为语音（W AV bytes）
    参数:
        text (str): 需要转换为语音的文本内容
    返回:
        bytes: 包含WAV格式音频数据的字节流
    说明:
        - 使用edge_tts库将文本转换为语音
        - 支持多种语音选项，如"en-US-AriaNeural", "en-GB-SoniaNeural", "zh-CN-XiaoxiaoNeural"
        - 返回的是内存中的音频数据，可以直接保存为WAV文件或流式传输
    """
    # 创建语音合成对象，使用默认的英文语音（可替换为其他语音）
    communicate = edge_tts.Communicate(text, voice="en-US-AriaNeural")  # 可换 en-GB-SoniaNeural, zh-CN-XiaoxiaoNeural
    buffer = BytesIO()  # 创建内存缓冲区，用于存储音频数据

    # 流式处理音频数据
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":  # 只处理音频数据块
            buffer.write(chunk["data"])  # 将音频数据写入缓冲区

    buffer.seek(0)  # 将缓冲区指针重置到开始位置
    return buffer.getvalue()  # 返回缓冲区中的所有音频数据