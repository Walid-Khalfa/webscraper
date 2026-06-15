import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agencies import router as agencies_router
from app.api.alerts import router as alerts_router
from app.api.jobs import router as jobs_router
from app.db.database import Base, engine

Base.metadata.create_all(bind=engine)


def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app = FastAPI(
    title="Emploi Agences Jobs API",
    description="Search job offers from the public Bundesagentur fuer Arbeit job board API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(jobs_router)
app.include_router(agencies_router)
app.include_router(alerts_router)
