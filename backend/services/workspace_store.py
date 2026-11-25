"""
Serviço de Orquestração de Projetos, Autenticação e Persistência em Memória
(pré-populado com os dados de `database/seed.sql` e `index.html`).

Conecta `GovernancaMultiTenantService` e `GrafoTopologicoOptico` para prover
todas as operações consumidas pelas telas `login.html` e `index.html`.
"""

from contextvars import ContextVar
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from backend.repositories.sql_repository import InfraRouteSQLRepository
from backend.services.exceptions import (
    NaoAutenticadoError,
    PermissaoInsuficienteError,
    RecursoNaoEncontradoError,
    ValidacaoDominioError,
    ViolacaoMultiTenantError,
)
from backend.services.security_service import (
    GerenciadorVerificacaoEmail,
    LimitadorTentativasLogin,
    agora_utc_iso,
    decodificar_token_acesso,
    gerenciador_tickets_stream,
    gerar_hash_senha,
    gerar_token_acesso,
    mascarar_ip_lgpd,
    normalizar_timestamp_utc_iso,
    revogador_tokens,
    validar_forca_senha,
    verificar_senha,
)
from backend.services.governanca_service import (
    Empresa,
    GovernancaMultiTenantService,
    NivelAcessoRBAC,
    ProjetoDominio,
    StatusProjetoEnum,
    Usuario,
    VinculoCorporate,
)
from backend.services.prim_service import (
    ArestaCandidata,
    CategoriaEquipamento,
    FabricanteEquipamento,
    GrafoTopologicoOptico,
    PontoRede,
    ResultadoMSTProjeto,
    StatusFisicoPonto,
    StatusPontoProjeto,
    TipoCabo,
    TipoEquipamento,
    TrechoRedeMST,
    gerar_arestas_candidatas_viarias,
)


_HASH_SENHA_SEED_PADRAO: str = gerar_hash_senha("123456")


@dataclass(frozen=True)
class SessaoAutenticada:
    id_usuario: int
    nome: str
    email: str
    crea: Optional[str]
    eh_engenheiro: bool
    id_empresa_padrao: int
    razao_social_empresa: str
    nivel_acesso: str
    access_token: str = field(default="", compare=False)
    token_type: str = field(default="bearer", compare=False)
    email_verificado: bool = field(default=True, compare=False)
    codigo_verificacao_dev: Optional[str] = field(default=None, compare=False)


@dataclass(frozen=True)
class EventoAuditoria:
    id_evento: int
    timestamp_utc: str
    acao: str
    id_usuario: Optional[int]
    email_usuario: Optional[str]
    detalhes: str
    id_empresa: Optional[int] = None
    severidade: str = "INFO"
    nome_usuario: Optional[str] = None
    papel_rbac: Optional[str] = None
    razao_social_empresa: Optional[str] = None
    metodo_http: Optional[str] = None
    caminho_http: Optional[str] = None
    status_http: Optional[int] = None
    duracao_ms: Optional[float] = None
    ip_origem: Optional[str] = None


_CTX_HTTP_TELEMETRIA: ContextVar[Optional[Dict[str, Any]]] = ContextVar(
    "_ctx_http_telemetria",
    default=None,
)


_ACOES_AUDITORIA_ALERTA = {
    "LOGIN_FALHA",
    "ACESSO_NEGADO_RBAC",
    "VIOLACAO_MULTI_TENANT",
    "BLOQUEIO_INTEGRIDADE",
    "AUTENTICACAO_NEGADA",
    "LIMITE_REQUISICOES",
}


class WorkspaceStoreService:
    """
    Orquestra o ciclo de vida completo de autenticação, projetos, pontos de rede
    e cálculo da Árvore Geradora Mínima (Algoritmo de Prim).
    """

    _ARQUIVO_DEV_USUARIOS = Path(".cache/dev_users.json")
    _ARQUIVO_DEV_WORKSPACE = Path(".cache/dev_workspace.json")

    def __init__(
        self,
        persistir_arquivo: bool = False,
        persistir_banco: bool = False,
        sql_repo: Optional[InfraRouteSQLRepository] = None,
    ) -> None:
        self._persistir_arquivo = persistir_arquivo
        self._persistir_banco = False
        self._em_inicializacao = False
        self._sql_repo: Optional[InfraRouteSQLRepository] = (
            sql_repo if sql_repo is not None else (InfraRouteSQLRepository() if persistir_banco else None)
        )
        self.resetar_estado_padrao()
        if self._persistir_arquivo:
            self._carregar_usuarios_dev()
            self._carregar_workspace_dev()
        self._persistir_banco = persistir_banco
        if self._persistir_banco and self._sql_repo is not None:
            self._inicializar_e_sincronizar_banco_sql()

    def _inicializar_e_sincronizar_banco_sql(self) -> None:
        if self._sql_repo is None:
            return
        self._sql_repo.inicializar_estrutura_se_necessario()
        if not self._sql_repo.banco_possui_dados_iniciais():
            self._sql_repo.popular_dados_iniciais(
                empresas=[
                    {
                        "id_empresa": e.id_empresa,
                        "cnpj": e.cnpj,
                        "razao_social": e.razao_social,
                    }
                    for e in self.empresas.values()
                ],
                usuarios=[
                    {
                        "id_usuario": u.id_usuario,
                        "nome": u.nome,
                        "cpf": u.cpf,
                        "telefone": u.telefone,
                        "email": u.email,
                        "crea": u.crea,
                        "senha_hash": self._senhas_usuarios.get(u.id_usuario, _HASH_SENHA_SEED_PADRAO),
                        "email_verificado": self._emails_verificados.get(u.id_usuario, True),
                    }
                    for u in self.usuarios.values()
                ],
                vinculos=[
                    {
                        "id_usuario": v.id_usuario,
                        "id_empresa": v.id_empresa,
                        "nivel_acesso": v.nivel_acesso.value,
                    }
                    for v in self.vinculos
                ],
                equipamentos=[
                    {
                        "id_tipo_equipamento": eq.id_tipo_equipamento,
                        "categoria": eq.categoria,
                        "fabricante": eq.fabricante,
                        "custo_unitario": eq.custo_unitario,
                    }
                    for eq in self.catalogo_equipamentos.values()
                ],
                cabos=[
                    {
                        "id_cabo": cb.id_cabo,
                        "descricao_modelo": cb.descricao_modelo,
                        "custo_por_metro": cb.custo_por_metro,
                        "limite_distancia_metros": cb.limite_distancia_metros,
                    }
                    for cb in self.catalogo_cabos.values()
                ],
                projetos=[
                    {
                        "id_projeto": p.id_projeto,
                        "nome": p.nome,
                        "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                        "custo_estimado": p.custo_estimado,
                        "metragem_total": p.metragem_total,
                        "id_empresa": p.id_empresa,
                        "id_engenheiro": p.id_engenheiro,
                    }
                    for p in self.projetos.values()
                ],
                pontos_por_projeto={
                    pid: [
                        {
                            "id_ponto": pt.id_ponto,
                            "descricao": pt.descricao,
                            "latitude": pt.latitude,
                            "longitude": pt.longitude,
                            "status_fisico": pt.status_fisico,
                            "status_ponto": pt.status_ponto,
                            "id_tipo_equipamento": pt.id_tipo_equipamento,
                        }
                        for pt in pts
                    ]
                    for pid, pts in self.pontos_por_projeto.items()
                },
                trechos_por_projeto={
                    pid: [
                        {
                            "origem_id": tr.origem_id,
                            "destino_id": tr.destino_id,
                            "id_tipo_cabo": tr.id_tipo_cabo,
                            "distancia_metros": tr.distancia_metros,
                            "custo_trecho": tr.custo_trecho,
                            "geometria_wkt": tr.geometria_wkt,
                            "caminho_coordenadas": list(tr.caminho_coordenadas),
                        }
                        for tr in trs
                    ]
                    for pid, trs in self.trechos_por_projeto.items()
                },
            )
            return

        estado = self._sql_repo.carregar_estado_completo()
        self.empresas = {
            int(row["ID_Empresa"]): Empresa(
                id_empresa=int(row["ID_Empresa"]),
                cnpj=row["CNPJ"],
                razao_social=row["Razao_Social"],
            )
            for row in estado["empresas"]
        }
        self.usuarios = {}
        self._senhas_usuarios = {}
        self._emails_verificados = {}
        for row in estado["usuarios"]:
            uid = int(row["ID_Usuario"])
            self.usuarios[uid] = Usuario(
                id_usuario=uid,
                nome=row["Nome"],
                cpf=row["CPF"],
                telefone=row["Telefone"],
                email=row["Email"],
                crea=row.get("CREA"),
            )
            self._senhas_usuarios[uid] = row["Senha"]
            self._emails_verificados[uid] = bool(row.get("Email_Verificado", True))

        self.vinculos = [
            VinculoCorporate(
                id_usuario=int(row["ID_Usuario"]),
                id_empresa=int(row["ID_Empresa"]),
                nivel_acesso=NivelAcessoRBAC(row["Nivel_Acesso"]),
            )
            for row in estado["vinculos"]
        ]
        self.governanca = GovernancaMultiTenantService(
            empresas=list(self.empresas.values()),
            usuarios=list(self.usuarios.values()),
            vinculos=self.vinculos,
        )

        self.catalogo_equipamentos = {
            int(row["ID_Tipo_Equipamento"]): TipoEquipamento(
                id_tipo_equipamento=int(row["ID_Tipo_Equipamento"]),
                categoria=row["Categoria"],
                fabricante=row["Fabricante"],
                custo_unitario=float(row["Custo_Unitario"]),
            )
            for row in estado["equipamentos"]
        }
        self.catalogo_cabos = {
            int(row["ID_Cabo"]): TipoCabo(
                id_cabo=int(row["ID_Cabo"]),
                descricao_modelo=row["Descricao_Modelo"],
                custo_por_metro=float(row["Custo_Por_Metro"]),
                limite_distancia_metros=float(row["Limite_Distancia_Metros"]),
            )
            for row in estado["cabos"]
        }
        self.projetos = {
            int(row["ID_Projeto"]): ProjetoDominio(
                id_projeto=int(row["ID_Projeto"]),
                nome=row["Nome"],
                id_empresa=int(row["idEmpresa"]),
                id_engenheiro=int(row["idEngenheiro"]),
                status=StatusProjetoEnum(row["Status"]),
                custo_estimado=float(row["Custo_Estimado"]),
                metragem_total=float(row["Metragem_Total"]),
                data_criacao=normalizar_timestamp_utc_iso(row.get("Data_Criacao")),
            )
            for row in estado["projetos"]
        }
        self.pontos_por_projeto = {pid: [] for pid in self.projetos}
        for row in estado["pontos"]:
            pid = int(row["ID_Projeto"])
            self.pontos_por_projeto.setdefault(pid, []).append(
                PontoRede(
                    id_ponto=int(row["ID_Ponto"]),
                    descricao=row["Descricao"],
                    latitude=float(row["Latitude"]),
                    longitude=float(row["Longitude"]),
                    status_fisico=row["Status_Fisico"],
                    status_ponto=row["Status_Ponto"],
                    id_tipo_equipamento=row.get("idTipo_Equipamento"),
                    custo_equipamento=float(row.get("Custo_Equipamento", 0.0)),
                )
            )
        self.trechos_por_projeto = {pid: [] for pid in self.projetos}
        for row in estado["trechos"]:
            pid = int(row["idProjeto"])
            caminho = []
            if row.get("Caminho_JSON"):
                try:
                    caminho = json.loads(row["Caminho_JSON"]) if isinstance(row["Caminho_JSON"], str) else list(row["Caminho_JSON"])
                except Exception:
                    caminho = []
            self.trechos_por_projeto.setdefault(pid, []).append(
                TrechoRedeMST(
                    id_trecho=int(row["ID_Trecho"]),
                    origem_id=int(row["Origem_ID"]),
                    origem_descricao=row["Origem_Descricao"],
                    destino_id=int(row["Destino_ID"]),
                    destino_descricao=row["Destino_Descricao"],
                    id_projeto=pid,
                    id_tipo_cabo=int(row["idTipo_Cabo"]),
                    modelo_cabo=row["Descricao_Modelo"],
                    distancia_metros=float(row["Distancia_Metros"]),
                    custo_trecho=float(row["Custo_Trecho"]),
                    geometria_wkt=row["Geometria_WKT"],
                    caminho_coordenadas=caminho,
                )
            )
        self.trilha_auditoria = []
        for row in estado["auditoria"]:
            uid_ev = row.get("ID_Usuario")
            emp_ev = row.get("ID_Empresa") if row.get("ID_Empresa") is not None else self._obter_empresa_usuario(uid_ev)
            acao_ev = row["Acao"]
            self.trilha_auditoria.append(
                EventoAuditoria(
                    id_evento=int(row["ID_Evento"]),
                    timestamp_utc=normalizar_timestamp_utc_iso(str(row["Timestamp_UTC"])),
                    acao=acao_ev,
                    id_usuario=uid_ev,
                    email_usuario=row.get("Email_Usuario"),
                    detalhes=row["Detalhes"],
                    id_empresa=emp_ev,
                    severidade=row.get("Severidade") or self._classificar_severidade_evento(acao_ev),
                    nome_usuario=self._obter_nome_usuario(uid_ev),
                    papel_rbac=self._obter_papel_usuario(uid_ev),
                    razao_social_empresa=self._obter_razao_social_empresa(emp_ev),
                    metodo_http=row.get("Metodo_HTTP"),
                    caminho_http=row.get("Caminho_HTTP"),
                    status_http=int(row["Status_HTTP"]) if row.get("Status_HTTP") is not None else None,
                    duracao_ms=float(row["Duracao_Ms"]) if row.get("Duracao_Ms") is not None else None,
                    ip_origem=row.get("IP_Origem"),
                )
            )
        self._proximo_id_auditoria = max((ev.id_evento for ev in self.trilha_auditoria), default=0) + 1
        self._proximo_id_projeto = max(self.projetos.keys(), default=0) + 1
        max_ponto = max(
            (pt.id_ponto for pts in self.pontos_por_projeto.values() for pt in pts),
            default=399,
        )
        self._proximo_id_ponto = max(400, max_ponto + 1)

    def obter_saude_banco(self, id_usuario_autor: Optional[int] = None) -> Dict[str, object]:
        id_empresa_escopo: Optional[int] = None
        if id_usuario_autor is not None:
            vinculo = self.governanca.validar_acesso_auditoria(id_usuario_autor)
            if vinculo.nivel_acesso != NivelAcessoRBAC.SUPER_ADMIN:
                id_empresa_escopo = vinculo.id_empresa

        if self._sql_repo is not None:
            return self._sql_repo.obter_resumo_saude_sql(id_empresa=id_empresa_escopo)

        projetos_escopo = [
            p
            for p in self.projetos.values()
            if id_empresa_escopo is None or p.id_empresa == id_empresa_escopo
        ]
        empresas_count = len(self.empresas) if id_empresa_escopo is None else (1 if id_empresa_escopo in self.empresas else 0)
        usuarios_count = (
            len(self.usuarios)
            if id_empresa_escopo is None
            else len({v.id_usuario for v in self.vinculos if v.id_empresa == id_empresa_escopo})
        )
        return {
            "status": "memory_only",
            "motor": "in-memory",
            "destino": "memory",
            "escopo_tenant": id_empresa_escopo if id_empresa_escopo is not None else "global",
            "tabelas": {
                "empresas": empresas_count,
                "usuarios": usuarios_count,
                "projetos": len(projetos_escopo),
                "pontos_rede": sum(len(self.pontos_por_projeto.get(p.id_projeto, [])) for p in projetos_escopo),
                "trechos_rede": sum(len(self.trechos_por_projeto.get(p.id_projeto, [])) for p in projetos_escopo),
            },
            "vw_resumo_projetos": [],
        }

    def _salvar_usuarios_dev(self) -> None:
        if not self._persistir_arquivo:
            return
        try:
            self._ARQUIVO_DEV_USUARIOS.parent.mkdir(parents=True, exist_ok=True)
            registros = []
            for uid, usr in self.usuarios.items():
                if uid <= 5:
                    continue
                registros.append(
                    {
                        "id_usuario": usr.id_usuario,
                        "nome": usr.nome,
                        "cpf": usr.cpf,
                        "telefone": usr.telefone,
                        "email": usr.email,
                        "crea": usr.crea,
                        "senha_hash": self._senhas_usuarios.get(uid, ""),
                        "email_verificado": self._emails_verificados.get(uid, False),
                    }
                )
            self._ARQUIVO_DEV_USUARIOS.write_text(
                json.dumps(registros, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

    def _carregar_usuarios_dev(self) -> None:
        if not self._persistir_arquivo or not self._ARQUIVO_DEV_USUARIOS.exists():
            return
        try:
            dados = json.loads(self._ARQUIVO_DEV_USUARIOS.read_text(encoding="utf-8"))
            for item in dados:
                uid = int(item["id_usuario"])
                if uid in self.usuarios:
                    continue
                usr = Usuario(
                    id_usuario=uid,
                    nome=item["nome"],
                    cpf=item["cpf"],
                    telefone=item["telefone"],
                    email=item["email"],
                    crea=item.get("crea"),
                )
                vinculo = VinculoCorporate(
                    id_usuario=uid,
                    id_empresa=1,
                    nivel_acesso=NivelAcessoRBAC.PROJETISTA,
                )
                self.usuarios[uid] = usr
                self._senhas_usuarios[uid] = item["senha_hash"]
                self._emails_verificados[uid] = bool(item.get("email_verificado", False))
                self.vinculos.append(vinculo)
                self.governanca.usuarios[uid] = usr
                self.governanca.vinculos[(uid, 1)] = vinculo
        except Exception:
            pass

    def _salvar_workspace_dev(self) -> None:
        if not self._persistir_arquivo:
            return
        try:
            self._ARQUIVO_DEV_WORKSPACE.parent.mkdir(parents=True, exist_ok=True)
            dados = {
                "proximo_id_projeto": self._proximo_id_projeto,
                "proximo_id_ponto": self._proximo_id_ponto,
                "projetos": [
                    {
                        "id_projeto": p.id_projeto,
                        "nome": p.nome,
                        "id_empresa": p.id_empresa,
                        "id_engenheiro": p.id_engenheiro,
                        "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                        "metragem_total": p.metragem_total,
                        "custo_estimado": p.custo_estimado,
                    }
                    for p in self.projetos.values()
                ],
                "pontos_por_projeto": {
                    str(pid): [
                        {
                            "id_ponto": pt.id_ponto,
                            "descricao": pt.descricao,
                            "latitude": pt.latitude,
                            "longitude": pt.longitude,
                            "status_fisico": pt.status_fisico,
                            "status_ponto": pt.status_ponto,
                            "id_tipo_equipamento": pt.id_tipo_equipamento,
                            "custo_equipamento": pt.custo_equipamento,
                        }
                        for pt in pts
                    ]
                    for pid, pts in self.pontos_por_projeto.items()
                },
                "trechos_por_projeto": {
                    str(pid): [
                        {
                            "id_trecho": tr.id_trecho,
                            "origem_id": tr.origem_id,
                            "origem_descricao": tr.origem_descricao,
                            "destino_id": tr.destino_id,
                            "destino_descricao": tr.destino_descricao,
                            "id_projeto": tr.id_projeto,
                            "id_tipo_cabo": tr.id_tipo_cabo,
                            "modelo_cabo": tr.modelo_cabo,
                            "distancia_metros": tr.distancia_metros,
                            "custo_trecho": tr.custo_trecho,
                            "geometria_wkt": tr.geometria_wkt,
                            "caminho_coordenadas": list(tr.caminho_coordenadas),
                        }
                        for tr in trs
                    ]
                    for pid, trs in self.trechos_por_projeto.items()
                },
            }
            self._ARQUIVO_DEV_WORKSPACE.write_text(
                json.dumps(dados, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

    def _carregar_workspace_dev(self) -> None:
        if not self._persistir_arquivo or not self._ARQUIVO_DEV_WORKSPACE.exists():
            return
        try:
            dados = json.loads(self._ARQUIVO_DEV_WORKSPACE.read_text(encoding="utf-8"))
            self._proximo_id_projeto = max(
                self._proximo_id_projeto, int(dados.get("proximo_id_projeto", 3))
            )
            self._proximo_id_ponto = max(
                self._proximo_id_ponto, int(dados.get("proximo_id_ponto", 300))
            )
            for item in dados.get("projetos", []):
                pid = int(item["id_projeto"])
                self.projetos[pid] = ProjetoDominio(
                    id_projeto=pid,
                    nome=item["nome"],
                    id_empresa=int(item["id_empresa"]),
                    id_engenheiro=int(item["id_engenheiro"]),
                    status=StatusProjetoEnum(item["status"]),
                    metragem_total=float(item.get("metragem_total", 0.0)),
                    custo_estimado=float(item.get("custo_estimado", 0.0)),
                )
            for pid_str, pts in dados.get("pontos_por_projeto", {}).items():
                pid = int(pid_str)
                self.pontos_por_projeto[pid] = [
                    PontoRede(
                        id_ponto=int(pt["id_ponto"]),
                        descricao=pt["descricao"],
                        latitude=float(pt["latitude"]),
                        longitude=float(pt["longitude"]),
                        status_fisico=pt["status_fisico"],
                        status_ponto=pt["status_ponto"],
                        id_tipo_equipamento=pt.get("id_tipo_equipamento"),
                        custo_equipamento=float(pt.get("custo_equipamento", 0.0)),
                    )
                    for pt in pts
                ]
            for pid_str, trs in dados.get("trechos_por_projeto", {}).items():
                pid = int(pid_str)
                self.trechos_por_projeto[pid] = [
                    TrechoRedeMST(
                        id_trecho=int(tr["id_trecho"]),
                        origem_id=int(tr["origem_id"]),
                        origem_descricao=tr["origem_descricao"],
                        destino_id=int(tr["destino_id"]),
                        destino_descricao=tr["destino_descricao"],
                        id_projeto=int(tr["id_projeto"]),
                        id_tipo_cabo=int(tr["id_tipo_cabo"]),
                        modelo_cabo=tr["modelo_cabo"],
                        distancia_metros=float(tr["distancia_metros"]),
                        custo_trecho=float(tr["custo_trecho"]),
                        geometria_wkt=tr["geometria_wkt"],
                        caminho_coordenadas=list(tr.get("caminho_coordenadas", [])),
                    )
                    for tr in trs
                ]
        except Exception:
            pass

    def resetar_estado_padrao(self) -> None:
        """Restaura o estado inicial alinhado ao `database/seed.sql` com 4 perfis Multi-Tenant/RBAC."""
        self._em_inicializacao = True
        try:
            self.empresas: Dict[int, Empresa] = {
                1: Empresa(
                    id_empresa=1,
                    cnpj="12.345.678/0001-90",
                    razao_social="InfraTelecom Engenharia Óptica S.A.",
                ),
                2: Empresa(
                    id_empresa=2,
                    cnpj="98.765.432/0001-10",
                    razao_social="ConectaSul Fibra Ltda.",
                ),
            }

            self.usuarios: Dict[int, Usuario] = {
                1: Usuario(
                    id_usuario=1,
                    nome="Engenheiro Responsável",
                    cpf="123.456.789-00",
                    telefone="(19) 99999-0000",
                    email="engenheiro@empresa.com.br",
                    crea="SP-5060708090",
                ),
                2: Usuario(
                    id_usuario=2,
                    nome="Analista Visualizador",
                    cpf="234.567.890-11",
                    telefone="(19) 98888-1111",
                    email="auditor@empresa.com.br",
                    crea=None,
                ),
                3: Usuario(
                    id_usuario=3,
                    nome="Eng. Marina Alves",
                    cpf="345.678.901-22",
                    telefone="(19) 98765-4321",
                    email="projetista@empresa.com.br",
                    crea="SP-50887766",
                ),
                4: Usuario(
                    id_usuario=4,
                    nome="Eng. Helena Costa",
                    cpf="456.789.012-33",
                    telefone="(41) 99123-4567",
                    email="gestor@conectasul.com.br",
                    crea="PR-40112233",
                ),
                5: Usuario(
                    id_usuario=5,
                    nome="Auditor SecOps Global",
                    cpf="567.890.123-44",
                    telefone="(11) 99000-0001",
                    email="secops@infraroute.com.br",
                    crea=None,
                ),
            }

            # Armazena exclusivamente hashes bcrypt ($2b$12$...) das senhas dos colaboradores
            self._senhas_usuarios: Dict[int, str] = {
                1: _HASH_SENHA_SEED_PADRAO,
                2: _HASH_SENHA_SEED_PADRAO,
                3: _HASH_SENHA_SEED_PADRAO,
                4: _HASH_SENHA_SEED_PADRAO,
                5: _HASH_SENHA_SEED_PADRAO,
            }
            self._emails_verificados: Dict[int, bool] = {
                1: True,
                2: True,
                3: True,
                4: True,
                5: True,
            }
            self.limitador_login = LimitadorTentativasLogin()
            self.verificador_email = GerenciadorVerificacaoEmail()
            self.trilha_auditoria: List[EventoAuditoria] = []
            self._proximo_id_auditoria: int = 1
            revogador_tokens.limpar()
            gerenciador_tickets_stream.limpar()

            self.vinculos: List[VinculoCorporate] = [
                VinculoCorporate(
                    id_usuario=1,
                    id_empresa=1,
                    nivel_acesso=NivelAcessoRBAC.ADMINISTRADOR,
                ),
                VinculoCorporate(
                    id_usuario=2,
                    id_empresa=1,
                    nivel_acesso=NivelAcessoRBAC.VISUALIZADOR,
                ),
                VinculoCorporate(
                    id_usuario=3,
                    id_empresa=1,
                    nivel_acesso=NivelAcessoRBAC.PROJETISTA,
                ),
                VinculoCorporate(
                    id_usuario=4,
                    id_empresa=2,
                    nivel_acesso=NivelAcessoRBAC.ADMINISTRADOR,
                ),
                VinculoCorporate(
                    id_usuario=5,
                    id_empresa=1,
                    nivel_acesso=NivelAcessoRBAC.SUPER_ADMIN,
                ),
            ]

            self.governanca = GovernancaMultiTenantService(
                empresas=list(self.empresas.values()),
                usuarios=list(self.usuarios.values()),
                vinculos=self.vinculos,
            )

            # Catálogos em 3FN (Seções 2.9 e 2.10)
            self.catalogo_equipamentos: Dict[int, TipoEquipamento] = {
                1: TipoEquipamento(
                    id_tipo_equipamento=1,
                    categoria=CategoriaEquipamento.CTO.value,
                    fabricante=FabricanteEquipamento.FURUKAWA.value,
                    custo_unitario=380.00,
                ),
                2: TipoEquipamento(
                    id_tipo_equipamento=2,
                    categoria=CategoriaEquipamento.CAIXA_DE_EMENDA.value,
                    fabricante=FabricanteEquipamento.FURUKAWA.value,
                    custo_unitario=520.00,
                ),
                3: TipoEquipamento(
                    id_tipo_equipamento=3,
                    categoria=CategoriaEquipamento.SWITCH.value,
                    fabricante=FabricanteEquipamento.HUAWEI.value,
                    custo_unitario=2450.00,
                ),
            }

            self.catalogo_cabos: Dict[int, TipoCabo] = {
                1: TipoCabo(
                    id_cabo=1,
                    descricao_modelo="Fibra AS-80 12FO",
                    custo_por_metro=4.50,
                    limite_distancia_metros=2000.00,
                ),
                2: TipoCabo(
                    id_cabo=2,
                    descricao_modelo="Fibra AS-120 24FO",
                    custo_por_metro=6.80,
                    limite_distancia_metros=5000.00,
                ),
            }

            seed_criacao = agora_utc_iso()
            self.projetos: Dict[int, ProjetoDominio] = {
                1: ProjetoDominio(
                    id_projeto=1,
                    nome="Expansão Distrito Industrial",
                    id_empresa=1,
                    id_engenheiro=1,
                    status=StatusProjetoEnum.EM_PLANEJAMENTO,
                    data_criacao=seed_criacao,
                ),
                2: ProjetoDominio(
                    id_projeto=2,
                    nome="Malha Centro Histórico",
                    id_empresa=1,
                    id_engenheiro=1,
                    status=StatusProjetoEnum.EM_EXECUCAO,
                    data_criacao=seed_criacao,
                ),
                3: ProjetoDominio(
                    id_projeto=3,
                    nome="Backbone Sul Curitiba",
                    id_empresa=2,
                    id_engenheiro=4,
                    status=StatusProjetoEnum.EM_PLANEJAMENTO,
                    data_criacao=seed_criacao,
                ),
            }

            self.pontos_por_projeto: Dict[int, List[PontoRede]] = {
                1: [
                    PontoRede(
                        id_ponto=101,
                        descricao="Ponto #101 (POP Central)",
                        latitude=-22.7045,
                        longitude=-46.9852,
                        status_fisico=StatusFisicoPonto.INSTALADO.value,
                        status_ponto=StatusPontoProjeto.ATIVO.value,
                        id_tipo_equipamento=3,
                        custo_equipamento=2450.00,
                    ),
                    PontoRede(
                        id_ponto=102,
                        descricao="Ponto #102 (Poste Concreto)",
                        latitude=-22.7054,
                        longitude=-46.9845,
                        status_fisico=StatusFisicoPonto.PROJETADO.value,
                        status_ponto=StatusPontoProjeto.ATIVO.value,
                        id_tipo_equipamento=1,
                        custo_equipamento=380.00,
                    ),
                ],
                2: [
                    PontoRede(
                        id_ponto=201,
                        descricao="Ponto #201 (CEO Praça Matriz)",
                        latitude=-22.7012,
                        longitude=-46.9910,
                        status_fisico=StatusFisicoPonto.INSTALADO.value,
                        status_ponto=StatusPontoProjeto.ATIVO.value,
                        id_tipo_equipamento=2,
                        custo_equipamento=520.00,
                    ),
                    PontoRede(
                        id_ponto=202,
                        descricao="Ponto #202 (CTO Comércio)",
                        latitude=-22.7025,
                        longitude=-46.9895,
                        status_fisico=StatusFisicoPonto.INSTALADO.value,
                        status_ponto=StatusPontoProjeto.ATIVO.value,
                        id_tipo_equipamento=1,
                        custo_equipamento=380.00,
                    ),
                ],
                3: [
                    PontoRede(
                        id_ponto=301,
                        descricao="POP Curitiba Centro",
                        latitude=-25.4284,
                        longitude=-49.2733,
                        status_fisico=StatusFisicoPonto.INSTALADO.value,
                        status_ponto=StatusPontoProjeto.ATIVO.value,
                        id_tipo_equipamento=3,
                        custo_equipamento=2450.00,
                    ),
                    PontoRede(
                        id_ponto=302,
                        descricao="CTO Batel #01",
                        latitude=-25.4395,
                        longitude=-49.2862,
                        status_fisico=StatusFisicoPonto.PROJETADO.value,
                        status_ponto=StatusPontoProjeto.ATIVO.value,
                        id_tipo_equipamento=1,
                        custo_equipamento=380.00,
                    ),
                ],
            }

            self.trechos_por_projeto: Dict[int, List[TrechoRedeMST]] = {1: [], 2: [], 3: []}
            self._proximo_id_ponto: int = 400
            self._proximo_id_projeto: int = 4

            # Executa o cálculo inicial da MST para popular Metragem_Total e Custo_Estimado (Memoização)
            for id_proj in (1, 2, 3):
                autor_seed = 1 if id_proj in (1, 2) else 4
                self.recalcular_mst_projeto(
                    id_projeto=id_proj,
                    id_usuario_autor=autor_seed,
                    ajustar_malha_viaria=self._persistir_arquivo,
                )
        finally:
            self._em_inicializacao = False

    def _obter_empresa_usuario(self, id_usuario: Optional[int]) -> Optional[int]:
        if id_usuario is None:
            return None
        for vinc in self.vinculos:
            if vinc.id_usuario == id_usuario:
                return vinc.id_empresa
        return None

    def _obter_nome_usuario(self, id_usuario: Optional[int]) -> Optional[str]:
        if id_usuario is None:
            return None
        usr = self.usuarios.get(id_usuario)
        return usr.nome if usr else None

    def _obter_papel_usuario(self, id_usuario: Optional[int]) -> Optional[str]:
        if id_usuario is None:
            return None
        for vinc in self.vinculos:
            if vinc.id_usuario == id_usuario:
                return vinc.nivel_acesso.value
        return None

    def _obter_razao_social_empresa(self, id_empresa: Optional[int]) -> Optional[str]:
        if id_empresa is None:
            return None
        emp = self.empresas.get(id_empresa)
        return emp.razao_social if emp else None

    @staticmethod
    def _classificar_severidade_evento(acao: str) -> str:
        return "ALERTA" if acao in _ACOES_AUDITORIA_ALERTA else "INFO"

    def iniciar_contexto_http_telemetria(
        self,
        *,
        metodo_http: str,
        caminho_http: str,
        ip_origem: Optional[str],
    ) -> Any:
        return _CTX_HTTP_TELEMETRIA.set(
            {
                "metodo_http": metodo_http,
                "caminho_http": caminho_http,
                "ip_origem": mascarar_ip_lgpd(ip_origem),
                "eventos_criados": [],
            }
        )

    def finalizar_contexto_http_telemetria(
        self,
        token_ctx: Any,
        *,
        status_http: int,
        duracao_ms: float,
        registrar_se_vazio: bool = False,
        id_usuario: Optional[int] = None,
        email_usuario: Optional[str] = None,
        id_empresa: Optional[int] = None,
    ) -> None:
        ctx = _CTX_HTTP_TELEMETRIA.get()
        try:
            if ctx is None:
                return
            eventos_ids: List[int] = ctx.get("eventos_criados") or []
            if eventos_ids:
                ids_set = set(eventos_ids)
                for idx, ev in enumerate(self.trilha_auditoria):
                    if ev.id_evento in ids_set:
                        self.trilha_auditoria[idx] = replace(
                            ev,
                            status_http=status_http,
                            duracao_ms=duracao_ms,
                        )
                        if self._persistir_banco and self._sql_repo is not None:
                            try:
                                self._sql_repo.atualizar_telemetria_evento_auditoria(
                                    id_evento=ev.id_evento,
                                    status_http=status_http,
                                    duracao_ms=duracao_ms,
                                )
                            except Exception:
                                pass
            elif registrar_se_vazio:
                metodo = ctx.get("metodo_http") or "GET"
                caminho = ctx.get("caminho_http") or "/"
                severidade_http = "ALERTA" if status_http >= 400 else "INFO"
                self._registrar_evento_auditoria(
                    acao="REQUISICAO_HTTP",
                    id_usuario=id_usuario,
                    email_usuario=email_usuario,
                    id_empresa=id_empresa,
                    severidade=severidade_http,
                    metodo_http=metodo,
                    caminho_http=caminho,
                    status_http=status_http,
                    duracao_ms=duracao_ms,
                    ip_origem=ctx.get("ip_origem"),
                    detalhes=f"{metodo} {caminho} concluído com HTTP {status_http} em {duracao_ms:.1f} ms.",
                )
        finally:
            _CTX_HTTP_TELEMETRIA.reset(token_ctx)

    def _registrar_evento_auditoria(
        self,
        acao: str,
        detalhes: str,
        id_usuario: Optional[int] = None,
        email_usuario: Optional[str] = None,
        id_empresa: Optional[int] = None,
        severidade: Optional[str] = None,
        metodo_http: Optional[str] = None,
        caminho_http: Optional[str] = None,
        status_http: Optional[int] = None,
        duracao_ms: Optional[float] = None,
        ip_origem: Optional[str] = None,
    ) -> Optional[EventoAuditoria]:
        if self._em_inicializacao:
            return None
        if email_usuario is None and id_usuario is not None and id_usuario in self.usuarios:
            email_usuario = self.usuarios[id_usuario].email
        empresa_evento = id_empresa if id_empresa is not None else self._obter_empresa_usuario(id_usuario)
        severidade_final = severidade or self._classificar_severidade_evento(acao)
        ctx = _CTX_HTTP_TELEMETRIA.get()
        metodo_final = metodo_http or (ctx.get("metodo_http") if ctx else None)
        caminho_final = caminho_http or (ctx.get("caminho_http") if ctx else None)
        ip_final = ip_origem or (ctx.get("ip_origem") if ctx else None)

        evento = EventoAuditoria(
            id_evento=self._proximo_id_auditoria,
            timestamp_utc=agora_utc_iso(),
            acao=acao,
            id_usuario=id_usuario,
            email_usuario=email_usuario,
            detalhes=detalhes,
            id_empresa=empresa_evento,
            severidade=severidade_final,
            nome_usuario=self._obter_nome_usuario(id_usuario),
            papel_rbac=self._obter_papel_usuario(id_usuario),
            razao_social_empresa=self._obter_razao_social_empresa(empresa_evento),
            metodo_http=metodo_final,
            caminho_http=caminho_final,
            status_http=status_http,
            duracao_ms=duracao_ms,
            ip_origem=ip_final,
        )
        self._proximo_id_auditoria += 1
        self.trilha_auditoria.append(evento)
        if ctx is not None:
            ctx.setdefault("eventos_criados", []).append(evento.id_evento)

        if self._persistir_banco and self._sql_repo is not None:
            try:
                self._sql_repo.inserir_evento_auditoria(
                    acao=evento.acao,
                    detalhes=evento.detalhes,
                    id_usuario=evento.id_usuario,
                    email_usuario=evento.email_usuario,
                    timestamp_utc=evento.timestamp_utc,
                    id_empresa=evento.id_empresa,
                    severidade=evento.severidade,
                    metodo_http=evento.metodo_http,
                    caminho_http=evento.caminho_http,
                    status_http=evento.status_http,
                    duracao_ms=evento.duracao_ms,
                    ip_origem=evento.ip_origem,
                )
            except Exception:
                pass
        return evento

    def registrar_evento_seguranca_bloqueio(
        self,
        *,
        acao: str,
        detalhes: str,
        id_usuario: Optional[int] = None,
        email_usuario: Optional[str] = None,
        id_empresa: Optional[int] = None,
        status_http: Optional[int] = None,
    ) -> Optional[EventoAuditoria]:
        return self._registrar_evento_auditoria(
            acao=acao,
            detalhes=detalhes,
            id_usuario=id_usuario,
            email_usuario=email_usuario,
            id_empresa=id_empresa,
            severidade="ALERTA",
            status_http=status_http,
        )

    @staticmethod
    def _parse_datetime_utc(valor: Optional[str]) -> Optional[datetime]:
        if not valor or not str(valor).strip():
            return None
        normalizado = normalizar_timestamp_utc_iso(str(valor))
        try:
            return datetime.fromisoformat(normalizado)
        except ValueError:
            return None

    def listar_eventos_auditoria(
        self,
        id_usuario_autor: int = 1,
        since_id: int = 0,
        limit: int = 100,
        id_empresa_filtro: Optional[int] = None,
        id_usuario_filtro: Optional[int] = None,
        data_inicio_utc: Optional[str] = None,
        data_fim_utc: Optional[str] = None,
        severidade: Optional[str] = None,
        metodo_http: Optional[str] = None,
        status_familia: Optional[str] = None,
        acao: Optional[str] = None,
        busca: Optional[str] = None,
    ) -> List[EventoAuditoria]:
        vinculo = self.governanca.validar_acesso_auditoria(id_usuario_autor)
        eh_super_admin = vinculo.nivel_acesso == NivelAcessoRBAC.SUPER_ADMIN

        if not eh_super_admin and id_empresa_filtro is not None and id_empresa_filtro != vinculo.id_empresa:
            raise ViolacaoMultiTenantError(
                f"Acesso negado (Multi-tenant): O perfil '{vinculo.nivel_acesso.value}' "
                f"não pode consultar logs de auditoria da empresa #{id_empresa_filtro}."
            )

        dt_inicio = self._parse_datetime_utc(data_inicio_utc)
        dt_fim = self._parse_datetime_utc(data_fim_utc)
        if dt_inicio and dt_fim and dt_inicio > dt_fim:
            raise ValidacaoDominioError("Data/Hora inicial não pode ser maior que Data/Hora final.")

        sev_norm = severidade.strip().upper() if severidade and severidade.strip().upper() != "TODOS" else None
        metodo_norm = metodo_http.strip().upper() if metodo_http and metodo_http.strip().upper() != "TODOS" else None
        status_fam_norm = status_familia.strip().lower() if status_familia and status_familia.strip().lower() != "todos" else None
        acao_norm = acao.strip().upper() if acao and acao.strip() else None
        busca_norm = busca.strip().lower() if busca and busca.strip() else None

        filtrados: List[EventoAuditoria] = []
        for ev in self.trilha_auditoria:
            if ev.id_evento <= since_id:
                continue

            if eh_super_admin:
                if id_empresa_filtro is not None and ev.id_empresa != id_empresa_filtro:
                    continue
            else:
                # Isolamento rigoroso por tenant: eventos sem id_empresa (None) ficam restritos ao SuperAdmin
                if ev.id_empresa != vinculo.id_empresa:
                    continue

            if id_usuario_filtro is not None:
                if id_usuario_filtro == 0:
                    if ev.id_usuario is not None:
                        continue
                elif ev.id_usuario != id_usuario_filtro:
                    continue

            if dt_inicio or dt_fim:
                dt_ev = self._parse_datetime_utc(ev.timestamp_utc)
                if dt_ev is None:
                    continue
                if dt_inicio and dt_ev < dt_inicio:
                    continue
                if dt_fim and dt_ev > dt_fim:
                    continue

            if sev_norm and ev.severidade.upper() != sev_norm:
                continue

            if metodo_norm and (ev.metodo_http or "").upper() != metodo_norm:
                continue

            if status_fam_norm:
                st = ev.status_http
                if status_fam_norm == "2xx" and not (st is not None and 200 <= st < 300):
                    continue
                if status_fam_norm == "4xx" and not (
                    (st is not None and 400 <= st < 500) or (st is None and ev.severidade == "ALERTA")
                ):
                    continue
                if status_fam_norm == "5xx" and not (st is not None and 500 <= st < 600):
                    continue

            if acao_norm and ev.acao.upper() != acao_norm:
                continue

            if busca_norm:
                texto = " ".join(
                    filter(
                        None,
                        [
                            ev.acao,
                            ev.detalhes,
                            ev.email_usuario,
                            ev.nome_usuario,
                            ev.papel_rbac,
                            ev.razao_social_empresa,
                            ev.metodo_http,
                            ev.caminho_http,
                        ],
                    )
                ).lower()
                if busca_norm not in texto:
                    continue

            filtrados.append(ev)

        return list(reversed(filtrados[-max(1, limit):]))

    def obter_opcoes_filtro_auditoria(self, id_usuario_autor: int) -> Dict[str, Any]:
        vinculo = self.governanca.validar_acesso_auditoria(id_usuario_autor)
        eh_super_admin = vinculo.nivel_acesso == NivelAcessoRBAC.SUPER_ADMIN

        empresas_visiveis = [
            {
                "id_empresa": emp.id_empresa,
                "razao_social": emp.razao_social,
                "cnpj": emp.cnpj,
            }
            for emp in sorted(self.empresas.values(), key=lambda e: e.id_empresa)
            if eh_super_admin or emp.id_empresa == vinculo.id_empresa
        ]

        funcionarios_visiveis: List[Dict[str, Any]] = []
        for vinc in self.vinculos:
            if not eh_super_admin and vinc.id_empresa != vinculo.id_empresa:
                continue
            usr = self.usuarios.get(vinc.id_usuario)
            emp = self.empresas.get(vinc.id_empresa)
            if usr and emp:
                funcionarios_visiveis.append(
                    {
                        "id_usuario": usr.id_usuario,
                        "nome": usr.nome,
                        "email": usr.email,
                        "nivel_acesso": vinc.nivel_acesso.value,
                        "id_empresa": emp.id_empresa,
                        "razao_social_empresa": emp.razao_social,
                    }
                )
        funcionarios_visiveis.sort(key=lambda f: (f["id_empresa"], f["nome"]))

        eventos_escopo = self.listar_eventos_auditoria(id_usuario_autor=id_usuario_autor, limit=500)
        acoes = sorted({ev.acao for ev in eventos_escopo if ev.acao})
        metodos = sorted({ev.metodo_http for ev in eventos_escopo if ev.metodo_http})

        return {
            "escopo_global": eh_super_admin,
            "id_empresa_travada": None if eh_super_admin else vinculo.id_empresa,
            "empresas": empresas_visiveis,
            "funcionarios": funcionarios_visiveis,
            "acoes": acoes,
            "metodos_http": metodos,
        }

    def autenticar_usuario(self, email: str, senha: str) -> SessaoAutenticada:
        email_norm = (email or "").strip().lower()
        if not email_norm or not senha:
            raise ValidacaoDominioError("E-mail e senha são obrigatórios.")

        self.limitador_login.verificar_disponibilidade(email_norm)

        usuario_encontrado: Optional[Usuario] = None
        for usr in self.usuarios.values():
            if usr.email.strip().lower() == email_norm:
                usuario_encontrado = usr
                break

        if usuario_encontrado is None and self._persistir_arquivo:
            self._carregar_usuarios_dev()
            for usr in self.usuarios.values():
                if usr.email.strip().lower() == email_norm:
                    usuario_encontrado = usr
                    break

        if usuario_encontrado is None:
            # Executa verificação dummy em tempo constante para mitigar enumeração por timing
            verificar_senha(senha, _HASH_SENHA_SEED_PADRAO)
            tentativas = self.limitador_login.registrar_falha(email_norm)
            self._registrar_evento_auditoria(
                acao="LOGIN_FALHA",
                email_usuario=email_norm,
                detalhes=f"Tentativa com e-mail inexistente ({tentativas}/{self.limitador_login.max_tentativas}).",
            )
            raise ViolacaoMultiTenantError(
                "Senha incorreta ou e-mail não cadastrado, tente novamente."
            )

        senha_hash_cadastrada = self._senhas_usuarios.get(usuario_encontrado.id_usuario)
        if not senha_hash_cadastrada or not verificar_senha(senha, senha_hash_cadastrada):
            tentativas = self.limitador_login.registrar_falha(email_norm)
            self._registrar_evento_auditoria(
                acao="LOGIN_FALHA",
                id_usuario=usuario_encontrado.id_usuario,
                email_usuario=email_norm,
                detalhes=f"Senha incorreta ({tentativas}/{self.limitador_login.max_tentativas}).",
            )
            raise ViolacaoMultiTenantError(
                "Senha incorreta ou e-mail não cadastrado, tente novamente."
            )

        self.limitador_login.resetar(email_norm)
        sessao = self._construir_sessao_usuario(usuario_encontrado)
        self._registrar_evento_auditoria(
            acao="LOGIN_SUCESSO",
            id_usuario=usuario_encontrado.id_usuario,
            email_usuario=usuario_encontrado.email,
            detalhes=f"Sessão JWT autenticada com perfil {sessao.nivel_acesso}.",
        )
        return sessao

    def _construir_sessao_usuario(self, usuario: Usuario) -> SessaoAutenticada:
        vinculos_usuario = [
            v for v in self.vinculos if v.id_usuario == usuario.id_usuario
        ]
        if not vinculos_usuario:
            raise ViolacaoMultiTenantError(
                "Usuário não possui vínculo contratual ativo com nenhuma empresa."
            )

        vinculo_principal = vinculos_usuario[0]
        empresa = self.empresas[vinculo_principal.id_empresa]
        token = gerar_token_acesso(
            id_usuario=usuario.id_usuario,
            email=usuario.email,
            id_empresa=empresa.id_empresa,
            nivel_acesso=vinculo_principal.nivel_acesso.value,
            eh_engenheiro=usuario.eh_engenheiro,
        )
        verificado = self._emails_verificados.get(usuario.id_usuario, True)
        eh_producao = os.getenv("APP_ENV", "development").strip().lower() == "production"
        codigo_dev = (
            None
            if (verificado or eh_producao)
            else self.verificador_email.obter_codigo_pendente(usuario.email)
        )

        return SessaoAutenticada(
            id_usuario=usuario.id_usuario,
            nome=usuario.nome,
            email=usuario.email,
            crea=usuario.crea,
            eh_engenheiro=usuario.eh_engenheiro,
            id_empresa_padrao=empresa.id_empresa,
            razao_social_empresa=empresa.razao_social,
            nivel_acesso=vinculo_principal.nivel_acesso.value,
            access_token=token,
            token_type="bearer",
            email_verificado=verificado,
            codigo_verificacao_dev=codigo_dev,
        )

    def validar_token_sessao(self, token: str) -> SessaoAutenticada:
        payload = decodificar_token_acesso(token)
        usuario = self.usuarios.get(payload.id_usuario)
        if usuario is None and self._persistir_arquivo:
            self._carregar_usuarios_dev()
            usuario = self.usuarios.get(payload.id_usuario)
        if usuario is None:
            raise NaoAutenticadoError("Usuário associado ao token não existe mais.")
        return self._construir_sessao_usuario(usuario)

    def revogar_token_sessao(self, token: str) -> None:
        payload = decodificar_token_acesso(token)
        revogador_tokens.revogar(payload.jti, payload.exp)
        gerenciador_tickets_stream.revogar_usuario(payload.id_usuario)
        self._registrar_evento_auditoria(
            acao="LOGOUT_REVOGACAO_JWT",
            id_usuario=payload.id_usuario,
            email_usuario=payload.email,
            detalhes=f"Token JWT revogado (jti={payload.jti[:8]}...).",
        )

    def verificar_email_usuario(self, email: str, codigo: str) -> SessaoAutenticada:
        email_norm = (email or "").strip().lower()
        usuario = next(
            (u for u in self.usuarios.values() if u.email.strip().lower() == email_norm),
            None,
        )
        if usuario is None:
            raise RecursoNaoEncontradoError("E-mail não encontrado para verificação.")

        if not self.verificador_email.validar_codigo_otp(email_norm, codigo):
            raise ValidacaoDominioError("Código de verificação inválido.")

        self._emails_verificados[usuario.id_usuario] = True
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.atualizar_email_verificado(usuario.id_usuario, True)
        self._salvar_usuarios_dev()
        self._registrar_evento_auditoria(
            acao="EMAIL_VERIFICADO",
            id_usuario=usuario.id_usuario,
            email_usuario=usuario.email,
            detalhes="E-mail corporativo verificado via código OTP de 6 dígitos.",
        )
        return self._construir_sessao_usuario(usuario)

    def reenviar_codigo_verificacao(self, email: str) -> str:
        email_norm = (email or "").strip().lower()
        usuario = next(
            (u for u in self.usuarios.values() if u.email.strip().lower() == email_norm),
            None,
        )
        if usuario is None:
            raise RecursoNaoEncontradoError("E-mail não encontrado.")
        codigo = self.verificador_email.gerar_codigo_otp(email_norm)
        self._registrar_evento_auditoria(
            acao="REENVIO_OTP_EMAIL",
            id_usuario=usuario.id_usuario,
            email_usuario=usuario.email,
            detalhes="Novo código OTP de 6 dígitos emitido.",
        )
        return codigo

    def registrar_usuario(
        self,
        nome: str,
        email: str,
        senha: str,
        telefone: str,
        cpf: str,
        crea: str,
    ) -> SessaoAutenticada:
        validar_forca_senha(senha)
        email_norm = email.strip().lower()
        cpf_norm = "".join(filter(str.isdigit, cpf))
        crea_norm = crea.strip().upper()
        crea_normalizado = crea_norm if crea_norm.startswith("SP-") else f"SP-{crea_norm}"
        if any(usr.email.strip().lower() == email_norm for usr in self.usuarios.values()):
            raise ValidacaoDominioError("Já existe um usuário cadastrado com este e-mail.")
        if any("".join(filter(str.isdigit, usr.cpf)) == cpf_norm for usr in self.usuarios.values()):
            raise ValidacaoDominioError("Já existe um usuário cadastrado com este CPF.")
        if any(
            usr.crea and usr.crea.strip().upper() == crea_normalizado
            for usr in self.usuarios.values()
        ):
            raise ValidacaoDominioError("Já existe um usuário cadastrado com este CREA.")

        novo_id = max(self.usuarios, default=0) + 1
        usuario = Usuario(
            id_usuario=novo_id,
            nome=nome.strip(),
            cpf=cpf,
            telefone=telefone.strip(),
            email=email_norm,
            crea=crea_normalizado,
        )
        vinculo = VinculoCorporate(
            id_usuario=novo_id,
            id_empresa=1,
            nivel_acesso=NivelAcessoRBAC.PROJETISTA,
        )

        self.usuarios[novo_id] = usuario
        senha_hash = gerar_hash_senha(senha)
        self._senhas_usuarios[novo_id] = senha_hash
        self._emails_verificados[novo_id] = False
        self.verificador_email.gerar_codigo_otp(email_norm)
        self.vinculos.append(vinculo)
        self.governanca.usuarios[novo_id] = usuario
        self.governanca.vinculos[(novo_id, 1)] = vinculo
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.inserir_usuario_engenheiro(
                id_usuario=novo_id,
                nome=usuario.nome,
                cpf=usuario.cpf,
                telefone=usuario.telefone,
                email=usuario.email,
                senha_hash=senha_hash,
                crea=crea_normalizado,
                id_empresa=1,
                nivel_acesso=NivelAcessoRBAC.PROJETISTA.value,
            )
        self._salvar_usuarios_dev()

        self._registrar_evento_auditoria(
            acao="CADASTRO_USUARIO",
            id_usuario=novo_id,
            email_usuario=email_norm,
            detalhes=f"Engenheiro cadastrado (CREA {crea_normalizado}) e código OTP gerado.",
        )
        return self.autenticar_usuario(email_norm, senha)

    def listar_projetos(
        self, id_empresa: int = 1, id_usuario_autor: int = 1
    ) -> List[ProjetoDominio]:
        if id_empresa == 0 and self.governanca.usuario_eh_super_admin(id_usuario_autor):
            return list(self.projetos.values())
        alvo_empresa = id_empresa if id_empresa > 0 else (self._obter_empresa_usuario(id_usuario_autor) or 1)
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=alvo_empresa,
            exigir_escrita=False,
        )
        return [
            p for p in self.projetos.values() if p.id_empresa == alvo_empresa
        ]

    def obter_projeto(self, id_projeto: int, id_usuario_autor: int = 1) -> ProjetoDominio:
        projeto = self.projetos.get(id_projeto)
        if projeto is None:
            raise RecursoNaoEncontradoError(f"Projeto {id_projeto} não encontrado.")
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=False,
        )
        return projeto

    def criar_projeto(
        self,
        nome: str,
        id_empresa: int = 1,
        id_engenheiro: int = 1,
        id_usuario_autor: int = 1,
    ) -> ProjetoDominio:
        novo_id = self._proximo_id_projeto
        candidato = ProjetoDominio(
            id_projeto=novo_id,
            nome=nome,
            id_empresa=id_empresa,
            id_engenheiro=id_engenheiro,
            status=StatusProjetoEnum.EM_PLANEJAMENTO,
            data_criacao=agora_utc_iso(),
        )
        validado = self.governanca.validar_criacao_projeto(
            id_usuario_autor=id_usuario_autor,
            projeto=candidato,
        )
        self._proximo_id_projeto += 1
        self.projetos[novo_id] = validado
        self.pontos_por_projeto[novo_id] = []
        self.trechos_por_projeto[novo_id] = []
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.inserir_projeto(
                id_projeto=validado.id_projeto,
                nome=validado.nome,
                status=validado.status.value,
                id_empresa=validado.id_empresa,
                id_engenheiro=validado.id_engenheiro,
            )
        self._registrar_evento_auditoria(
            acao="PROJETO_CRIADO",
            id_usuario=id_usuario_autor,
            id_empresa=validado.id_empresa,
            detalhes=f"Projeto #{validado.id_projeto} ('{validado.nome}') criado para empresa #{validado.id_empresa}.",
        )
        self._salvar_workspace_dev()
        return validado

    def renomear_projeto(
        self,
        id_projeto: int,
        novo_nome: str,
        id_usuario_autor: int = 1,
    ) -> ProjetoDominio:
        projeto = self.obter_projeto(id_projeto=id_projeto, id_usuario_autor=id_usuario_autor)
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )
        self.governanca._verificar_projeto_editavel(projeto)
        nome_limpo = (novo_nome or "").strip()
        if not nome_limpo:
            raise ValidacaoDominioError("O nome do projeto não pode ser vazio.")
        atualizado = replace(projeto, nome=nome_limpo)
        self.projetos[id_projeto] = atualizado
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.atualizar_nome_projeto(id_projeto, nome_limpo)
        self._registrar_evento_auditoria(
            acao="PROJETO_RENOMEADO",
            id_usuario=id_usuario_autor,
            detalhes=f"Projeto #{id_projeto} renomeado para '{nome_limpo}'.",
        )
        self._salvar_workspace_dev()
        return atualizado

    def atualizar_status_projeto(
        self,
        id_projeto: int,
        novo_status: str,
        id_usuario_autor: int = 1,
    ) -> ProjetoDominio:
        projeto = self.obter_projeto(id_projeto=id_projeto, id_usuario_autor=id_usuario_autor)
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )
        status_enum = StatusProjetoEnum(novo_status)
        atualizado = replace(projeto, status=status_enum)
        self.projetos[id_projeto] = atualizado
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.atualizar_status_projeto(id_projeto, status_enum.value)
        self._registrar_evento_auditoria(
            acao="PROJETO_STATUS_ALTERADO",
            id_usuario=id_usuario_autor,
            detalhes=f"Projeto #{id_projeto} ('{projeto.nome}') alterado para '{status_enum.value}'.",
        )
        self._salvar_workspace_dev()
        return atualizado

    def adicionar_ponto_rede(
        self,
        id_projeto: int,
        descricao: str,
        latitude: float,
        longitude: float,
        status_fisico: str = StatusFisicoPonto.PROJETADO.value,
        id_tipo_equipamento: Optional[int] = None,
        id_usuario_autor: int = 1,
    ) -> PontoRede:
        projeto = self.obter_projeto(id_projeto=id_projeto, id_usuario_autor=id_usuario_autor)
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )
        self.governanca._verificar_projeto_editavel(projeto)

        custo_eq = 0.0
        if id_tipo_equipamento is not None:
            eq = self.catalogo_equipamentos.get(id_tipo_equipamento)
            if eq is None:
                raise ValidacaoDominioError(
                    f"idTipo_Equipamento={id_tipo_equipamento} não existe no catálogo Tipo_Equipamento."
                )
            custo_eq = eq.custo_unitario

        novo_ponto = PontoRede(
            id_ponto=self._proximo_id_ponto,
            descricao=descricao,
            latitude=latitude,
            longitude=longitude,
            status_fisico=status_fisico,
            status_ponto=StatusPontoProjeto.ATIVO.value,
            id_tipo_equipamento=id_tipo_equipamento,
            custo_equipamento=custo_eq,
        )
        self._proximo_id_ponto += 1
        self.pontos_por_projeto.setdefault(id_projeto, []).append(novo_ponto)
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.inserir_ponto_no_projeto(
                id_ponto=novo_ponto.id_ponto,
                id_projeto=id_projeto,
                descricao=novo_ponto.descricao,
                latitude=novo_ponto.latitude,
                longitude=novo_ponto.longitude,
                status_fisico=novo_ponto.status_fisico,
                status_ponto=novo_ponto.status_ponto,
                id_tipo_equipamento=novo_ponto.id_tipo_equipamento,
            )
        self._registrar_evento_auditoria(
            acao="PONTO_CRIADO",
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            detalhes=f"Ativo #{novo_ponto.id_ponto} ('{novo_ponto.descricao}') inserido no Projeto #{id_projeto}.",
        )
        self._salvar_workspace_dev()
        return novo_ponto

    def atualizar_coordenadas_ponto(
        self,
        id_projeto: int,
        id_ponto: int,
        latitude: float,
        longitude: float,
        id_usuario_autor: int = 1,
    ) -> PontoRede:
        return self.atualizar_ponto_rede(
            id_projeto=id_projeto,
            id_ponto=id_ponto,
            latitude=latitude,
            longitude=longitude,
            id_usuario_autor=id_usuario_autor,
        )

    def atualizar_ponto_rede(
        self,
        id_projeto: int,
        id_ponto: int,
        *,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        descricao: Optional[str] = None,
        status_fisico: Optional[str] = None,
        id_tipo_equipamento: Optional[int] = None,
        atualizar_tipo_equipamento: bool = False,
        id_usuario_autor: int = 1,
    ) -> PontoRede:
        projeto = self.obter_projeto(id_projeto=id_projeto, id_usuario_autor=id_usuario_autor)
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )
        self.governanca._verificar_projeto_editavel(projeto)

        pontos = self.pontos_por_projeto.get(id_projeto, [])
        for index, ponto in enumerate(pontos):
            if ponto.id_ponto == id_ponto:
                nova_desc = descricao.strip() if descricao is not None else ponto.descricao
                if not nova_desc:
                    raise ValidacaoDominioError("A descrição do ponto não pode ser vazia.")
                nova_lat = float(latitude) if latitude is not None else ponto.latitude
                nova_lng = float(longitude) if longitude is not None else ponto.longitude
                novo_status_fisico = status_fisico if status_fisico is not None else ponto.status_fisico

                novo_id_eq = ponto.id_tipo_equipamento
                novo_custo_eq = ponto.custo_equipamento
                if atualizar_tipo_equipamento or id_tipo_equipamento is not None:
                    novo_id_eq = id_tipo_equipamento
                    if novo_id_eq is not None:
                        eq = self.catalogo_equipamentos.get(novo_id_eq)
                        if eq is None:
                            raise ValidacaoDominioError(
                                f"idTipo_Equipamento={novo_id_eq} não existe no catálogo Tipo_Equipamento."
                            )
                        novo_custo_eq = eq.custo_unitario
                    else:
                        novo_custo_eq = 0.0

                atualizado = replace(
                    ponto,
                    descricao=nova_desc,
                    latitude=nova_lat,
                    longitude=nova_lng,
                    status_fisico=novo_status_fisico,
                    id_tipo_equipamento=novo_id_eq,
                    custo_equipamento=novo_custo_eq,
                )
                pontos[index] = atualizado
                if self._persistir_banco and self._sql_repo is not None:
                    self._sql_repo.atualizar_ponto_rede(
                        id_ponto=id_ponto,
                        descricao=atualizado.descricao,
                        latitude=atualizado.latitude,
                        longitude=atualizado.longitude,
                        status_fisico=atualizado.status_fisico,
                        id_tipo_equipamento=atualizado.id_tipo_equipamento,
                    )
                if (
                    descricao is not None
                    or status_fisico is not None
                    or atualizar_tipo_equipamento
                    or id_tipo_equipamento is not None
                ):
                    self._registrar_evento_auditoria(
                        acao="PONTO_ATUALIZADO",
                        id_usuario=id_usuario_autor,
                        id_empresa=projeto.id_empresa,
                        detalhes=f"Ponto #{id_ponto} ('{atualizado.descricao}') atualizado no Projeto #{id_projeto}.",
                    )
                elif latitude is not None or longitude is not None:
                    self._registrar_evento_auditoria(
                        acao="PONTO_MOVIDO",
                        id_usuario=id_usuario_autor,
                        id_empresa=projeto.id_empresa,
                        detalhes=f"Ponto #{id_ponto} ('{atualizado.descricao}') reposicionado para ({atualizado.latitude:.5f}, {atualizado.longitude:.5f}) no Projeto #{id_projeto}.",
                    )
                self._salvar_workspace_dev()
                return atualizado
        raise RecursoNaoEncontradoError(
            f"Ponto {id_ponto} não encontrado no escopo do projeto {id_projeto}."
        )

    def cadastrar_tipo_cabo(
        self,
        *,
        descricao_modelo: str,
        custo_por_metro: float,
        limite_distancia_metros: float,
        id_usuario_autor: int = 1,
    ) -> TipoCabo:
        eh_admin = any(
            v.id_usuario == id_usuario_autor and v.nivel_acesso == NivelAcessoRBAC.ADMINISTRADOR
            for v in self.vinculos
        )
        if not eh_admin:
            raise PermissaoInsuficienteError(
                "Permissão insuficiente (RBAC): Apenas Administrador pode cadastrar modelos no catálogo Tipo_Cabo."
            )

        novo_id = max(self.catalogo_cabos.keys(), default=0) + 1
        novo_cabo = TipoCabo(
            id_cabo=novo_id,
            descricao_modelo=descricao_modelo.strip(),
            custo_por_metro=float(custo_por_metro),
            limite_distancia_metros=float(limite_distancia_metros),
        )
        self.catalogo_cabos[novo_id] = novo_cabo
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.inserir_tipo_cabo(
                id_cabo=novo_cabo.id_cabo,
                descricao_modelo=novo_cabo.descricao_modelo,
                custo_por_metro=novo_cabo.custo_por_metro,
                limite_distancia_metros=novo_cabo.limite_distancia_metros,
            )
        self._registrar_evento_auditoria(
            acao="CATALOGO_CABO_CRIADO",
            id_usuario=id_usuario_autor,
            detalhes=f"Modelo '{novo_cabo.descricao_modelo}' cadastrado no catálogo 3FN Tipo_Cabo.",
        )
        return novo_cabo

    def recalcular_mst_projeto(
        self,
        id_projeto: int,
        id_usuario_autor: int = 1,
        no_inicial_id: Optional[int] = None,
        arestas_candidatas: Optional[Sequence[ArestaCandidata]] = None,
        catalogo_cabos: Optional[Sequence[TipoCabo]] = None,
        ajustar_malha_viaria: bool = False,
    ) -> ResultadoMSTProjeto:
        projeto = self.obter_projeto(id_projeto=id_projeto, id_usuario_autor=id_usuario_autor)
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )

        pontos = self.pontos_por_projeto.get(id_projeto, [])
        cabos_ativos = (
            list(catalogo_cabos)
            if catalogo_cabos
            else list(self.catalogo_cabos.values())
        )
        grafo = GrafoTopologicoOptico(
            id_projeto=id_projeto,
            pontos=pontos,
            catalogo_cabos=cabos_ativos,
            catalogo_equipamentos=list(self.catalogo_equipamentos.values()),
        )
        arestas_efetivas = arestas_candidatas
        if arestas_efetivas is None and ajustar_malha_viaria:
            arestas_efetivas = gerar_arestas_candidatas_viarias(
                pontos=pontos,
                limite_max_metros=grafo.maior_limite_cabo_metros,
            )
        grafo.construir_lista_adjacencia(arestas_candidatas=arestas_efetivas)
        resultado = grafo.extrair_mst_prim(no_inicial_id=no_inicial_id)

        projeto_atualizado = self.governanca.atualizar_memoizacao_projeto(
            id_usuario_autor=id_usuario_autor,
            projeto=projeto,
            resultado_mst=resultado,
        )
        self.projetos[id_projeto] = projeto_atualizado
        self.trechos_por_projeto[id_projeto] = list(resultado.trechos_mst)
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.salvar_mst_projeto_transacional(
                id_projeto=id_projeto,
                metragem_total=resultado.metragem_total,
                custo_estimado=resultado.custo_estimado,
                trechos=[
                    {
                        "origem_id": tr.origem_id,
                        "destino_id": tr.destino_id,
                        "id_tipo_cabo": tr.id_tipo_cabo,
                        "distancia_metros": tr.distancia_metros,
                        "custo_trecho": tr.custo_trecho,
                        "geometria_wkt": tr.geometria_wkt,
                        "caminho_coordenadas": list(tr.caminho_coordenadas),
                    }
                    for tr in resultado.trechos_mst
                ],
                cabos_utilizados=[
                    {
                        "id_cabo": cb.id_cabo,
                        "descricao_modelo": cb.descricao_modelo,
                        "custo_por_metro": cb.custo_por_metro,
                        "limite_distancia_metros": cb.limite_distancia_metros,
                    }
                    for cb in cabos_ativos
                ],
            )
        self._registrar_evento_auditoria(
            acao="MST_CALCULADA",
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            detalhes=(
                f"AGM Prim recalculada no Projeto #{id_projeto}: "
                f"{resultado.metragem_total:.2f}m, R$ {resultado.custo_estimado:.2f}, "
                f"economia {resultado.economia_percentual:.1f}% "
                f"({'Snap Viário ON' if ajustar_malha_viaria else 'Geodésico OFF'})."
            ),
        )
        self._salvar_workspace_dev()
        return resultado

    def aplicar_soft_delete_ponto(
        self,
        id_projeto: int,
        id_ponto: int,
        id_usuario_autor: int = 1,
        novo_status_ponto: StatusPontoProjeto = StatusPontoProjeto.REMOVIDO,
        forcar_recalculo_mst: bool = False,
    ) -> PontoRede:
        projeto = self.obter_projeto(id_projeto=id_projeto, id_usuario_autor=id_usuario_autor)
        pontos = self.pontos_por_projeto.get(id_projeto, [])

        idx_alvo: Optional[int] = None
        for idx, p in enumerate(pontos):
            if p.id_ponto == id_ponto:
                idx_alvo = idx
                break

        if idx_alvo is None:
            raise RecursoNaoEncontradoError(
                f"Ponto {id_ponto} não encontrado no escopo do projeto {id_projeto}."
            )

        if (
            novo_status_ponto == StatusPontoProjeto.ATIVO
            and pontos[idx_alvo].status_ponto != StatusPontoProjeto.ATIVO.value
        ):
            self.governanca.validar_acesso_tenant(
                id_usuario=id_usuario_autor,
                id_empresa=projeto.id_empresa,
                exigir_escrita=True,
            )
            self.governanca._verificar_projeto_editavel(projeto)
            ponto_atualizado = replace(
                pontos[idx_alvo], status_ponto=StatusPontoProjeto.ATIVO.value
            )
            self._registrar_evento_auditoria(
                acao="PONTO_RESTAURADO",
                id_usuario=id_usuario_autor,
                detalhes=f"Ponto #{id_ponto} ('{ponto_atualizado.descricao}') restaurado para 'Ativo' no Projeto #{id_projeto}.",
            )
        else:
            ponto_atualizado = self.governanca.aplicar_soft_delete_ponto_no_projeto(
                id_usuario_autor=id_usuario_autor,
                projeto=projeto,
                ponto=pontos[idx_alvo],
                trechos_ativos=self.trechos_por_projeto.get(id_projeto, []),
                novo_status_ponto=novo_status_ponto,
                forcar_cascata_topologica=forcar_recalculo_mst,
            )
            self._registrar_evento_auditoria(
                acao="PONTO_REMOVIDO",
                id_usuario=id_usuario_autor,
                id_empresa=projeto.id_empresa,
                detalhes=f"Ponto #{id_ponto} ('{ponto_atualizado.descricao}') marcado como '{ponto_atualizado.status_ponto}' no Projeto #{id_projeto}.",
            )
        pontos[idx_alvo] = ponto_atualizado
        if self._persistir_banco and self._sql_repo is not None:
            self._sql_repo.atualizar_status_ponto_contem(
                id_projeto, id_ponto, ponto_atualizado.status_ponto
            )

        if forcar_recalculo_mst:
            self.recalcular_mst_projeto(
                id_projeto=id_projeto,
                id_usuario_autor=id_usuario_autor,
            )

        self._salvar_workspace_dev()
        return ponto_atualizado


workspace_store = WorkspaceStoreService(persistir_arquivo=False, persistir_banco=True)
