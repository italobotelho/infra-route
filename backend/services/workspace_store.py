"""
Serviço de Orquestração de Projetos, Autenticação e Persistência em Memória
(pré-populado com os dados de `database/seed.sql` e `index.html`).

Conecta `GovernancaMultiTenantService` e `GrafoTopologicoOptico` para prover
todas as operações consumidas pelas telas `login.html` e `index.html`.
"""

from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from backend.services.exceptions import (
    NaoAutenticadoError,
    RecursoNaoEncontradoError,
    ValidacaoDominioError,
    ViolacaoMultiTenantError,
)
from backend.services.security_service import (
    GerenciadorVerificacaoEmail,
    LimitadorTentativasLogin,
    decodificar_token_acesso,
    gerar_hash_senha,
    gerar_token_acesso,
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


class WorkspaceStoreService:
    """
    Orquestra o ciclo de vida completo de autenticação, projetos, pontos de rede
    e cálculo da Árvore Geradora Mínima (Algoritmo de Prim).
    """

    _ARQUIVO_DEV_USUARIOS = Path(".cache/dev_users.json")

    def __init__(self, persistir_arquivo: bool = False) -> None:
        self._persistir_arquivo = persistir_arquivo
        self.resetar_estado_padrao()
        if self._persistir_arquivo:
            self._carregar_usuarios_dev()

    def _salvar_usuarios_dev(self) -> None:
        if not self._persistir_arquivo:
            return
        try:
            self._ARQUIVO_DEV_USUARIOS.parent.mkdir(parents=True, exist_ok=True)
            registros = []
            for uid, usr in self.usuarios.items():
                if uid <= 2:
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

    def resetar_estado_padrao(self) -> None:
        """Restaura o estado inicial alinhado ao `database/seed.sql` e `index.html`."""
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
        }

        # Armazena exclusivamente hashes bcrypt ($2b$12$...) das senhas dos colaboradores
        self._senhas_usuarios: Dict[int, str] = {
            1: _HASH_SENHA_SEED_PADRAO,
            2: _HASH_SENHA_SEED_PADRAO,
        }
        self._emails_verificados: Dict[int, bool] = {
            1: True,
            2: True,
        }
        self.limitador_login = LimitadorTentativasLogin()
        self.verificador_email = GerenciadorVerificacaoEmail()
        self.trilha_auditoria: List[EventoAuditoria] = []
        self._proximo_id_auditoria: int = 1
        revogador_tokens.limpar()

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

        # Projetos iniciais (compatíveis com o `<select id="select-projeto">` de index.html)
        self.projetos: Dict[int, ProjetoDominio] = {
            1: ProjetoDominio(
                id_projeto=1,
                nome="Expansão Distrito Industrial",
                id_empresa=1,
                id_engenheiro=1,
                status=StatusProjetoEnum.EM_PLANEJAMENTO,
            ),
            2: ProjetoDominio(
                id_projeto=2,
                nome="Malha Centro Histórico",
                id_empresa=1,
                id_engenheiro=1,
                status=StatusProjetoEnum.EM_EXECUCAO,
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
        }

        self.trechos_por_projeto: Dict[int, List[TrechoRedeMST]] = {1: [], 2: []}
        self._proximo_id_ponto: int = 300
        self._proximo_id_projeto: int = 3

        # Executa o cálculo inicial da MST para popular Metragem_Total e Custo_Estimado (Memoização)
        for id_proj in (1, 2):
            self.recalcular_mst_projeto(
                id_projeto=id_proj,
                id_usuario_autor=1,
                ajustar_malha_viaria=self._persistir_arquivo,
            )

    def _registrar_evento_auditoria(
        self,
        acao: str,
        detalhes: str,
        id_usuario: Optional[int] = None,
        email_usuario: Optional[str] = None,
    ) -> EventoAuditoria:
        if email_usuario is None and id_usuario is not None and id_usuario in self.usuarios:
            email_usuario = self.usuarios[id_usuario].email
        evento = EventoAuditoria(
            id_evento=self._proximo_id_auditoria,
            timestamp_utc=datetime.now(timezone.utc).isoformat(),
            acao=acao,
            id_usuario=id_usuario,
            email_usuario=email_usuario,
            detalhes=detalhes,
        )
        self._proximo_id_auditoria += 1
        self.trilha_auditoria.append(evento)
        return evento

    def listar_eventos_auditoria(self, id_usuario_autor: int = 1) -> List[EventoAuditoria]:
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=1,
            exigir_escrita=False,
        )
        return list(reversed(self.trilha_auditoria))

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
            raise ViolacaoMultiTenantError("Credenciais corporativas inválidas.")

        senha_hash_cadastrada = self._senhas_usuarios.get(usuario_encontrado.id_usuario)
        if not senha_hash_cadastrada or not verificar_senha(senha, senha_hash_cadastrada):
            tentativas = self.limitador_login.registrar_falha(email_norm)
            self._registrar_evento_auditoria(
                acao="LOGIN_FALHA",
                id_usuario=usuario_encontrado.id_usuario,
                email_usuario=email_norm,
                detalhes=f"Senha incorreta ({tentativas}/{self.limitador_login.max_tentativas}).",
            )
            raise ViolacaoMultiTenantError("Credenciais corporativas inválidas.")

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
        codigo_dev = (
            None
            if verificado
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
        self._senhas_usuarios[novo_id] = gerar_hash_senha(senha)
        self._emails_verificados[novo_id] = False
        self.verificador_email.gerar_codigo_otp(email_norm)
        self.vinculos.append(vinculo)
        self.governanca.usuarios[novo_id] = usuario
        self.governanca.vinculos[(novo_id, 1)] = vinculo
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
        self.governanca.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=id_empresa,
            exigir_escrita=False,
        )
        return [
            p for p in self.projetos.values() if p.id_empresa == id_empresa
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
        )
        validado = self.governanca.validar_criacao_projeto(
            id_usuario_autor=id_usuario_autor,
            projeto=candidato,
        )
        self._proximo_id_projeto += 1
        self.projetos[novo_id] = validado
        self.pontos_por_projeto[novo_id] = []
        self.trechos_por_projeto[novo_id] = []
        return validado

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
        return novo_ponto

    def atualizar_coordenadas_ponto(
        self,
        id_projeto: int,
        id_ponto: int,
        latitude: float,
        longitude: float,
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
                atualizado = replace(ponto, latitude=latitude, longitude=longitude)
                pontos[index] = atualizado
                return atualizado
        raise RecursoNaoEncontradoError(
            f"Ponto {id_ponto} não encontrado no escopo do projeto {id_projeto}."
        )

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

        ponto_atualizado = self.governanca.aplicar_soft_delete_ponto_no_projeto(
            id_usuario_autor=id_usuario_autor,
            projeto=projeto,
            ponto=pontos[idx_alvo],
            trechos_ativos=self.trechos_por_projeto.get(id_projeto, []),
            novo_status_ponto=novo_status_ponto,
            forcar_cascata_topologica=forcar_recalculo_mst,
        )
        pontos[idx_alvo] = ponto_atualizado

        if forcar_recalculo_mst:
            self.recalcular_mst_projeto(
                id_projeto=id_projeto,
                id_usuario_autor=id_usuario_autor,
            )

        return ponto_atualizado


workspace_store = WorkspaceStoreService(persistir_arquivo=True)
