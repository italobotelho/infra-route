"""
Serviço resiliente de validação e normalização de registro CREA (CONFEA/CREA).

Camadas de validação:
1. Validação estrutural e de domínio (sempre ativa, offline):
   - Aceita formatos `UF-NUMERO`, `UF-NUMERO/D`, `UF-NUMERO/P`, `CREA-UF NUMERO`
     ou apenas dígitos (RNP / legado, com `uf_padrao` opcional).
   - Valida UF oficial (27 estados brasileiros).
   - Valida comprimento do número (6 a 10 dígitos) e rejeita sequências repetidas.
   - Valida sufixo opcional (`/D` Definitivo ou `/P` Provisório).
2. Provedor HTTP externo opcional (via `.env`):
   - Quando `CREA_VALIDATION_PROVIDER=http` e `CREA_API_URL` estiverem configurados,
     consulta a API externa com cache TTL em memória e fallback configurável.
"""

from dataclasses import dataclass
import json
import os
import re
import time
from typing import Any, Callable, Dict, Optional, Tuple
from urllib import request as urllib_request

from backend.services.exceptions import ValidacaoDominioError

UFS_BRASIL: frozenset[str] = frozenset(
    {
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
        "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
        "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
    }
)

_SUFIXOS_PERMITIDOS: frozenset[str] = frozenset({"D", "P"})
_STATUS_ATIVOS_EXTERNOS: frozenset[str] = frozenset(
    {"ATIVO", "ATIVA", "REGULAR", "VALIDO", "VÁLIDO", "OK"}
)
_STATUS_IRREGULARES_EXTERNOS: frozenset[str] = frozenset(
    {"INATIVO", "INATIVA", "IRREGULAR", "SUSPENSO", "SUSPENSA", "CANCELADO", "CANCELADA", "CASSADO", "NAO_ENCONTRADO", "NÃO ENCONTRADO"}
)

_REGEX_COM_UF = re.compile(
    r"^([A-Z]{2})[\s\-./]*(\d{1,15})(?:\s*[/\-]\s*([A-Z]+))?$"
)
_REGEX_APENAS_DIGITOS = re.compile(
    r"^(\d{1,15})(?:\s*[/\-]\s*([A-Z]+))?$"
)


@dataclass(frozen=True)
class ResultadoValidacaoCrea:
    valido: bool
    crea_normalizado: str
    uf: Optional[str]
    numero: str
    sufixo: Optional[str]
    provedor: str
    situacao: str
    detalhes: str


def validar_e_normalizar_crea(
    crea: str,
    uf_padrao: Optional[str] = None,
) -> ResultadoValidacaoCrea:
    """
    Valida formato, UF, faixa numérica (6..10 dígitos), dígitos repetidos e sufixo (`/D`, `/P`),
    retornando o registro normalizado em maiúsculas (ex.: `SP-5060708090` ou `MG-123456/D`).
    """
    if crea is None or not str(crea).strip():
        raise ValidacaoDominioError("Registro CREA não pode ser uma string em branco.")

    bruto = str(crea).strip().upper()
    if bruto.startswith("CREA-"):
        bruto = bruto[5:].strip()
    elif bruto.startswith("CREA "):
        bruto = bruto[5:].strip()

    uf: Optional[str] = None
    numero: str = ""
    sufixo: Optional[str] = None

    match_uf = _REGEX_COM_UF.match(bruto)
    if match_uf:
        uf, numero, sufixo = match_uf.group(1), match_uf.group(2), match_uf.group(3)
    else:
        match_num = _REGEX_APENAS_DIGITOS.match(bruto)
        if not match_num:
            raise ValidacaoDominioError(
                "Formato de CREA inválido. Use UF-NUMERO (ex.: SP-5060708090 ou MG-123456/D)."
            )
        numero, sufixo = match_num.group(1), match_num.group(2)

    if uf is not None and uf not in UFS_BRASIL:
        raise ValidacaoDominioError(f"UF do CREA inválida: {uf}.")

    if len(numero) < 6 or len(numero) > 10:
        raise ValidacaoDominioError(
            "Número do CREA deve conter entre 6 e 10 dígitos."
        )

    if len(set(numero)) == 1:
        raise ValidacaoDominioError(
            "Número do CREA inválido: sequência de dígitos repetidos."
        )

    if sufixo is not None and sufixo not in _SUFIXOS_PERMITIDOS:
        raise ValidacaoDominioError(
            "Sufixo do CREA inválido. Utilize apenas /D (Definitivo) ou /P (Provisório)."
        )

    uf_final = uf or (uf_padrao.strip().upper() if uf_padrao and uf_padrao.strip() else None)
    if uf_final is not None and uf_final not in UFS_BRASIL:
        raise ValidacaoDominioError(f"UF padrão do CREA inválida: {uf_final}.")

    base = f"{uf_final}-{numero}" if uf_final else numero
    crea_normalizado = f"{base}/{sufixo}" if sufixo else base

    return ResultadoValidacaoCrea(
        valido=True,
        crea_normalizado=crea_normalizado,
        uf=uf_final,
        numero=numero,
        sufixo=sufixo,
        provedor="local",
        situacao="FORMATO_VALIDO",
        detalhes="Formato e UF do registro CREA validados localmente.",
    )


def _default_http_fetcher(
    url: str,
    payload: Dict[str, Any],
    headers: Dict[str, str],
    timeout_seconds: float,
) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(url=url, data=body, headers=headers, method="POST")
    with urllib_request.urlopen(req, timeout=timeout_seconds) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


class CreaValidationService:
    """
    Orquestrador de validação de CREA com cache TTL em memória, provedor HTTP
    opcional configurável via ambiente e fallback seguro para validação local.
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        api_url: Optional[str] = None,
        api_token: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        strict_mode: Optional[bool] = None,
        cache_ttl_seconds: Optional[int] = None,
        http_fetcher: Optional[Callable[[str, Dict[str, Any], Dict[str, str], float], Dict[str, Any]]] = None,
    ) -> None:
        self.provider = (
            provider
            if provider is not None
            else os.getenv("CREA_VALIDATION_PROVIDER", "local")
        ).strip().lower()
        self.api_url = (
            api_url if api_url is not None else os.getenv("CREA_API_URL", "")
        ).strip()
        self.api_token = (
            api_token if api_token is not None else os.getenv("CREA_API_TOKEN", "")
        ).strip()
        self.timeout_seconds = (
            float(timeout_seconds)
            if timeout_seconds is not None
            else float(os.getenv("CREA_API_TIMEOUT_SECONDS", "5.0"))
        )
        self.strict_mode = (
            bool(strict_mode)
            if strict_mode is not None
            else os.getenv("CREA_API_STRICT_MODE", "false").strip().lower()
            in ("1", "true", "yes", "sim")
        )
        self.cache_ttl_seconds = (
            int(cache_ttl_seconds)
            if cache_ttl_seconds is not None
            else int(os.getenv("CREA_CACHE_TTL_SECONDS", "900"))
        )
        self._http_fetcher = http_fetcher or _default_http_fetcher
        self._cache: Dict[str, Tuple[float, ResultadoValidacaoCrea, Optional[str]]] = {}

    def _obter_cache(
        self, chave: str
    ) -> Optional[Tuple[ResultadoValidacaoCrea, Optional[str]]]:
        entrada = self._cache.get(chave)
        if not entrada:
            return None
        expira_em, resultado, erro_msg = entrada
        if time.monotonic() >= expira_em:
            self._cache.pop(chave, None)
            return None
        return resultado, erro_msg

    def _salvar_cache(
        self,
        chave: str,
        resultado: ResultadoValidacaoCrea,
        erro_msg: Optional[str] = None,
    ) -> None:
        if self.cache_ttl_seconds <= 0:
            return
        self._cache[chave] = (
            time.monotonic() + self.cache_ttl_seconds,
            resultado,
            erro_msg,
        )

    def validar_registro(
        self,
        crea: str,
        cpf: Optional[str] = None,
        uf_padrao: Optional[str] = "SP",
    ) -> ResultadoValidacaoCrea:
        resultado_local = validar_e_normalizar_crea(crea, uf_padrao=uf_padrao)

        if self.provider != "http" or not self.api_url:
            return resultado_local

        cached = self._obter_cache(resultado_local.crea_normalizado)
        if cached is not None:
            res_cached, erro_cached = cached
            if erro_cached:
                raise ValidacaoDominioError(erro_cached)
            return res_cached

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        payload: Dict[str, Any] = {
            "crea": resultado_local.crea_normalizado,
            "uf": resultado_local.uf,
            "numero": resultado_local.numero,
            "sufixo": resultado_local.sufixo,
        }
        if cpf:
            payload["cpf"] = cpf

        try:
            resposta = self._http_fetcher(
                self.api_url, payload, headers, self.timeout_seconds
            )
        except Exception:
            if self.strict_mode:
                raise ValidacaoDominioError(
                    "Não foi possível validar o CREA no provedor externo no momento. Tente novamente."
                )
            return ResultadoValidacaoCrea(
                valido=True,
                crea_normalizado=resultado_local.crea_normalizado,
                uf=resultado_local.uf,
                numero=resultado_local.numero,
                sufixo=resultado_local.sufixo,
                provedor="http_fallback_local",
                situacao="INDISPONIVEL",
                detalhes="Provedor externo indisponível; validação estrutural local aplicada.",
            )

        situacao_bruta = str(
            resposta.get("situacao")
            or resposta.get("status")
            or ""
        ).strip()
        situacao_upper = situacao_bruta.upper()
        ativo_flag = resposta.get("ativo")
        valido_flag = resposta.get("valido")

        eh_valido = (
            valido_flag is True
            or ativo_flag is True
            or situacao_upper in _STATUS_ATIVOS_EXTERNOS
        )
        eh_invalido = (
            valido_flag is False
            or ativo_flag is False
            or situacao_upper in _STATUS_IRREGULARES_EXTERNOS
        )

        if eh_valido and not eh_invalido:
            resultado_http = ResultadoValidacaoCrea(
                valido=True,
                crea_normalizado=resultado_local.crea_normalizado,
                uf=resultado_local.uf,
                numero=resultado_local.numero,
                sufixo=resultado_local.sufixo,
                provedor="http",
                situacao="ATIVO",
                detalhes=str(
                    resposta.get("detalhes")
                    or "Registro CREA confirmado como ativo no provedor externo."
                ),
            )
            self._salvar_cache(resultado_local.crea_normalizado, resultado_http)
            return resultado_http

        situacao_label = situacao_bruta or "IRREGULAR"
        erro_msg = (
            f"Registro CREA {resultado_local.crea_normalizado} não está ativo no conselho ({situacao_label})."
        )
        resultado_invalido = ResultadoValidacaoCrea(
            valido=False,
            crea_normalizado=resultado_local.crea_normalizado,
            uf=resultado_local.uf,
            numero=resultado_local.numero,
            sufixo=resultado_local.sufixo,
            provedor="http",
            situacao=situacao_upper or "IRREGULAR",
            detalhes=erro_msg,
        )
        self._salvar_cache(resultado_local.crea_normalizado, resultado_invalido, erro_msg=erro_msg)
        raise ValidacaoDominioError(erro_msg)
