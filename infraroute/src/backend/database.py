"""
Configuração resiliente de conexão e sessão transacional com PostgreSQL / PostGIS.
"""

from contextlib import contextmanager
import os
from typing import Any, Generator, Optional

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/infraroute",
)

_engine: Optional[Any] = None
_SessionLocal: Optional[Any] = None


def inicializar_engine(database_url: Optional[str] = None) -> Any:
    """
    Inicializa o Engine do SQLAlchemy sob demanda (Lazy Initialization) com:
    - `pool_pre_ping=True`: testa a saúde da conexão antes de entregá-la ao pool.
    - `pool_recycle=1800`: recicla conexões ociosas a cada 30 minutos.
    """
    global _engine, _SessionLocal
    if _engine is not None and database_url is None:
        return _engine

    url = (database_url or DATABASE_URL).strip()
    if not url.startswith(("postgresql://", "postgresql+psycopg2://", "sqlite://")):
        raise ValueError(
            "DATABASE_URL inválida. Utilize um esquema PostgreSQL compatível com PostGIS."
        )

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    kwargs_pool = {}
    if not url.startswith("sqlite://"):
        kwargs_pool = {
            "pool_pre_ping": True,
            "pool_size": 10,
            "max_overflow": 20,
            "pool_recycle": 1800,
        }

    _engine = create_engine(url, **kwargs_pool)
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


@contextmanager
def transacao_segura() -> Generator[Any, None, None]:
    """
    Gerenciador de contexto transacional que garante commit atômico em caso de sucesso
    e rollback imediato em caso de qualquer exceção de domínio ou de banco.
    """
    if _SessionLocal is None:
        inicializar_engine()

    sessao = _SessionLocal()
    try:
        yield sessao
        sessao.commit()
    except Exception:
        sessao.rollback()
        raise
    finally:
        sessao.close()


def obter_sessao_db() -> Generator[Any, None, None]:
    """Dependency Injection para rotas do FastAPI (`Depends(obter_sessao_db)`)."""
    with transacao_segura() as sessao:
        yield sessao
