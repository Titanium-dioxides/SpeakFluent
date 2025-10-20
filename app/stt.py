import io
import numpy as np
from pydub import AudioSegment
import whisper
import logging

logger = logging.getLogger(__name__)

async def speech_to_text(audio_data: bytes) -> str:
    try:
        # 将字节数据转换为 AudioSegment
        audio = AudioSegment.from_file(io.BytesIO(audio_data))
        # 确保转换为 WAV 格式，采样率为 16000Hz，单声道，float32
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(4)  # 4 bytes = float32
        audio_array = np.array(audio.get_array_of_samples(), dtype=np.float32) / 2**15
        audio_array = audio_array / np.max(np.abs(audio_array)) if np.max(np.abs(audio_array)) != 0 else audio_array

        # 加载 Whisper 模型
        model = whisper.load_model("base")
        result = model.transcribe(audio_array, fp16=False)
        text = result["text"].strip()
        if not text:
            logger.warning("No text transcribed from audio")
            raise ValueError("未识别到音频中的文本")
        return text
    except Exception as e:
        logger.error(f"Speech-to-text processing error: {str(e)}")
        raise