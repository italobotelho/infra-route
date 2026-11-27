"""
Repositório SQL Relacional (`InfraRouteSQLRepository`) implementado sobre
`DatabaseManagerBase` (POO + Python DB-API, Aulas 06 e 14).

Executa DDL, DML, DQL e transações ACID reais nas 11 tabelas normalizadas em 3FN:
- Empresa, Usuario, Engenheiro, Vincula
- Tipo_Equipamento, Tipo_Cabo
- Projeto, Ponto_Rede, Contem, Trecho_Rede, Log_Auditoria
"""

import json
from typing import Any, Dict, List, Optional, Sequence

from backend.database_manager import DatabaseManagerBase, criar_database_manager


_SCHEMA_SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS Empresa (
    ID_Empresa INTEGER PRIMARY KEY AUTOINCREMENT,
    CNPJ VARCHAR(18) NOT NULL UNIQUE,
    Razao_Social VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS Usuario (
    ID_Usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    Nome VARCHAR(255) NOT NULL,
    CPF VARCHAR(14) NOT NULL UNIQUE,
    Telefone VARCHAR(20) NOT NULL,
    Email VARCHAR(255) NOT NULL UNIQUE,
    Senha VARCHAR(255) NOT NULL,
    Email_Verificado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Engenheiro (
    ID_Usuario INTEGER PRIMARY KEY,
    CREA VARCHAR(50) NOT NULL UNIQUE,
    FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Vincula (
    ID_Usuario INTEGER NOT NULL,
    ID_Empresa INTEGER NOT NULL,
    Data_Vinculo TEXT NOT NULL DEFAULT (DATE('now')),
    Nivel_Acesso VARCHAR(30) NOT NULL CHECK (Nivel_Acesso IN ('SuperAdmin', 'Administrador', 'Projetista', 'Visualizador')),
    PRIMARY KEY (ID_Usuario, ID_Empresa),
    FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE,
    FOREIGN KEY (ID_Empresa) REFERENCES Empresa (ID_Empresa) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Tipo_Equipamento (
    ID_Tipo_Equipamento INTEGER PRIMARY KEY AUTOINCREMENT,
    Custo_Unitario NUMERIC NOT NULL CHECK (Custo_Unitario >= 0),
    Categoria VARCHAR(40) NOT NULL CHECK (Categoria IN ('Caixa de Emenda', 'CTO', 'Switch', 'Passivo de Passagem', 'Outro')),
    Fabricante VARCHAR(40) NOT NULL CHECK (Fabricante IN ('Furukawa', 'Intelbras', 'Huawei', 'Cisco', 'Outro'))
);

CREATE TABLE IF NOT EXISTS Tipo_Cabo (
    ID_Cabo INTEGER PRIMARY KEY AUTOINCREMENT,
    Descricao_Modelo VARCHAR(255) NOT NULL,
    Custo_Por_Metro NUMERIC NOT NULL CHECK (Custo_Por_Metro >= 0),
    Limite_Distancia_Metros NUMERIC NOT NULL CHECK (Limite_Distancia_Metros > 0)
);

CREATE TABLE IF NOT EXISTS Projeto (
    ID_Projeto INTEGER PRIMARY KEY AUTOINCREMENT,
    Nome VARCHAR(255) NOT NULL,
    Status VARCHAR(30) NOT NULL DEFAULT 'Em Planejamento' CHECK (Status IN ('Em Planejamento', 'Em Execução', 'Concluído', 'Cancelado')),
    Data_Criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Custo_Estimado NUMERIC NOT NULL DEFAULT 0.00 CHECK (Custo_Estimado >= 0),
    Metragem_Total NUMERIC NOT NULL DEFAULT 0.00 CHECK (Metragem_Total >= 0),
    idEmpresa INTEGER NOT NULL,
    idEngenheiro INTEGER NOT NULL,
    FOREIGN KEY (idEmpresa) REFERENCES Empresa (ID_Empresa) ON DELETE RESTRICT,
    FOREIGN KEY (idEngenheiro) REFERENCES Engenheiro (ID_Usuario) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Ponto_Rede (
    ID_Ponto INTEGER PRIMARY KEY AUTOINCREMENT,
    Descricao VARCHAR(255) NOT NULL,
    Latitude REAL NOT NULL CHECK (Latitude BETWEEN -90.0 AND 90.0),
    Longitude REAL NOT NULL CHECK (Longitude BETWEEN -180.0 AND 180.0),
    Geometria_WKT VARCHAR(128) NOT NULL,
    Status_Fisico VARCHAR(30) NOT NULL DEFAULT 'Projetado' CHECK (Status_Fisico IN ('Projetado', 'Instalado', 'Em Manutenção', 'Desativado')),
    Data_Instalacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idTipo_Equipamento INTEGER NULL,
    FOREIGN KEY (idTipo_Equipamento) REFERENCES Tipo_Equipamento (ID_Tipo_Equipamento) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Contem (
    ID_Ponto INTEGER NOT NULL,
    ID_Projeto INTEGER NOT NULL,
    Data_Inclusao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Status_Ponto VARCHAR(20) NOT NULL DEFAULT 'Ativo' CHECK (Status_Ponto IN ('Ativo', 'Inativo', 'Removido')),
    PRIMARY KEY (ID_Ponto, ID_Projeto),
    FOREIGN KEY (ID_Ponto) REFERENCES Ponto_Rede (ID_Ponto) ON DELETE CASCADE,
    FOREIGN KEY (ID_Projeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Trecho_Rede (
    ID_Trecho INTEGER PRIMARY KEY AUTOINCREMENT,
    Geometria_WKT TEXT NOT NULL,
    Caminho_JSON TEXT NULL,
    Distancia_Metros NUMERIC NOT NULL CHECK (Distancia_Metros > 0),
    Custo_Trecho NUMERIC NOT NULL DEFAULT 0.00 CHECK (Custo_Trecho >= 0),
    Origem_ID INTEGER NOT NULL,
    Destino_ID INTEGER NOT NULL,
    idProjeto INTEGER NOT NULL,
    idTipo_Cabo INTEGER NOT NULL,
    CONSTRAINT chk_nos_diferentes CHECK (Origem_ID <> Destino_ID),
    FOREIGN KEY (Origem_ID) REFERENCES Ponto_Rede (ID_Ponto) ON DELETE RESTRICT,
    FOREIGN KEY (Destino_ID) REFERENCES Ponto_Rede (ID_Ponto) ON DELETE RESTRICT,
    FOREIGN KEY (idProjeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE,
    FOREIGN KEY (idTipo_Cabo) REFERENCES Tipo_Cabo (ID_Cabo) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Log_Auditoria (
    ID_Evento INTEGER PRIMARY KEY AUTOINCREMENT,
    Timestamp_UTC TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Acao VARCHAR(80) NOT NULL,
    ID_Usuario INTEGER NULL,
    Email_Usuario VARCHAR(255) NULL,
    ID_Empresa INTEGER NULL,
    Severidade VARCHAR(20) NOT NULL DEFAULT 'INFO',
    Metodo_HTTP VARCHAR(10) NULL,
    Caminho_HTTP VARCHAR(255) NULL,
    Status_HTTP INTEGER NULL,
    Duracao_Ms REAL NULL,
    IP_Origem VARCHAR(64) NULL,
    Detalhes TEXT NOT NULL,
    FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE SET NULL,
    FOREIGN KEY (ID_Empresa) REFERENCES Empresa (ID_Empresa) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_projeto_empresa ON Projeto (idEmpresa, Status);
CREATE INDEX IF NOT EXISTS idx_ponto_rede_coords ON Ponto_Rede (Latitude, Longitude);
CREATE INDEX IF NOT EXISTS idx_contem_projeto_status ON Contem (ID_Projeto, Status_Ponto);
CREATE INDEX IF NOT EXISTS idx_trecho_rede_nodos ON Trecho_Rede (Origem_ID, Destino_ID);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_usuario ON Log_Auditoria (ID_Usuario, Acao);

CREATE TABLE IF NOT EXISTS Projeto_Participante (
    ID_Projeto INTEGER NOT NULL,
    ID_Usuario INTEGER NOT NULL,
    Papel VARCHAR(30) NOT NULL CHECK (Papel IN ('Projetista', 'Visualizador')),
    Data_Inclusao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID_Projeto, ID_Usuario),
    FOREIGN KEY (ID_Projeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE,
    FOREIGN KEY (ID_Usuario) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Convite (
    ID_Convite INTEGER PRIMARY KEY AUTOINCREMENT,
    Tipo_Convite VARCHAR(20) NOT NULL CHECK (Tipo_Convite IN ('EMPRESA', 'PROJETO')),
    ID_Empresa INTEGER NOT NULL,
    ID_Projeto INTEGER NULL,
    ID_Usuario_Convidante INTEGER NOT NULL,
    ID_Usuario_Convidado INTEGER NOT NULL,
    Nivel_Acesso VARCHAR(30) NOT NULL CHECK (Nivel_Acesso IN ('Administrador', 'Projetista', 'Visualizador')),
    Status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (Status IN ('PENDENTE', 'ACEITO', 'RECUSADO', 'CANCELADO')),
    Mensagem TEXT NULL,
    Data_Criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Data_Resposta TEXT NULL,
    FOREIGN KEY (ID_Empresa) REFERENCES Empresa (ID_Empresa) ON DELETE CASCADE,
    FOREIGN KEY (ID_Projeto) REFERENCES Projeto (ID_Projeto) ON DELETE CASCADE,
    FOREIGN KEY (ID_Usuario_Convidante) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE,
    FOREIGN KEY (ID_Usuario_Convidado) REFERENCES Usuario (ID_Usuario) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_convite_convidado_status ON Convite (ID_Usuario_Convidado, Status);
CREATE INDEX IF NOT EXISTS idx_convite_empresa_status ON Convite (ID_Empresa, Status);
"""

_SCHEMA_SQLITE_VIEW_SQL = """
DROP VIEW IF EXISTS vw_resumo_projetos_corporativos;
CREATE VIEW vw_resumo_projetos_corporativos AS
SELECT
    p.ID_Projeto,
    p.Nome AS Nome_Projeto,
    p.Status,
    p.idEmpresa AS ID_Empresa,
    p.Data_Criacao,
    e.Razao_Social AS Empresa,
    u.Nome AS Engenheiro_Responsavel,
    eng.CREA,
    p.Metragem_Total,
    p.Custo_Estimado,
    COUNT(DISTINCT CASE WHEN c.Status_Ponto = 'Ativo' THEN c.ID_Ponto END) AS Pontos_Ativos,
    COUNT(DISTINCT tr.ID_Trecho) AS Trechos_Otimizados
FROM Projeto p
INNER JOIN Empresa e ON e.ID_Empresa = p.idEmpresa
INNER JOIN Engenheiro eng ON eng.ID_Usuario = p.idEngenheiro
INNER JOIN Usuario u ON u.ID_Usuario = eng.ID_Usuario
LEFT JOIN Contem c ON c.ID_Projeto = p.ID_Projeto
LEFT JOIN Trecho_Rede tr ON tr.idProjeto = p.ID_Projeto
GROUP BY
    p.ID_Projeto,
    p.Nome,
    p.Status,
    p.idEmpresa,
    p.Data_Criacao,
    e.Razao_Social,
    u.Nome,
    eng.CREA,
    p.Metragem_Total,
    p.Custo_Estimado;
"""


class InfraRouteSQLRepository:
    """
    Camada de Acesso a Dados (Repository Pattern — Aula 04) usando `DatabaseManagerBase`.
    """

    def __init__(self, db_manager: Optional[DatabaseManagerBase] = None) -> None:
        self._db = db_manager or criar_database_manager()

    @property
    def db_manager(self) -> DatabaseManagerBase:
        return self._db

    def inicializar_estrutura_se_necessario(self) -> None:
        """
        Em SQLite local aplica o DDL espelho (`_SCHEMA_SQLITE_DDL`) e garante
        migrações aditivas de colunas/índices/views em bancos existentes.
        Em PostgreSQL + PostGIS o schema oficial é aplicado via `database/schema_postgis.sql`.
        """
        if self._db.motor == "sqlite":
            with self._db as db:
                db.execute_script(_SCHEMA_SQLITE_DDL)
                colunas_log = {
                    row["name"]
                    for row in db.fetch_all("PRAGMA table_info(Log_Auditoria)")
                }
                colunas_novas = [
                    ("ID_Empresa", "INTEGER NULL"),
                    ("Severidade", "VARCHAR(20) NOT NULL DEFAULT 'INFO'"),
                    ("Metodo_HTTP", "VARCHAR(10) NULL"),
                    ("Caminho_HTTP", "VARCHAR(255) NULL"),
                    ("Status_HTTP", "INTEGER NULL"),
                    ("Duracao_Ms", "REAL NULL"),
                    ("IP_Origem", "VARCHAR(64) NULL"),
                ]
                for nome_col, ddl_col in colunas_novas:
                    if nome_col not in colunas_log:
                        db.execute_query(
                            f"ALTER TABLE Log_Auditoria ADD COLUMN {nome_col} {ddl_col}"
                        )
                db.execute_query(
                    "CREATE INDEX IF NOT EXISTS idx_log_auditoria_empresa "
                    "ON Log_Auditoria (ID_Empresa, Timestamp_UTC)"
                )
                db.execute_script(_SCHEMA_SQLITE_VIEW_SQL)

    def banco_possui_dados_iniciais(self) -> bool:
        with self._db as db:
            row = db.fetch_one("SELECT COUNT(*) AS total FROM Empresa")
            return bool(row and int(row["total"]) > 0)

    def popular_dados_iniciais(
        self,
        *,
        empresas: Sequence[Dict[str, Any]],
        usuarios: Sequence[Dict[str, Any]],
        vinculos: Sequence[Dict[str, Any]],
        equipamentos: Sequence[Dict[str, Any]],
        cabos: Sequence[Dict[str, Any]],
        projetos: Sequence[Dict[str, Any]],
        pontos_por_projeto: Dict[int, Sequence[Dict[str, Any]]],
        trechos_por_projeto: Dict[int, Sequence[Dict[str, Any]]],
    ) -> None:
        """Popula o banco SQL de forma transacional na primeira inicialização."""
        with self._db as db:
            row = db.fetch_one("SELECT COUNT(*) AS total FROM Empresa")
            if row and int(row["total"]) > 0:
                return

            for emp in empresas:
                db.execute_query(
                    "INSERT INTO Empresa (ID_Empresa, CNPJ, Razao_Social) VALUES (%s, %s, %s)",
                    (emp["id_empresa"], emp["cnpj"], emp["razao_social"]),
                )

            for usr in usuarios:
                email_verif = (
                    bool(usr.get("email_verificado", True))
                    if self._db.motor == "postgresql"
                    else (1 if usr.get("email_verificado", True) else 0)
                )
                db.execute_query(
                    "INSERT INTO Usuario (ID_Usuario, Nome, CPF, Telefone, Email, Senha, Email_Verificado) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (
                        usr["id_usuario"],
                        usr["nome"],
                        usr["cpf"],
                        usr["telefone"],
                        usr["email"],
                        usr["senha_hash"],
                        email_verif,
                    ),
                )
                if usr.get("crea"):
                    db.execute_query(
                        "INSERT INTO Engenheiro (ID_Usuario, CREA) VALUES (%s, %s)",
                        (usr["id_usuario"], usr["crea"]),
                    )

            for vinc in vinculos:
                db.execute_query(
                    "INSERT INTO Vincula (ID_Usuario, ID_Empresa, Nivel_Acesso) VALUES (%s, %s, %s)",
                    (vinc["id_usuario"], vinc["id_empresa"], vinc["nivel_acesso"]),
                )

            for eq in equipamentos:
                db.execute_query(
                    "INSERT INTO Tipo_Equipamento (ID_Tipo_Equipamento, Custo_Unitario, Categoria, Fabricante) "
                    "VALUES (%s, %s, %s, %s)",
                    (
                        eq["id_tipo_equipamento"],
                        eq["custo_unitario"],
                        eq["categoria"],
                        eq["fabricante"],
                    ),
                )

            for cb in cabos:
                db.execute_query(
                    "INSERT INTO Tipo_Cabo (ID_Cabo, Descricao_Modelo, Custo_Por_Metro, Limite_Distancia_Metros) "
                    "VALUES (%s, %s, %s, %s)",
                    (
                        cb["id_cabo"],
                        cb["descricao_modelo"],
                        cb["custo_por_metro"],
                        cb["limite_distancia_metros"],
                    ),
                )

            for proj in projetos:
                db.execute_query(
                    "INSERT INTO Projeto (ID_Projeto, Nome, Status, Custo_Estimado, Metragem_Total, idEmpresa, idEngenheiro) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (
                        proj["id_projeto"],
                        proj["nome"],
                        proj["status"],
                        proj["custo_estimado"],
                        proj["metragem_total"],
                        proj["id_empresa"],
                        proj["id_engenheiro"],
                    ),
                )

            for id_proj, pts in pontos_por_projeto.items():
                for pt in pts:
                    wkt = f"SRID=4326;POINT({pt['longitude']:.8f} {pt['latitude']:.8f})"
                    if self._db.motor == "postgresql":
                        db.execute_query(
                            "INSERT INTO Ponto_Rede (ID_Ponto, Descricao, Geometria_Espacial, Status_Fisico, idTipo_Equipamento) "
                            "VALUES (%s, %s, ST_GeomFromEWKT(%s), %s, %s)",
                            (
                                pt["id_ponto"],
                                pt["descricao"],
                                wkt,
                                pt["status_fisico"],
                                pt.get("id_tipo_equipamento"),
                            ),
                        )
                    else:
                        db.execute_query(
                            "INSERT INTO Ponto_Rede (ID_Ponto, Descricao, Latitude, Longitude, Geometria_WKT, Status_Fisico, idTipo_Equipamento) "
                            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                            (
                                pt["id_ponto"],
                                pt["descricao"],
                                pt["latitude"],
                                pt["longitude"],
                                wkt,
                                pt["status_fisico"],
                                pt.get("id_tipo_equipamento"),
                            ),
                        )
                    db.execute_query(
                        "INSERT INTO Contem (ID_Ponto, ID_Projeto, Status_Ponto) VALUES (%s, %s, %s)",
                        (pt["id_ponto"], id_proj, pt["status_ponto"]),
                    )

            for id_proj, trs in trechos_por_projeto.items():
                for tr in trs:
                    if self._db.motor == "postgresql":
                        db.execute_query(
                            "INSERT INTO Trecho_Rede (Geometria_Linha, Caminho_JSON, Distancia_Metros, Custo_Trecho, Origem_ID, Destino_ID, idProjeto, idTipo_Cabo) "
                            "VALUES (ST_GeomFromEWKT(%s), %s, %s, %s, %s, %s, %s, %s)",
                            (
                                tr["geometria_wkt"],
                                json.dumps(tr.get("caminho_coordenadas", [])),
                                tr["distancia_metros"],
                                tr["custo_trecho"],
                                tr["origem_id"],
                                tr["destino_id"],
                                id_proj,
                                tr["id_tipo_cabo"],
                            ),
                        )
                    else:
                        db.execute_query(
                            "INSERT INTO Trecho_Rede (Geometria_WKT, Caminho_JSON, Distancia_Metros, Custo_Trecho, Origem_ID, Destino_ID, idProjeto, idTipo_Cabo) "
                            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                            (
                                tr["geometria_wkt"],
                                json.dumps(tr.get("caminho_coordenadas", [])),
                                tr["distancia_metros"],
                                tr["custo_trecho"],
                                tr["origem_id"],
                                tr["destino_id"],
                                id_proj,
                                tr["id_tipo_cabo"],
                            ),
                        )

    def carregar_estado_completo(self) -> Dict[str, Any]:
        """Carrega todas as entidades e relacionamentos diretamente das tabelas SQL."""
        eh_postgres = self._db.motor == "postgresql"
        with self._db as db:
            empresas = db.fetch_all(
                'SELECT ID_Empresa AS "ID_Empresa", CNPJ AS "CNPJ", Razao_Social AS "Razao_Social" '
                "FROM Empresa ORDER BY ID_Empresa"
            )
            usuarios = db.fetch_all(
                'SELECT u.ID_Usuario AS "ID_Usuario", u.Nome AS "Nome", u.CPF AS "CPF", '
                'u.Telefone AS "Telefone", u.Email AS "Email", u.Senha AS "Senha", '
                'u.Email_Verificado AS "Email_Verificado", e.CREA AS "CREA" '
                "FROM Usuario u "
                "LEFT JOIN Engenheiro e ON e.ID_Usuario = u.ID_Usuario "
                "ORDER BY u.ID_Usuario"
            )
            vinculos = db.fetch_all(
                'SELECT ID_Usuario AS "ID_Usuario", ID_Empresa AS "ID_Empresa", Nivel_Acesso AS "Nivel_Acesso" '
                "FROM Vincula"
            )
            equipamentos = db.fetch_all(
                'SELECT ID_Tipo_Equipamento AS "ID_Tipo_Equipamento", Custo_Unitario AS "Custo_Unitario", '
                'Categoria AS "Categoria", Fabricante AS "Fabricante" '
                "FROM Tipo_Equipamento ORDER BY ID_Tipo_Equipamento"
            )
            cabos = db.fetch_all(
                'SELECT ID_Cabo AS "ID_Cabo", Descricao_Modelo AS "Descricao_Modelo", '
                'Custo_Por_Metro AS "Custo_Por_Metro", Limite_Distancia_Metros AS "Limite_Distancia_Metros" '
                "FROM Tipo_Cabo ORDER BY ID_Cabo"
            )
            projetos = db.fetch_all(
                'SELECT ID_Projeto AS "ID_Projeto", Nome AS "Nome", Status AS "Status", '
                'Custo_Estimado AS "Custo_Estimado", Metragem_Total AS "Metragem_Total", '
                'idEmpresa AS "idEmpresa", idEngenheiro AS "idEngenheiro", '
                'Data_Criacao AS "Data_Criacao" '
                "FROM Projeto ORDER BY ID_Projeto"
            )
            if eh_postgres:
                pontos = db.fetch_all(
                    'SELECT c.ID_Projeto AS "ID_Projeto", pr.ID_Ponto AS "ID_Ponto", '
                    'pr.Descricao AS "Descricao", ST_Y(pr.Geometria_Espacial) AS "Latitude", '
                    'ST_X(pr.Geometria_Espacial) AS "Longitude", pr.Status_Fisico AS "Status_Fisico", '
                    'c.Status_Ponto AS "Status_Ponto", pr.idTipo_Equipamento AS "idTipo_Equipamento", '
                    'COALESCE(te.Custo_Unitario, 0.0) AS "Custo_Equipamento" '
                    "FROM Contem c "
                    "INNER JOIN Ponto_Rede pr ON pr.ID_Ponto = c.ID_Ponto "
                    "LEFT JOIN Tipo_Equipamento te ON te.ID_Tipo_Equipamento = pr.idTipo_Equipamento "
                    "ORDER BY c.ID_Projeto, pr.ID_Ponto"
                )
                trechos = db.fetch_all(
                    'SELECT tr.ID_Trecho AS "ID_Trecho", tr.idProjeto AS "idProjeto", '
                    'tr.Origem_ID AS "Origem_ID", tr.Destino_ID AS "Destino_ID", '
                    'po.Descricao AS "Origem_Descricao", pd.Descricao AS "Destino_Descricao", '
                    'tr.idTipo_Cabo AS "idTipo_Cabo", tc.Descricao_Modelo AS "Descricao_Modelo", '
                    'tr.Distancia_Metros AS "Distancia_Metros", tr.Custo_Trecho AS "Custo_Trecho", '
                    'ST_AsEWKT(tr.Geometria_Linha) AS "Geometria_WKT", tr.Caminho_JSON AS "Caminho_JSON" '
                    "FROM Trecho_Rede tr "
                    "INNER JOIN Ponto_Rede po ON po.ID_Ponto = tr.Origem_ID "
                    "INNER JOIN Ponto_Rede pd ON pd.ID_Ponto = tr.Destino_ID "
                    "INNER JOIN Tipo_Cabo tc ON tc.ID_Cabo = tr.idTipo_Cabo "
                    "ORDER BY tr.idProjeto, tr.ID_Trecho"
                )
            else:
                pontos = db.fetch_all(
                    'SELECT c.ID_Projeto AS "ID_Projeto", pr.ID_Ponto AS "ID_Ponto", '
                    'pr.Descricao AS "Descricao", pr.Latitude AS "Latitude", '
                    'pr.Longitude AS "Longitude", pr.Status_Fisico AS "Status_Fisico", '
                    'c.Status_Ponto AS "Status_Ponto", pr.idTipo_Equipamento AS "idTipo_Equipamento", '
                    'COALESCE(te.Custo_Unitario, 0.0) AS "Custo_Equipamento" '
                    "FROM Contem c "
                    "INNER JOIN Ponto_Rede pr ON pr.ID_Ponto = c.ID_Ponto "
                    "LEFT JOIN Tipo_Equipamento te ON te.ID_Tipo_Equipamento = pr.idTipo_Equipamento "
                    "ORDER BY c.ID_Projeto, pr.ID_Ponto"
                )
                trechos = db.fetch_all(
                    'SELECT tr.ID_Trecho AS "ID_Trecho", tr.idProjeto AS "idProjeto", '
                    'tr.Origem_ID AS "Origem_ID", tr.Destino_ID AS "Destino_ID", '
                    'po.Descricao AS "Origem_Descricao", pd.Descricao AS "Destino_Descricao", '
                    'tr.idTipo_Cabo AS "idTipo_Cabo", tc.Descricao_Modelo AS "Descricao_Modelo", '
                    'tr.Distancia_Metros AS "Distancia_Metros", tr.Custo_Trecho AS "Custo_Trecho", '
                    'tr.Geometria_WKT AS "Geometria_WKT", tr.Caminho_JSON AS "Caminho_JSON" '
                    "FROM Trecho_Rede tr "
                    "INNER JOIN Ponto_Rede po ON po.ID_Ponto = tr.Origem_ID "
                    "INNER JOIN Ponto_Rede pd ON pd.ID_Ponto = tr.Destino_ID "
                    "INNER JOIN Tipo_Cabo tc ON tc.ID_Cabo = tr.idTipo_Cabo "
                    "ORDER BY tr.idProjeto, tr.ID_Trecho"
                )
            auditoria = db.fetch_all(
                'SELECT ID_Evento AS "ID_Evento", Timestamp_UTC AS "Timestamp_UTC", '
                'Acao AS "Acao", ID_Usuario AS "ID_Usuario", Email_Usuario AS "Email_Usuario", '
                'ID_Empresa AS "ID_Empresa", Severidade AS "Severidade", '
                'Metodo_HTTP AS "Metodo_HTTP", Caminho_HTTP AS "Caminho_HTTP", '
                'Status_HTTP AS "Status_HTTP", Duracao_Ms AS "Duracao_Ms", '
                'IP_Origem AS "IP_Origem", Detalhes AS "Detalhes" '
                "FROM Log_Auditoria ORDER BY ID_Evento"
            )
            participantes_projeto = db.fetch_all(
                'SELECT ID_Projeto AS "ID_Projeto", ID_Usuario AS "ID_Usuario", '
                'Papel AS "Papel", Data_Inclusao AS "Data_Inclusao" '
                "FROM Projeto_Participante ORDER BY ID_Projeto, ID_Usuario"
            )
            convites = db.fetch_all(
                'SELECT ID_Convite AS "ID_Convite", Tipo_Convite AS "Tipo_Convite", '
                'ID_Empresa AS "ID_Empresa", ID_Projeto AS "ID_Projeto", '
                'ID_Usuario_Convidante AS "ID_Usuario_Convidante", '
                'ID_Usuario_Convidado AS "ID_Usuario_Convidado", '
                'Nivel_Acesso AS "Nivel_Acesso", Status AS "Status", '
                'Mensagem AS "Mensagem", Data_Criacao AS "Data_Criacao", '
                'Data_Resposta AS "Data_Resposta" '
                "FROM Convite ORDER BY ID_Convite ASC"
            )

        return {
            "empresas": empresas,
            "usuarios": usuarios,
            "vinculos": vinculos,
            "equipamentos": equipamentos,
            "cabos": cabos,
            "projetos": projetos,
            "pontos": pontos,
            "trechos": trechos,
            "auditoria": auditoria,
            "participantes_projeto": participantes_projeto,
            "convites": convites,
        }

    def inserir_usuario_engenheiro(
        self,
        *,
        id_usuario: int,
        nome: str,
        cpf: str,
        telefone: str,
        email: str,
        senha_hash: str,
        crea: str,
        id_empresa: int,
        nivel_acesso: str,
        cnpj_empresa: Optional[str] = None,
        razao_social_empresa: Optional[str] = None,
    ) -> None:
        email_verif = False if self._db.motor == "postgresql" else 0
        with self._db as db:
            if cnpj_empresa and razao_social_empresa:
                db.execute_query(
                    "INSERT INTO Empresa (ID_Empresa, CNPJ, Razao_Social) VALUES (%s, %s, %s)",
                    (id_empresa, cnpj_empresa, razao_social_empresa),
                )
            db.execute_query(
                "INSERT INTO Usuario (ID_Usuario, Nome, CPF, Telefone, Email, Senha, Email_Verificado) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (id_usuario, nome, cpf, telefone, email, senha_hash, email_verif),
            )
            db.execute_query(
                "INSERT INTO Engenheiro (ID_Usuario, CREA) VALUES (%s, %s)",
                (id_usuario, crea),
            )
            db.execute_query(
                "INSERT INTO Vincula (ID_Usuario, ID_Empresa, Nivel_Acesso) VALUES (%s, %s, %s)",
                (id_usuario, id_empresa, nivel_acesso),
            )

    def atualizar_email_verificado(self, id_usuario: int, verificado: bool) -> None:
        valor = bool(verificado) if self._db.motor == "postgresql" else (1 if verificado else 0)
        with self._db as db:
            db.execute_query(
                "UPDATE Usuario SET Email_Verificado = %s WHERE ID_Usuario = %s",
                (valor, id_usuario),
            )

    def inserir_convite(
        self,
        *,
        id_convite: int,
        tipo_convite: str,
        id_empresa: int,
        id_projeto: Optional[int],
        id_usuario_convidante: int,
        id_usuario_convidado: int,
        nivel_acesso: str,
        status: str,
        mensagem: Optional[str],
        data_criacao: str,
    ) -> None:
        with self._db as db:
            db.execute_query(
                "INSERT INTO Convite (ID_Convite, Tipo_Convite, ID_Empresa, ID_Projeto, "
                "ID_Usuario_Convidante, ID_Usuario_Convidado, Nivel_Acesso, Status, Mensagem, Data_Criacao) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    id_convite,
                    tipo_convite,
                    id_empresa,
                    id_projeto,
                    id_usuario_convidante,
                    id_usuario_convidado,
                    nivel_acesso,
                    status,
                    mensagem,
                    data_criacao,
                ),
            )

    def atualizar_status_convite(
        self, id_convite: int, status: str, data_resposta: str
    ) -> None:
        with self._db as db:
            db.execute_query(
                "UPDATE Convite SET Status = %s, Data_Resposta = %s WHERE ID_Convite = %s",
                (status, data_resposta, id_convite),
            )

    def inserir_ou_atualizar_vinculo(
        self, id_usuario: int, id_empresa: int, nivel_acesso: str
    ) -> None:
        with self._db as db:
            db.execute_query(
                "INSERT INTO Vincula (ID_Usuario, ID_Empresa, Nivel_Acesso) VALUES (%s, %s, %s) "
                "ON CONFLICT (ID_Usuario, ID_Empresa) DO UPDATE SET Nivel_Acesso = excluded.Nivel_Acesso",
                (id_usuario, id_empresa, nivel_acesso),
            )

    def inserir_ou_atualizar_participante_projeto(
        self, id_projeto: int, id_usuario: int, papel: str, data_inclusao: str
    ) -> None:
        with self._db as db:
            db.execute_query(
                "INSERT INTO Projeto_Participante (ID_Projeto, ID_Usuario, Papel, Data_Inclusao) "
                "VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (ID_Projeto, ID_Usuario) DO UPDATE SET Papel = excluded.Papel, Data_Inclusao = excluded.Data_Inclusao",
                (id_projeto, id_usuario, papel, data_inclusao),
            )

    def inserir_projeto(
        self,
        *,
        id_projeto: int,
        nome: str,
        status: str,
        id_empresa: int,
        id_engenheiro: int,
    ) -> None:
        with self._db as db:
            db.execute_query(
                "INSERT INTO Projeto (ID_Projeto, Nome, Status, Custo_Estimado, Metragem_Total, idEmpresa, idEngenheiro) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (id_projeto, nome, status, 0.0, 0.0, id_empresa, id_engenheiro),
            )

    def atualizar_nome_projeto(self, id_projeto: int, novo_nome: str) -> None:
        with self._db as db:
            db.execute_query(
                "UPDATE Projeto SET Nome = %s WHERE ID_Projeto = %s",
                (novo_nome, id_projeto),
            )

    def atualizar_status_projeto(self, id_projeto: int, novo_status: str) -> None:
        with self._db as db:
            db.execute_query(
                "UPDATE Projeto SET Status = %s WHERE ID_Projeto = %s",
                (novo_status, id_projeto),
            )

    def inserir_ponto_no_projeto(
        self,
        *,
        id_ponto: int,
        id_projeto: int,
        descricao: str,
        latitude: float,
        longitude: float,
        status_fisico: str,
        status_ponto: str,
        id_tipo_equipamento: Optional[int],
    ) -> None:
        wkt = f"SRID=4326;POINT({longitude:.8f} {latitude:.8f})"
        with self._db as db:
            if self._db.motor == "postgresql":
                db.execute_query(
                    "INSERT INTO Ponto_Rede (ID_Ponto, Descricao, Geometria_Espacial, Status_Fisico, idTipo_Equipamento) "
                    "VALUES (%s, %s, ST_GeomFromEWKT(%s), %s, %s)",
                    (
                        id_ponto,
                        descricao,
                        wkt,
                        status_fisico,
                        id_tipo_equipamento,
                    ),
                )
            else:
                db.execute_query(
                    "INSERT INTO Ponto_Rede (ID_Ponto, Descricao, Latitude, Longitude, Geometria_WKT, Status_Fisico, idTipo_Equipamento) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (
                        id_ponto,
                        descricao,
                        latitude,
                        longitude,
                        wkt,
                        status_fisico,
                        id_tipo_equipamento,
                    ),
                )
            db.execute_query(
                "INSERT INTO Contem (ID_Ponto, ID_Projeto, Status_Ponto) VALUES (%s, %s, %s)",
                (id_ponto, id_projeto, status_ponto),
            )

    def atualizar_coordenadas_ponto(
        self, id_ponto: int, latitude: float, longitude: float
    ) -> None:
        wkt = f"SRID=4326;POINT({longitude:.8f} {latitude:.8f})"
        with self._db as db:
            if self._db.motor == "postgresql":
                db.execute_query(
                    "UPDATE Ponto_Rede SET Geometria_Espacial = ST_GeomFromEWKT(%s) WHERE ID_Ponto = %s",
                    (wkt, id_ponto),
                )
            else:
                db.execute_query(
                    "UPDATE Ponto_Rede SET Latitude = %s, Longitude = %s, Geometria_WKT = %s WHERE ID_Ponto = %s",
                    (latitude, longitude, wkt, id_ponto),
                )

    def atualizar_ponto_rede(
        self,
        *,
        id_ponto: int,
        descricao: str,
        latitude: float,
        longitude: float,
        status_fisico: str,
        id_tipo_equipamento: Optional[int],
    ) -> None:
        wkt = f"SRID=4326;POINT({longitude:.8f} {latitude:.8f})"
        with self._db as db:
            if self._db.motor == "postgresql":
                db.execute_query(
                    "UPDATE Ponto_Rede "
                    "SET Descricao = %s, Geometria_Espacial = ST_GeomFromEWKT(%s), "
                    "Status_Fisico = %s, idTipo_Equipamento = %s "
                    "WHERE ID_Ponto = %s",
                    (descricao, wkt, status_fisico, id_tipo_equipamento, id_ponto),
                )
            else:
                db.execute_query(
                    "UPDATE Ponto_Rede "
                    "SET Descricao = %s, Latitude = %s, Longitude = %s, Geometria_WKT = %s, "
                    "Status_Fisico = %s, idTipo_Equipamento = %s "
                    "WHERE ID_Ponto = %s",
                    (descricao, latitude, longitude, wkt, status_fisico, id_tipo_equipamento, id_ponto),
                )

    def inserir_tipo_cabo(
        self,
        *,
        id_cabo: int,
        descricao_modelo: str,
        custo_por_metro: float,
        limite_distancia_metros: float,
    ) -> None:
        with self._db as db:
            db.execute_query(
                "INSERT INTO Tipo_Cabo (ID_Cabo, Descricao_Modelo, Custo_Por_Metro, Limite_Distancia_Metros) "
                "VALUES (%s, %s, %s, %s)",
                (id_cabo, descricao_modelo, custo_por_metro, limite_distancia_metros),
            )

    def atualizar_status_ponto_contem(
        self, id_projeto: int, id_ponto: int, novo_status_ponto: str
    ) -> None:
        with self._db as db:
            db.execute_query(
                "UPDATE Contem SET Status_Ponto = %s WHERE ID_Projeto = %s AND ID_Ponto = %s",
                (novo_status_ponto, id_projeto, id_ponto),
            )

    def salvar_mst_projeto_transacional(
        self,
        *,
        id_projeto: int,
        metragem_total: float,
        custo_estimado: float,
        trechos: Sequence[Dict[str, Any]],
        cabos_utilizados: Sequence[Dict[str, Any]] = (),
    ) -> None:
        """
        Persiste em transação atômica os novos trechos da AGM de Prim e atualiza
        os campos memoizados (`Metragem_Total`, `Custo_Estimado`) na tabela `Projeto`.
        """
        with self._db as db:
            for cb in cabos_utilizados:
                existente = db.fetch_one(
                    'SELECT ID_Cabo AS "ID_Cabo" FROM Tipo_Cabo WHERE ID_Cabo = %s',
                    (cb["id_cabo"],),
                )
                if existente is None:
                    db.execute_query(
                        "INSERT INTO Tipo_Cabo (ID_Cabo, Descricao_Modelo, Custo_Por_Metro, Limite_Distancia_Metros) "
                        "VALUES (%s, %s, %s, %s)",
                        (
                            cb["id_cabo"],
                            cb["descricao_modelo"],
                            cb["custo_por_metro"],
                            cb["limite_distancia_metros"],
                        ),
                    )

            db.execute_query(
                "DELETE FROM Trecho_Rede WHERE idProjeto = %s",
                (id_projeto,),
            )

            for tr in trechos:
                if self._db.motor == "postgresql":
                    db.execute_query(
                        "INSERT INTO Trecho_Rede (Geometria_Linha, Caminho_JSON, Distancia_Metros, Custo_Trecho, Origem_ID, Destino_ID, idProjeto, idTipo_Cabo) "
                        "VALUES (ST_GeomFromEWKT(%s), %s, %s, %s, %s, %s, %s, %s)",
                        (
                            tr["geometria_wkt"],
                            json.dumps(tr.get("caminho_coordenadas", [])),
                            tr["distancia_metros"],
                            tr["custo_trecho"],
                            tr["origem_id"],
                            tr["destino_id"],
                            id_projeto,
                            tr["id_tipo_cabo"],
                        ),
                    )
                else:
                    db.execute_query(
                        "INSERT INTO Trecho_Rede (Geometria_WKT, Caminho_JSON, Distancia_Metros, Custo_Trecho, Origem_ID, Destino_ID, idProjeto, idTipo_Cabo) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                        (
                            tr["geometria_wkt"],
                            json.dumps(tr.get("caminho_coordenadas", [])),
                            tr["distancia_metros"],
                            tr["custo_trecho"],
                            tr["origem_id"],
                            tr["destino_id"],
                            id_projeto,
                            tr["id_tipo_cabo"],
                        ),
                    )

            db.execute_query(
                "UPDATE Projeto SET Metragem_Total = %s, Custo_Estimado = %s WHERE ID_Projeto = %s",
                (metragem_total, custo_estimado, id_projeto),
            )

    def inserir_evento_auditoria(
        self,
        *,
        acao: str,
        detalhes: str,
        id_usuario: Optional[int],
        email_usuario: Optional[str],
        timestamp_utc: str,
        id_empresa: Optional[int] = None,
        severidade: str = "INFO",
        metodo_http: Optional[str] = None,
        caminho_http: Optional[str] = None,
        status_http: Optional[int] = None,
        duracao_ms: Optional[float] = None,
        ip_origem: Optional[str] = None,
    ) -> int:
        with self._db as db:
            return db.execute_commit(
                "INSERT INTO Log_Auditoria "
                "(Timestamp_UTC, Acao, ID_Usuario, Email_Usuario, ID_Empresa, Severidade, "
                "Metodo_HTTP, Caminho_HTTP, Status_HTTP, Duracao_Ms, IP_Origem, Detalhes) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    timestamp_utc,
                    acao,
                    id_usuario,
                    email_usuario,
                    id_empresa,
                    severidade,
                    metodo_http,
                    caminho_http,
                    status_http,
                    duracao_ms,
                    ip_origem,
                    detalhes,
                ),
            )

    def atualizar_telemetria_evento_auditoria(
        self,
        *,
        id_evento: int,
        status_http: Optional[int],
        duracao_ms: Optional[float],
    ) -> None:
        with self._db as db:
            db.execute_query(
                "UPDATE Log_Auditoria SET Status_HTTP = %s, Duracao_Ms = %s WHERE ID_Evento = %s",
                (status_http, duracao_ms, id_evento),
            )

    def obter_resumo_saude_sql(self, id_empresa: Optional[int] = None) -> Dict[str, Any]:
        """Executa DQL real sobre a VIEW e tabelas para comprovar conectividade ativa (com escopo Multi-Tenant)."""
        with self._db as db:
            if id_empresa is not None:
                empresas = db.fetch_one(
                    'SELECT COUNT(*) AS "total" FROM Empresa WHERE ID_Empresa = %s',
                    (id_empresa,),
                )
                usuarios = db.fetch_one(
                    'SELECT COUNT(DISTINCT ID_Usuario) AS "total" FROM Vincula WHERE ID_Empresa = %s',
                    (id_empresa,),
                )
                projetos = db.fetch_one(
                    'SELECT COUNT(*) AS "total" FROM Projeto WHERE idEmpresa = %s',
                    (id_empresa,),
                )
                pontos = db.fetch_one(
                    'SELECT COUNT(DISTINCT c.ID_Ponto) AS "total" '
                    "FROM Contem c INNER JOIN Projeto p ON p.ID_Projeto = c.ID_Projeto "
                    "WHERE p.idEmpresa = %s",
                    (id_empresa,),
                )
                trechos = db.fetch_one(
                    'SELECT COUNT(*) AS "total" '
                    "FROM Trecho_Rede tr INNER JOIN Projeto p ON p.ID_Projeto = tr.idProjeto "
                    "WHERE p.idEmpresa = %s",
                    (id_empresa,),
                )
                resumo_view = db.fetch_all(
                    'SELECT ID_Projeto AS "ID_Projeto", Nome_Projeto AS "Nome_Projeto", '
                    'Status AS "Status", ID_Empresa AS "ID_Empresa", Empresa AS "Empresa", '
                    'Pontos_Ativos AS "Pontos_Ativos", Trechos_Otimizados AS "Trechos_Otimizados", '
                    'Metragem_Total AS "Metragem_Total", Custo_Estimado AS "Custo_Estimado" '
                    "FROM vw_resumo_projetos_corporativos WHERE ID_Empresa = %s ORDER BY ID_Projeto",
                    (id_empresa,),
                )
            else:
                empresas = db.fetch_one('SELECT COUNT(*) AS "total" FROM Empresa')
                usuarios = db.fetch_one('SELECT COUNT(*) AS "total" FROM Usuario')
                projetos = db.fetch_one('SELECT COUNT(*) AS "total" FROM Projeto')
                pontos = db.fetch_one('SELECT COUNT(*) AS "total" FROM Ponto_Rede')
                trechos = db.fetch_one('SELECT COUNT(*) AS "total" FROM Trecho_Rede')
                resumo_view = db.fetch_all(
                    'SELECT ID_Projeto AS "ID_Projeto", Nome_Projeto AS "Nome_Projeto", '
                    'Status AS "Status", ID_Empresa AS "ID_Empresa", Empresa AS "Empresa", '
                    'Pontos_Ativos AS "Pontos_Ativos", Trechos_Otimizados AS "Trechos_Otimizados", '
                    'Metragem_Total AS "Metragem_Total", Custo_Estimado AS "Custo_Estimado" '
                    "FROM vw_resumo_projetos_corporativos ORDER BY ID_Projeto"
                )
        return {
            "status": "connected",
            "motor": self._db.motor,
            "destino": self._db.destino,
            "escopo_tenant": id_empresa if id_empresa is not None else "global",
            "tabelas": {
                "empresas": int(empresas["total"]) if empresas else 0,
                "usuarios": int(usuarios["total"]) if usuarios else 0,
                "projetos": int(projetos["total"]) if projetos else 0,
                "pontos_rede": int(pontos["total"]) if pontos else 0,
                "trechos_rede": int(trechos["total"]) if trechos else 0,
            },
            "vw_resumo_projetos": resumo_view,
        }
