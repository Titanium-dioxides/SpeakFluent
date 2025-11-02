# app/logging_config.py
import logging

logging.basicConfig(
    level=logging.INFO,          # 只输出 INFO 及以上，DEBUG 不再刷屏
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)