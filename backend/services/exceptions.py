"""
Hierarquia de exceções de domínio do backend InfraRoute.
Permite mapeamento determinístico para códigos de status HTTP na camada de API.
"""


class InfraRouteError(Exception):
    """Exceção base para todos os erros de regra de negócio do InfraRoute."""

    codigo_http: int = 400


class NaoAutenticadoError(InfraRouteError, PermissionError):
    """
    Credenciais ausentes, token JWT inválido, adulterado ou expirado.
    Mapeado para HTTP 401 Unauthorized.
    """

    codigo_http: int = 401


class ValidacaoDominioError(InfraRouteError, ValueError):
    """Erro de validação de atributos, limites físicos ou parâmetros inválidos."""

    codigo_http: int = 422


class ViolacaoMultiTenantError(InfraRouteError, PermissionError):
    """
    Seção 2.1 e 3.4 da Documentação:
    Tentativa de acesso cruzado entre empresas (Cross-Tenant) ou vínculo inexistente
    na tabela associativa `Vincula`.
    """

    codigo_http: int = 403


class PermissaoInsuficienteError(InfraRouteError, PermissionError):
    """
    Seção 2.4 da Documentação (RBAC):
    O usuário possui vínculo com a empresa, mas seu `Nivel_Acesso` (ex: Visualizador)
    não permite operações de escrita ou processamento topológico.
    """

    codigo_http: int = 403


class ViolacaoEspecializacaoEngenheiroError(InfraRouteError, PermissionError):
    """
    Seção 2.3 da Documentação (Especialização Parcial e Exclusiva p, d):
    Tentativa de associar a responsabilidade técnica de um `Projeto` a um `Usuario`
    que não possui especialização em `Engenheiro` (sem registro CREA válido).
    """

    codigo_http: int = 422


class ViolacaoIntegridadeTopologicaError(InfraRouteError):
    """
    Seção 3.1 e Modelo Físico (ON DELETE RESTRICT):
    Violação da dependência triangular ou tentativa de desativar/remover um ativo
    que ainda ancora trechos de rede (`Trecho_Rede`) ativos.
    """

    codigo_http: int = 409


class RecursoNaoEncontradoError(InfraRouteError, LookupError):
    """Entidade solicitada não existe no escopo informado."""

    codigo_http: int = 404
