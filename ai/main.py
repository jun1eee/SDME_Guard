import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from deps import init_clients, close_clients

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 클라이언트 초기화/해제"""
    logger.info("FastAPI 서버 시작 - 클라이언트 초기화")
    init_clients()
    from sdm.graphrag import init_graphrag
    init_graphrag()
    yield
    logger.info("FastAPI 서버 종료 -클라이언트 해제")
    close_clients()


app = FastAPI(
    title="웨딩 AI 챗봇",
    description="스드메(스튜디오/드레스/메이크업) + 웨딩홀 추천 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청 로깅 미들웨어
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed:.1f}초)")
    return response


# 요청 검증 에러 (빈 메시지, 잘못된 타입 등)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg", "요청 형식 오류") if errors else "요청 형식 오류"
    return JSONResponse(
        status_code=422,
        content={"success": False, "error_code": "VALIDATION_ERROR", "message": msg},
    )


# 전역 에러 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"처리 중 오류: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": type(exc).__name__,
            "message": str(exc),
        },
    )


# Health
@app.get("/api/health")
def health():
    return {"status": "ok"}


# Static 파일 서빙 (vis.js 등)
import os
from fastapi.staticfiles import StaticFiles
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

# 라우터 등록
from sdm.router import router as sdm_router
app.include_router(sdm_router, prefix="/api/chat")
# from hall.router import router as hall_router
# app.include_router(hall_router, prefix="/api/chat")
