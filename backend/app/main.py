from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import applications, auth, posts

settings = get_settings()

app = FastAPI(
    title="HSE Business Club — стартапы и вакансии",
    version="1.0.0",
    description="Модуль поиска команды: публикации, лента, отклики.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(applications.router)


@app.get("/api/health", tags=["service"])
def health() -> dict[str, str]:
    return {"status": "ok"}
