import asyncio
import functools
import io
import numpy as np
from pydub import AudioSegment
from TTS.api import TTS
import logging

logger = logging.getLogger(__name__)

# 全局单例：只会初始化一次
_tts_instance: TTS | None = None

def _init_tts() -> TTS:
    """同步初始化，在线程池里执行"""
    global _tts_instance
    if _tts_instance is None:
        logger.info("Initializing TTS model...")
        try:
            _tts_instance = TTS(
                model_path="D:/code/python/oral_trainer_app_test/tts_models--en--ljspeech--tacotron2-DDC/best_model.pth",
                config_path="D:/code/python/oral_trainer_app_test/tts_models--en--ljspeech--tacotron2-DDC/config.json",
                progress_bar=False,
                gpu=False,
            )
            logger.info("TTS model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize TTS model: {str(e)}", exc_info=True)
            raise
    return _tts_instance

async def text_to_speech(text: str) -> bytes:
    """异步接口：将文本转为 WAV 格式的字节数据"""
    try:
        if not text or text.strip() == "":
            logger.error("Text-to-speech received empty input")
            raise ValueError("Input text cannot be empty")

        loop = asyncio.get_running_loop()
        tts = await loop.run_in_executor(None, _init_tts)

        # 合成音频，尝试不拆分句子
        logger.info(f"Generating TTS for text: {text[:50]}...")
        wav = None
        for i, method_name in enumerate(["原方法", "去标点", "测试句"]):
            try:
                if i == 0:
                    wav = await loop.run_in_executor(None, functools.partial(tts.tts, text))
                elif i == 1:
                    clean_text = text.replace('!', '').replace('?', '').replace(',', '')
                    wav = await loop.run_in_executor(None, functools.partial(tts.tts, clean_text))
                else:
                    wav = await loop.run_in_executor(None, functools.partial(tts.tts, "Hello world test"))

                logger.info(f"  方法{i + 1}({method_name}): {type(wav)}")
                if isinstance(wav, np.ndarray) and wav.size > 1000:
                    logger.info(f"✅ 方法{i + 1}成功！{wav.size}样本")
                    break
            except Exception as e:
                logger.warning(f"  方法{i + 1}失败: {e}")

        if wav is None or (isinstance(wav, np.ndarray) and wav.size < 1000):
            raise ValueError("所有TTS方法都失败了")

        # 处理 TTS 输出
        if isinstance(wav, list):
            logger.debug(f"TTS output: {len(wav)} elements, first 5: {[type(x) for x in wav[:5]]}")
            float_samples = [x for x in wav if isinstance(x, (float, np.float64))]
            int_samples = [float(x) for x in wav if isinstance(x, int)]
            all_samples = float_samples + int_samples
            logger.info(f"合并样本：{len(float_samples)} float + {len(int_samples)} int = {len(all_samples)} 总样本")
            if len(all_samples) < 1000:
                raise ValueError(f"样本太少：{len(all_samples)}")
            wav = np.array(all_samples, dtype=np.float32)
        elif isinstance(wav, np.ndarray):
            if wav.size == 0:
                logger.error("TTS output array is empty")
                raise ValueError("TTS generated empty audio data")
            wav = wav.astype(np.float32)
        else:
            logger.error(f"TTS output type is invalid: {type(wav)}")
            raise ValueError(f"TTS output type is invalid: {type(wav)}")

        # 规范化音频数据
        max_amplitude = np.max(np.abs(wav))
        if max_amplitude > 1.0:
            wav = wav / max_amplitude  # 规范化到 [-1, 1]
        wav_array = (wav * 32767).clip(-32768, 32767).astype(np.int16)  # 转换为 16-bit

        # 将 NumPy 数组转换为 AudioSegment
        audio = AudioSegment(
            wav_array.tobytes(),
            frame_rate=22050,
            sample_width=2,  # 16-bit = 2 bytes
            channels=1
        )

        # 导出为 WAV 格式的字节数据并验证
        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        audio_bytes = buffer.getvalue()

        if not audio_bytes or audio_bytes[:4] != b'RIFF':
            logger.error(f"Invalid WAV data: length={len(audio_bytes)}, header={audio_bytes[:4].hex() if audio_bytes else 'None'}")
            # 调试：保存原始数据
            with open("debug_raw_audio.bin", "wb") as f:
                f.write(audio_bytes)
            raise ValueError("Generated WAV data is invalid")

        logger.info(f"Text-to-speech generated successfully, bytes length: {len(audio_bytes)}")
        return audio_bytes
    except Exception as e:
        logger.error(f"Text-to-speech processing error: {str(e)}", exc_info=True)
        raise

async def tts_to_file(text: str, file_path: str):
    """额外封装：直接落盘"""
    try:
        loop = asyncio.get_running_loop()
        tts = await loop.run_in_executor(None, _init_tts)
        await loop.run_in_executor(
            None, functools.partial(tts.tts_to_file, text=text, file_path=file_path, split_sentences=False)
        )
        logger.info(f"Audio saved to {file_path}")
    except Exception as e:
        logger.error(f"Failed to save audio to file: {str(e)}", exc_info=True)
        raise

# -------------- CLI 测试 --------------
if __name__ == "__main__":
    asyncio.run(tts_to_file("Hello, this is a test.", "demo.wav"))
    print("已生成 demo.wav")