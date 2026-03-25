import os
import shutil
import time
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

# 서버 시작 시 __pycache__ 삭제 (이전 코드 캐시 방지)
for _root, _dirs, _ in os.walk(os.path.dirname(__file__)):
    for _d in _dirs:
        if _d == "__pycache__":
            shutil.rmtree(os.path.join(_root, _d), ignore_errors=True)

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from session_store import InMemorySessionStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 엔진 초기화/해제 (DI)"""
    import time as _time
    logger.info("FastAPI 서버 시작")
    session_store = InMemorySessionStore()

    # 스드메 엔진 (Neo4j 연결 재시도)
    from sdm.graphrag import SdmGraphRagEngine
    from sdm.service import SdmChatService
    sdm_engine = SdmGraphRagEngine(settings)
    for attempt in range(5):
        sdm_engine.startup()
        if sdm_engine.ready():
            logger.info("SDM GraphRAG 초기화 성공")
            break
        logger.warning(f"SDM 초기화 실패 (시도 {attempt + 1}/5): {sdm_engine.startup_error}")
        _time.sleep(5)

    # 웨딩홀 엔진 (Neo4j 연결 재시도)
    from hall.graphrag import HallGraphRagEngine
    from hall.service import HallChatService
    hall_engine = HallGraphRagEngine(settings)
    for attempt in range(5):
        hall_engine.startup()
        if hall_engine.driver:
            logger.info("Hall GraphRAG 초기화 성공")
            break
        logger.warning(f"Hall 초기화 실패 (시도 {attempt + 1}/5): {hall_engine.startup_error}")
        _time.sleep(5)

    app.state.settings = settings
    app.state.session_store = session_store
    app.state.sdm_service = SdmChatService(
        settings=settings, engine=sdm_engine, session_store=session_store,
        hall_engine=hall_engine,
    )
    app.state.hall_service = HallChatService(
        settings=settings, session_store=session_store, engine=hall_engine,
    )

    try:
        yield
    finally:
        sdm_engine.shutdown()
        hall_engine.shutdown()
        logger.info("FastAPI 서버 종료")


app = FastAPI(
    title="Wedding AI API",
    description="스드메 + 웨딩홀 추천 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청 로깅 + trace_id 미들웨어
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request.state.trace_id = request.headers.get("X-Trace-Id", str(uuid4()))
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed:.1f}s)")
    response.headers["X-Trace-Id"] = request.state.trace_id
    return response


# 에러 핸들러
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg", "요청 형식 오류") if errors else "요청 형식 오류"
    return JSONResponse(
        status_code=422,
        content={"success": False, "error_code": "VALIDATION_ERROR", "message": msg},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"처리 중 오류: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error_code": type(exc).__name__, "message": str(exc)},
    )


# Health
@app.get("/healthz")
def healthz():
    from schemas.chat import ApiResponse, HealthPayload
    return ApiResponse(data=HealthPayload(status="ok", message="service is running"))


# Static 파일 서빙
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

# 공용 그래프 데이터 (sdm/hall 공유)
from fastapi.responses import HTMLResponse
_shared_graph = {"nodes": [], "edges": [], "query": "", "matched_keywords": []}


def update_shared_graph(data: dict):
    _shared_graph.update(data)


@app.get("/api/graph/data")
def shared_graph_data():
    return {
        "nodes": _shared_graph.get("nodes", []),
        "edges": _shared_graph.get("edges", []),
        "matched": _shared_graph.get("matched_keywords", []),
        "query": _shared_graph.get("query", ""),
    }


@app.get("/api/graph/view", response_class=HTMLResponse)
def shared_graph_view():
    from sdm.router import _GRAPH_HTML_TEMPLATE
    query = _shared_graph.get("query", "") or "-"
    return _GRAPH_HTML_TEMPLATE.replace("__QUERY__", query).replace(
        "/api/chat/sdm/graph/data", "/api/graph/data"
    )


# 라우터 등록
from sdm.router import router as sdm_router
from hall.router import router as hall_router
app.include_router(sdm_router, prefix="/api/chat")
app.include_router(hall_router)

# Gradio 개발 테스트 UI
try:
    from gradio_ui import demo as gradio_demo
    import gradio as gr
    app = gr.mount_gradio_app(app, gradio_demo, path="/ui")
    logger.info("Gradio UI: http://localhost:8000/ui")
except Exception as e:
    logger.warning(f"Gradio UI 로드 실패 (무시): {e}")
