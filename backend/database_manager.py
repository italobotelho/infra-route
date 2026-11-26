"""
Gerenciador de Conexão Relacional com Programação Orientada a Objetos (POO)
e Python DB-API, alinhado às aulas de Bancos de Dados Relacionais:

- Classe abstrata `DatabaseManagerBase(ABC)` com métodos abstratos e concretos.
- Encapsulamento de conexão (`_conn`) e cursor (`_cursor`).
- Gerenciador de contexto (`__enter__`, `__exit__`) com `commit()` em sucesso
  e `rollback()` automático em exceções.
- Métodos padronizados: `execute_query`, `fetch_all`, `fetch_one`, `execute_commit`.
- Subclasses concretas polimórficas:
  - `PostgresDatabaseManager` (`psycopg2` + `RealDictCursor`, padrão oficial do projeto com PostgreSQL + PostGIS)
  - `SQLiteDatabaseManager` (`sqlite3` com `PRAGMA foreign_keys = ON`, fallback local quando não há daemon PostgreSQL ativo)
"""

from abc import ABC, abstractmethod
import os
from pathlib import Path
import sqlite3
import threading
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import quote_plus, urlparse


class DatabaseManagerBase(ABC):
    """
    Classe abstrata base para gerenciamento transacional de banco de dados relacional.
    """

    def __init__(self, motor: str, destino: str) -> None:
        self._motor = motor
        self._destino = destino
        self._local = threading.local()

    def _obter_pilha_thread(self) -> List[Tuple[Optional[Any], Optional[Any]]]:
        pilha = getattr(self._local, "pilha", None)
        if pilha is None:
            pilha = []
            self._local.pilha = pilha
        return pilha

    @property
    def _conn(self) -> Optional[Any]:
        pilha = self._obter_pilha_thread()
        return pilha[-1][0] if pilha else None

    @_conn.setter
    def _conn(self, value: Optional[Any]) -> None:
        pilha = self._obter_pilha_thread()
        if value is None:
            if pilha and pilha[-1][1] is None:
                pilha.pop()
            elif pilha:
                pilha[-1] = (None, pilha[-1][1])
            return
        if pilha:
            pilha[-1] = (value, pilha[-1][1])
        else:
            pilha.append((value, None))

    @property
    def _cursor(self) -> Optional[Any]:
        pilha = self._obter_pilha_thread()
        return pilha[-1][1] if pilha else None

    @_cursor.setter
    def _cursor(self, value: Optional[Any]) -> None:
        pilha = self._obter_pilha_thread()
        if value is None:
            if pilha and pilha[-1][0] is None:
                pilha.pop()
            elif pilha:
                pilha[-1] = (pilha[-1][0], None)
            return
        if pilha:
            pilha[-1] = (pilha[-1][0], value)
        else:
            pilha.append((None, value))

    @property
    def motor(self) -> str:
        return self._motor

    @property
    def destino(self) -> str:
        return self._destino

    @abstractmethod
    def _conectar(self) -> Tuple[Any, Any]:
        """Abre a conexão e retorna o par `(conn, cursor)`."""

    def _preparar_sql_e_params(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> Tuple[str, Tuple[Any, ...]]:
        """Hook polimórfico para adaptação de placeholders entre SGBDs."""
        return query, tuple(params or ())

    def __enter__(self) -> "DatabaseManagerBase":
        conn, cursor = self._conectar()
        self._obter_pilha_thread().append((conn, cursor))
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        pilha = self._obter_pilha_thread()
        if not pilha:
            return
        conn, cursor = pilha.pop()
        if conn is not None:
            try:
                if exc_type is not None:
                    conn.rollback()
                else:
                    conn.commit()
            finally:
                if cursor is not None:
                    cursor.close()
                conn.close()

    def execute_query(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> None:
        if self._cursor is None:
            raise RuntimeError("Cursor não inicializado. Utilize o bloco 'with'.")
        sql_final, params_final = self._preparar_sql_e_params(query, params)
        self._cursor.execute(sql_final, params_final)

    def fetch_all(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> List[Dict[str, Any]]:
        self.execute_query(query, params)
        rows = self._cursor.fetchall()
        return [dict(row) for row in rows]

    def fetch_one(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> Optional[Dict[str, Any]]:
        self.execute_query(query, params)
        row = self._cursor.fetchone()
        return dict(row) if row is not None else None

    def execute_commit(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> int:
        self.execute_query(query, params)
        return int(getattr(self._cursor, "lastrowid", 0) or 0)

    def execute_script(self, script_sql: str) -> None:
        """Executa múltiplas instruções DDL/DML em lote (inicialização de schema)."""
        if self._conn is None or self._cursor is None:
            raise RuntimeError("Conexão não inicializada. Utilize o bloco 'with'.")
        for stmt in [s.strip() for s in script_sql.split(";") if s.strip()]:
            self._cursor.execute(stmt)

    def __str__(self) -> str:
        return f"{self.__class__.__name__}(motor='{self._motor}', destino='{self._destino}')"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, DatabaseManagerBase):
            return False
        return self._motor == other._motor and self._destino == other._destino


class PostgresDatabaseManager(DatabaseManagerBase):
    """
    Implementação concreta oficial para PostgreSQL + PostGIS via `psycopg2`.
    """

    def __init__(
        self,
        database_url: Optional[str] = None,
        *,
        host: str = "localhost",
        port: int = 5432,
        user: str = "postgres",
        password: str = "postgres",
        database: str = "infraroute",
    ) -> None:
        if database_url is not None:
            url_limpa = database_url.strip()
            if not url_limpa.startswith(("postgresql://", "postgresql+psycopg2://")):
                raise ValueError(
                    "DATABASE_URL inválida. Utilize um esquema PostgreSQL compatível com PostGIS."
                )
            self._dsn = url_limpa.replace("postgresql+psycopg2://", "postgresql://", 1)
            parsed = urlparse(self._dsn)
            host_destino = parsed.hostname or "localhost"
            port_destino = parsed.port or 5432
            db_destino = parsed.path.lstrip("/") or "infraroute"
            destino = f"{host_destino}:{port_destino}/{db_destino}"
        else:
            self._dsn = (
                f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
                f"@{host}:{int(port)}/{database}"
            )
            destino = f"{host}:{int(port)}/{database}"
        super().__init__(motor="postgresql", destino=destino)

    def _conectar(self) -> Tuple[Any, Any]:
        import psycopg2
        import psycopg2.extras

        conn = psycopg2.connect(self._dsn)
        conn.autocommit = False
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return conn, cursor


class SQLiteDatabaseManager(DatabaseManagerBase):
    """
    Implementação concreta em SQLite relacional local com `PRAGMA foreign_keys = ON`.
    Atua como fallback 100% autônomo e ACID sem exigir daemon PostgreSQL externo ativo,
    convertendo placeholders `%s` para `?` de forma transparente.
    """

    def __init__(self, db_path: str = ".cache/infraroute.db") -> None:
        super().__init__(motor="sqlite", destino=str(db_path))
        self.db_path = str(db_path)

    def _conectar(self) -> Tuple[Any, Any]:
        if self.db_path != ":memory:":
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path, timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 30000;")
        if self.db_path != ":memory:":
            conn.execute("PRAGMA journal_mode = WAL;")
        cursor = conn.cursor()
        return conn, cursor

    def _preparar_sql_e_params(
        self, query: str, params: Optional[Sequence[Any]] = None
    ) -> Tuple[str, Tuple[Any, ...]]:
        sql_adaptado = query.replace("%s", "?")
        return sql_adaptado, tuple(params or ())

    def execute_script(self, script_sql: str) -> None:
        if self._conn is None:
            raise RuntimeError("Conexão não inicializada. Utilize o bloco 'with'.")
        self._conn.executescript(script_sql)


def criar_database_manager(
    *,
    db_engine: Optional[str] = None,
    sqlite_db_path: Optional[str] = None,
    database_url: Optional[str] = None,
) -> DatabaseManagerBase:
    """
    Factory polimórfica que instancia o `DatabaseManager` conforme variáveis `.env`.
    Suporta `postgresql` (oficial) e `sqlite` (fallback local).
    """
    engine = (db_engine or os.getenv("DB_ENGINE", "sqlite")).strip().lower()
    if engine in ("postgresql", "postgres"):
        url = database_url or os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://postgres:postgres@localhost:5432/infraroute",
        )
        return PostgresDatabaseManager(database_url=url)
    if engine == "sqlite":
        caminho_sqlite = sqlite_db_path or os.getenv("SQLITE_DB_PATH", ".cache/infraroute.db")
        return SQLiteDatabaseManager(db_path=caminho_sqlite)
    raise ValueError(
        "DB_ENGINE inválido. Utilize 'postgresql' (oficial) ou 'sqlite' (fallback local)."
    )
