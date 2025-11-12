# app/stt.py
import whisper
import soundfile as sf
import io
import asyncio
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

model = whisper.load_model("base.en")  # 建议改成 "base" 支持中英


async def speech_to_text(audio_data: bytes) -> str:
    await asyncio.sleep(0)
    with io.BytesIO(audio_data) as f:
        audio, sr = sf.read(f)
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)

        # 关键：转换为 float32！
        audio = audio.astype(np.float32)

        result = await asyncio.to_thread(model.transcribe, audio)
    logger.info(f"STT Result: {result['text']}")
    return result['text']