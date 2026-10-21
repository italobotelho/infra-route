"""
Ponto de entrada da API InfraRoute (FastAPI).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.controllers.topologia_controller import router as topologia_router

app = FastAPI(
    title="InfraRoute API",
    description="API para planejamento geoespacial e otimização de redes de fibra óptica.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topologia_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
