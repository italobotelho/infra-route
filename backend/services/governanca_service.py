"""
Motor de Governança Corporativa, Isolamento Multi-Tenant, RBAC e Soft Delete.

Implementa as resoluções arquiteturais documentadas em `docs/`:
1. Especialização Parcial e Exclusiva (p, d) de `Usuario` -> `Engenheiro` (CREA obrigatório).
2. Resolução da Dependência Triangular de Permissionamento (Multi-tenant):
   `Empresa` <-> `Projeto` <-> `Engenheiro` via tabela associativa `Vincula`.
3. Controle de Acesso Baseado em Papéis (RBAC):
   `Administrador`, `Projetista` e `Visualizador`.
4. Governança de Exclusão Lógica (Soft Delete), Proteção de Órfãos (ON DELETE RESTRICT)
   e Imutabilidade de Projetos Concluídos/Cancelados.
5. Memoização de `Metragem_Total` e `Custo_Estimado` na entidade `Projeto` (O(1)).
"""

from dataclasses import dataclass, replace
from enum import Enum
import math
import re
from typing import Dict, Optional, Sequence, Set, Tuple

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
    ResultadoMSTProjeto,
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


_VALORES_NIVEL_ACESSO = {e.value for e in NivelAcessoRBAC}
_VALORES_STATUS_PROJETO = {e.value for e in StatusProjetoEnum}


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
        if not (self.telefone and self.telefone.strip()):
            raise ValidacaoDominioError("Telefone do usuário não pode ser vazio.")
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

    def __post_init__(self) -> None:
        if self.id_usuario <= 0 or self.id_empresa <= 0:
            raise ValidacaoDominioError("ID_Usuario e ID_Empresa devem ser inteiros positivos.")
        na_val = (
            self.nivel_acesso.value
            if isinstance(self.nivel_acesso, Enum)
            else str(self.nivel_acesso)
        )
        if na_val not in _VALORES_NIVEL_ACESSO:
            raise ValidacaoDominioError(f"Nivel_Acesso inválido: {na_val}")


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
        st_val = self.status.value if isinstance(self.status, Enum) else str(self.status)
        if st_val not in _VALORES_STATUS_PROJETO:
            raise ValidacaoDominioError(f"Status de projeto inválido: {st_val}")
        if (
            not math.isfinite(self.custo_estimado)
            or not math.isfinite(self.metragem_total)
            or self.custo_estimado < 0
            or self.metragem_total < 0
        ):
            raise ValidacaoDominioError(
                "Custo_Estimado e Metragem_Total devem ser números finitos >= 0."
            )


class GovernancaMultiTenantService:
    """
    Serviço responsável por blindar as regras de negócio de isolamento Multi-tenant,
    RBAC, especialização técnica (Engenheiro/CREA), governança histórica (Soft Delete)
    e atualização memoizada de Projetos.
    """

    PAPEIS_ESCRITA: Set[NivelAcessoRBAC] = {
        NivelAcessoRBAC.ADMINISTRADOR,
        NivelAcessoRBAC.PROJETISTA,
    }
    STATUS_PROJETO_IMUTAVEIS: Set[str] = {
        StatusProjetoEnum.CONCLUIDO.value,
        StatusProjetoEnum.CANCELADO.value,
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

    def _verificar_projeto_editavel(self, projeto: ProjetoDominio) -> None:
        """
        Seção 3.3 da Documentação (Persistência Histórica e Auditabilidade):
        Projetos 'Concluído' ou 'Cancelado' têm seu histórico e custo congelados.
        """
        status_val = (
            projeto.status.value if isinstance(projeto.status, Enum) else str(projeto.status)
        )
        if status_val in self.STATUS_PROJETO_IMUTAVEIS:
            raise ViolacaoIntegridadeTopologicaError(
                f"Projeto {projeto.id_projeto} encontra-se '{status_val}' e está congelado "
                f"para auditoria histórica, não permitindo mutações topológicas."
            )

    def validar_criacao_projeto(
        self,
        id_usuario_autor: int,
        projeto: ProjetoDominio,
    ) -> ProjetoDominio:
        """
        Seção 3.4 da Documentação (Resolução da Dependência Triangular de Permissionamento):
        Garante que o autor e o engenheiro responsável possuem vínculo ativo com a empresa
        detentora do projeto e que o engenheiro possui CREA válido.
        """
        self.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )

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

    def atualizar_memoizacao_projeto(
        self,
        id_usuario_autor: int,
        projeto: ProjetoDominio,
        resultado_mst: ResultadoMSTProjeto,
    ) -> ProjetoDominio:
        """
        Seção 2.5 e 0.2.3 da Documentação (Memoização de Metragem_Total e Custo_Estimado):
        Consolida na entidade `Projeto` os indicadores calculados pelo Algoritmo de Prim,
        garantindo isolamento Multi-tenant, RBAC e proteção de projetos concluídos/cancelados.
        """
        self.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )
        self._verificar_projeto_editavel(projeto)

        if resultado_mst.id_projeto != projeto.id_projeto:
            raise ViolacaoIntegridadeTopologicaError(
                f"Inconsistência de escopo: O resultado da MST pertence ao projeto "
                f"{resultado_mst.id_projeto}, mas foi aplicado ao projeto {projeto.id_projeto}."
            )

        return replace(
            projeto,
            metragem_total=resultado_mst.metragem_total,
            custo_estimado=resultado_mst.custo_estimado,
        )

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
        - Altera `Status_Ponto` na associativa `Contem` para `'Removido'` ou `'Inativo'`.
        - Bloqueia a desativação em projetos congelados ou caso existam `Trecho_Rede` ativos
          ancorados neste ponto sem recálculo topológico autorizado.
        """
        self.validar_acesso_tenant(
            id_usuario=id_usuario_autor,
            id_empresa=projeto.id_empresa,
            exigir_escrita=True,
        )
        self._verificar_projeto_editavel(projeto)

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
