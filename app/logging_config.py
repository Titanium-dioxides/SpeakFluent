# app/logging_config.py
import logging

# 配置日志系统
logging.basicConfig(
    level=logging.INFO,          # 只输出 INFO 及以上，DEBUG 不再刷屏
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
# 获取当前模块的日志记录器
logger = logging.getLogger(__name__)