# app/main.py
from app.logging_config import logger
from fastapi import FastAPI
from app.routes import router as routes_router
from app.dependencies import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Oral Trainer App", description="A voice-based conversational AI application", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    try:
        logger.info("Starting server with Uvicorn...")
        uvicorn.run(app, host="0.0.0.0", port=8000, reload=True, log_level="debug")
    except Exception as e:
        logger.error(f"Server failed to start: {str(e)}", exc_info=True)
        raise