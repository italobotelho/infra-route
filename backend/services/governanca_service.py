"""
Motor de Governança Corporativa, Isolamento Multi-Tenant, RBAC e Soft Delete.

Implementa as resoluções arquiteturais documentadas em `docs/`:
1. Especialização Parcial e Exclusiva (p, d) de `Usuario` -> `Engenheiro` (CREA obrigatório).
2. Resolução da Dependência Triangular de Permissionamento (Multi-tenant):
   `Empresa` <-> `Projeto` <-> `Engenheiro` via tabela associativa `Vincula`.
3. Controle de Acesso Baseado em Papéis (RBAC):
   `Administrador`, `Projetista` e `Visualizador`.
4. Governança de Exclusão Lógica (Soft Delete) e Proteção de Órfãos (ON DELETE RESTRICT).
"""

from dataclasses import dataclass, replace
from enum import Enum
import re
from typing import Dict, List, Optional, Sequence, Set, Tuple

from backend.services.exceptions import (
    PermissaoInsuficienteError,
    RecursoNaoEncontradoError,
    ValidacaoDominioError,
    ViolacaoEspecializacaoEngenheiroError,
    ViolacaoIntegridadeTopologicaError,
    ViolacaoMultiTenantError,
)
from backend.services.prim_service import (
    PontoRede,
    StatusFisicoPonto,
    StatusPontoProjeto,
    TrechoRedeMST,
)


class NivelAcessoRBAC(str, Enum):
    ADMINISTRADOR = "Administrador"
    PROJETISTA = "Projetista"
    VISUALIZADOR = "Visualizador"


class StatusProjetoEnum(str, Enum):
    EM_PLANEJAMENTO = "Em Planejamento"
    EM_EXECUCAO = "Em Execução"
    CONCLUIDO = "Concluído"
    CANCELADO = "Cancelado"


@dataclass(frozen=True)
class Empresa:
    id_empresa: int
    cnpj: str
    razao_social: str

    def __post_init__(self) -> None:
        if self.id_empresa <= 0:
            raise ValidacaoDominioError("ID_Empresa deve ser um inteiro positivo.")
        cnpj_limpo = re.sub(r"\D", "", self.cnpj or "")
        if len(cnpj_limpo) != 14 or len(set(cnpj_limpo)) == 1:
            raise ValidacaoDominioError(f"CNPJ inválido: {self.cnpj}")
        if not (self.razao_social and self.razao_social.strip()):
            raise ValidacaoDominioError("Razao_Social não pode ser vazia.")


@dataclass(frozen=True)
class Usuario:
    id_usuario: int
    nome: str
    cpf: str
    telefone: str
    email: str
    crea: Optional[str] = None  # Preenchido apenas se especializado em Engenheiro (p, d)

    def __post_init__(self) -> None:
        if self.id_usuario <= 0:
            raise ValidacaoDominioError("ID_Usuario deve ser um inteiro positivo.")
        if not (self.nome and self.nome.strip()):
            raise ValidacaoDominioError("Nome do usuário não pode ser vazio.")
        cpf_limpo = re.sub(r"\D", "", self.cpf or "")
        if len(cpf_limpo) != 11 or len(set(cpf_limpo)) == 1:
            raise ValidacaoDominioError(f"CPF inválido: {self.cpf}")
        if not (self.email and "@" in self.email and "." in self.email.split("@")[-1]):
            raise ValidacaoDominioError(f"E-mail inválido: {self.email}")
        if self.crea is not None and not self.crea.strip():
            raise ValidacaoDominioError("Registro CREA não pode ser uma string em branco.")

    @property
    def eh_engenheiro(self) -> bool:
        """Indica se o usuário possui a especialização Engenheiro (CREA válido)."""
        return bool(self.crea and self.crea.strip())


@dataclass(frozen=True)
class VinculoCorporate:
    """Representa uma linha da tabela associativa `Vincula` (Usuario <-> Empresa)."""

    id_usuario: int
    id_empresa: int
    nivel_acesso: NivelAcessoRBAC


@dataclass(frozen=True)
class ProjetoDominio:
    id_projeto: int
    nome: str
    id_empresa: int
    id_engenheiro: int
    status: StatusProjetoEnum = StatusProjetoEnum.EM_PLANEJAMENTO
    custo_estimado: float = 0.0
    metragem_total: float = 0.0

    def __post_init__(self) -> None:
        if self.id_projeto <= 0:
            raise ValidacaoDominioError("ID_Projeto deve ser um inteiro positivo.")
        if not (self.nome and self.nome.strip()):
            raise ValidacaoDominioError("Nome do projeto não pode ser vazio.")
        if self.id_empresa <= 0 or self.id_engenheiro <= 0:
            raise ValidacaoDominioError("idEmpresa e idEngenheiro devem ser inteiros positivos.")
        if self.custo_estimado < 0 or self.metragem_total < 0:
            raise ValidacaoDominioError("Custo_Estimado e Metragem_Total não podem ser negativos.")


class GovernancaMultiTenantService:
    """
    Serviço responsável por blindar as regras de negócio de isolamento Multi-tenant,
    RBAC, especialização técnica (Engenheiro/CREA) e governança histórica (Soft Delete).
    """

    PAPEIS_ESCRITA: Set[NivelAcessoRBAC] = {
        NivelAcessoRBAC.ADMINISTRADOR,
        NivelAcessoRBAC.PROJETISTA,
    }

    def __init__(
        self,
        empresas: Sequence[Empresa],
        usuarios: Sequence[Usuario],
        vinculos: Sequence[VinculoCorporate],
    ) -> None:
        self.empresas: Dict[int, Empresa] = {}
        cnpjs_vistos: Set[str] = set()
        for emp in empresas:
            cnpj_num = re.sub(r"\D", "", emp.cnpj)
            if emp.id_empresa in self.empresas or cnpjs_vistos.__contains__(cnpj_num):
                raise ValidacaoDominioError(f"Empresa duplicada (ID ou CNPJ): {emp.id_empresa}")
            self.empresas[emp.id_empresa] = emp
            cnpjs_vistos.add(cnpj_num)

        self.usuarios: Dict[int, Usuario] = {}
        cpfs_vistos: Set[str] = set()
        emails_vistos: Set[str] = set()
        creas_vistos: Set[str] = set()

        for usr in usuarios:
            cpf_num = re.sub(r"\D", "", usr.cpf)
            email_norm = usr.email.strip().lower()
            if (
                usr.id_usuario in self.usuarios
                or cpf_num in cpfs_vistos
                or email_norm in emails_vistos
            ):
                raise ValidacaoDominioError(
                    f"Usuário duplicado (ID, CPF ou Email): {usr.id_usuario}"
                )
            if usr.crea:
                crea_norm = usr.crea.strip().upper()
                if crea_norm in creas_vistos:
                    raise ValidacaoDominioError(f"CREA duplicado: {usr.crea}")
                creas_vistos.add(crea_norm)

            self.usuarios[usr.id_usuario] = usr
            cpfs_vistos.add(cpf_num)
            emails_vistos.add(email_norm)

        # Chave composta (id_usuario, id_empresa) -> VinculoCorporate
        self.vinculos: Dict[Tuple[int, int], VinculoCorporate] = {}
        for vinc in vinculos:
            if vinc.id_usuario not in self.usuarios:
                raise RecursoNaoEncontradoError(f"Usuário {vinc.id_usuario} não encontrado.")
            if vinc.id_empresa not in self.empresas:
                raise RecursoNaoEncontradoError(f"Empresa {vinc.id_empresa} não encontrada.")
            chave = (vinc.id_usuario, vinc.id_empresa)
            if chave in self.vinculos:
                raise ValidacaoDominioError(
                    f"Vínculo duplicado para usuário {vinc.id_usuario} na empresa {vinc.id_empresa}."
                )
            self.vinculos[chave] = vinc

    def validar_acesso_tenant(
        self,
        id_usuario: int,
        id_empresa: int,
        exigir_escrita: bool = False,
    ) -> VinculoCorporate:
        """
        Seção 2.1 e 2.4 da Documentação:
        Verifica se o usuário possui vínculo ativo com a empresa (`Vincula`)
        e se seu `Nivel_Acesso` autoriza a operação solicitada.
        """
        if id_usuario not in self.usuarios:
            raise RecursoNaoEncontradoError(f"Usuário {id_usuario} não cadastrado.")
        if id_empresa not in self.empresas:
            raise RecursoNaoEncontradoError(f"Empresa {id_empresa} não cadastrada.")

        vinculo = self.vinculos.get((id_usuario, id_empresa))
        if vinculo is None:
            raise ViolacaoMultiTenantError(
                f"Acesso negado (Multi-tenant): O usuário {id_usuario} não possui vínculo "
                f"contratual com a empresa {id_empresa}."
            )

        if exigir_escrita and vinculo.nivel_acesso not in self.PAPEIS_ESCRITA:
            raise PermissaoInsuficienteError(
                f"Permissão insuficiente (RBAC): O nível '{vinculo.nivel_acesso.value}' "
                f"não permite alterações em projetos ou topologia."
            )

        return vinculo

    def validar_criacao_projeto(
        self,
        id_usuario_autor: int,
        projeto: ProjetoDominio,
    ) -> ProjetoDominio:
        """
        Seção 3.4 da Documentação (Resolução da Dependência Triangular de Permissionamento):
        Garante que:
        1. O autor da requisição possui vínculo com `projeto.id_empresa` e permissão de escrita.
        2. O `id_engenheiro` indicado possui a especialização `Engenheiro` (CREA válido).
        3. O próprio `id_engenheiro` possui vínculo contratual vigente com `projeto.id_empresa`
           e papel compatível (`Administrador` ou `Projetista`), impedindo que um engenheiro
           da Empresa B assine um projeto da Empresa A.
        """
        # 1. Valida permissão do autor da operação na empresa dona do projeto
        self.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )

        # 2. Valida existência e especialização (p, d) do Engenheiro responsável
        engenheiro = self.usuarios.get(projeto.id_engenheiro)
        if engenheiro is None:
            raise RecursoNaoEncontradoError(
                f"Engenheiro {projeto.id_engenheiro} não encontrado."
            )
        if not engenheiro.eh_engenheiro:
            raise ViolacaoEspecializacaoEngenheiroError(
                f"O usuário {engenheiro.id_usuario} ('{engenheiro.nome}') não possui "
                f"especialização técnica de Engenheiro (CREA ausente)."
            )

        # 3. Valida que o Engenheiro responsável também pertence à mesma Empresa (Triângulo 3.4)
        vinculo_eng = self.vinculos.get((engenheiro.id_usuario, projeto.id_empresa))
        if vinculo_eng is None:
            raise ViolacaoMultiTenantError(
                f"Violação Triangular Multi-tenant: O engenheiro {engenheiro.id_usuario} "
                f"não possui vínculo contratual com a empresa {projeto.id_empresa}."
            )
        if vinculo_eng.nivel_acesso not in self.PAPEIS_ESCRITA:
            raise PermissaoInsuficienteError(
                f"O engenheiro {engenheiro.id_usuario} possui apenas nível "
                f"'{vinculo_eng.nivel_acesso.value}' na empresa {projeto.id_empresa} e não pode assinar projetos."
            )

        return projeto

    def aplicar_soft_delete_ponto_no_projeto(
        self,
        id_usuario_autor: int,
        projeto: ProjetoDominio,
        ponto: PontoRede,
        trechos_ativos: Sequence[TrechoRedeMST],
        novo_status_ponto: StatusPontoProjeto = StatusPontoProjeto.REMOVIDO,
        forcar_cascata_topologica: bool = False,
    ) -> PontoRede:
        """
        Seção 3.3 da Documentação (Soft Delete) e Modelo Físico (ON DELETE RESTRICT):
        - Em vez de deletar fisicamente o registro em `Ponto_Rede`, altera `Status_Ponto`
          na associativa `Contem` para `'Removido'` ou `'Inativo'`.
        - Bloqueia a desativação caso existam `Trecho_Rede` ativos ancorados neste ponto
          (a menos que `forcar_cascata_topologica=True` seja indicado para recalcular a AGM).
        """
        self.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )

        if novo_status_ponto == StatusPontoProjeto.ATIVO:
            raise ValidacaoDominioError(
                "Para exclusão lógica (Soft Delete), o novo status deve ser 'Inativo' ou 'Removido'."
            )

        trechos_dependentes = [
            t
            for t in trechos_ativos
            if t.id_projeto == projeto.id_projeto
            and (t.origem_id == ponto.id_ponto or t.destino_id == ponto.id_ponto)
        ]

        if trechos_dependentes and not forcar_cascata_topologica:
            ids_trechos = [t.id_trecho for t in trechos_dependentes]
            raise ViolacaoIntegridadeTopologicaError(
                f"Bloqueio de integridade (RESTRICT): O ponto {ponto.id_ponto} ancora "
                f"os trechos ativos {ids_trechos} no projeto {projeto.id_projeto}. "
                f"Recalcule a malha ou habilite o recálculo topológico."
            )

        return replace(ponto, status_ponto=novo_status_ponto.value)

