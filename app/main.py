# main.py
from fastapi import FastAPI, Form          # ← 新增 Form（OAuth2PasswordRequestForm 必须）
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from fastapi.openapi.docs import (
    get_redoc_html,
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
# ---------- 导入两个 router ----------
from app.auth import router as auth_router          # 认证相关
from app.routes import router as conv_router        # 会话、chat 等（你贴的那段代码所在的文件）

app = FastAPI(docs_url=None, redoc_url=None)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000/static", "http://127.0.0.1:8000/static", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ---------- 静态文件 ----------
static_dir = "./static"
images_dir = os.path.join(static_dir, "images")

if not os.path.exists(static_dir):
    raise RuntimeError(f"Directory '{static_dir}' does not exist. Please create it and add 'index.html'.")
if not os.path.exists(images_dir):
    raise RuntimeError(f"Directory '{images_dir}' does not exist. Please create it and add 'OIP-C.webp'.")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        # swagger_js_url=BASE_DIR/'static'/'swagger-ui'/'swagger-ui-bundle.js',
        # swagger_css_url=BASE_DIR/'static'/'swagger-ui'/'swagger-ui.css',
        swagger_js_url="/static/dist/swagger-ui-bundle.js",
        swagger_css_url="/static/dist/swagger-ui.css",
    )


@app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_ui_redirect():
    return get_swagger_ui_oauth2_redirect_html()


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=app.title + " - ReDoc",
        redoc_js_url="/static/dist/redoc.standalone.js",
    )
# ---------- 挂载路由 ----------
app.include_router(auth_router)   # /register、/token、/me …
app.include_router(conv_router)   # /conversations、/conversations/{id}/chat …

# ---------- OPTIONS 预检（可选） ----------
@app.options("/register")
async def options_register():
    return {"message": "CORS preflight handled"}