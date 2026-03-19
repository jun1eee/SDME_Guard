from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from hall.graphrag import HallGraphRagEngine
from hall.router import router as hall_router
from hall.service import HallChatService
from schemas import ApiResponse, HealthPayload
from sdm.graphrag import SdmGraphRagEngine
from sdm.router import router as sdm_router
from sdm.service import SdmChatService
from session_store import InMemorySessionStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    session_store = InMemorySessionStore()

    sdm_engine = SdmGraphRagEngine(settings)
    sdm_engine.startup()
    hall_engine = HallGraphRagEngine(settings)
    hall_engine.startup()

    app.state.settings = settings
    app.state.session_store = session_store
    app.state.sdm_service = SdmChatService(
        settings=settings,
        engine=sdm_engine,
        session_store=session_store,
    )
    app.state.hall_service = HallChatService(
        settings=settings,
        session_store=session_store,
        engine=hall_engine,
    )

    try:
        yield
    finally:
        sdm_engine.shutdown()
        hall_engine.shutdown()


app = FastAPI(
    title="Wedding AI API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sdm_router)
app.include_router(hall_router)


@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    request.state.trace_id = request.headers.get("X-Trace-Id", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Trace-Id"] = request.state.trace_id
    return response


@app.get("/healthz", response_model=ApiResponse)
async def healthz():
    return ApiResponse(
        data=HealthPayload(
            status="ok",
            message="service is running",
        )
    )
