# app/tts.py
import asyncio
import edge_tts
from io import BytesIO


async def text_to_speech(text: str) -> bytes:
    """
    使用 Microsoft Edge TTS 将文本转为语音（WAV bytes）
    """
    communicate = edge_tts.Communicate(text, voice="en-US-AriaNeural")  # 可换 en-GB-SoniaNeural, zh-CN-XiaoxiaoNeural
    buffer = BytesIO()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])

    buffer.seek(0)
    return buffer.getvalue()