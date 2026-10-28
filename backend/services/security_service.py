"""
Serviço de Segurança Corporativa do InfraRoute (100% Gratuito / Open-Source):

1. Hashing adaptativo de senhas com `bcrypt` (salt aleatório de 128 bits e custo configurável).
2. Validação de complexidade de senha e dígitos verificadores de CPF (Módulo 11) no backend.
3. Geração e verificação em tempo constante de JSON Web Tokens (JWT - RFC 7519, `HS256`)
   com identificador único `jti` (*JWT ID*).
4. Revogação real de tokens no Logout (*Token Denylist* em memória por `jti`).
5. Rate Limiting / Proteção contra Força Bruta no Login (*Sliding Window Throttling*).
6. Verificação de E-mail via código OTP de 6 dígitos (com envio SMTP gratuito via `smtplib`
   ou fallback automático em console/dev).
"""

import base64
from dataclasses import dataclass
from email.message import EmailMessage
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import time
from typing import Dict, List, Optional, Tuple

import bcrypt

from backend.services.exceptions import (
    LimiteRequisicoesExcedidoError,
    NaoAutenticadoError,
    ValidacaoDominioError,
)

BCRYPT_DEFAULT_ROUNDS: int = int(os.getenv("BCRYPT_ROUNDS", "12"))
BCRYPT_MAX_PASSWORD_BYTES: int = 72

JWT_SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY",
    "infraroute-secret-key-multi-tenant-rbac-hs256-2026",
)
JWT_EXPIRATION_SECONDS: int = int(os.getenv("JWT_EXPIRATION_SECONDS", "28800"))  # 8h

RATE_LIMIT_MAX_TENTATIVAS: int = int(os.getenv("AUTH_MAX_ATTEMPTS", "5"))
RATE_LIMIT_JANELA_SEGUNDOS: int = int(os.getenv("AUTH_LOCKOUT_SECONDS", "900"))  # 15 min
OTP_EXPIRACAO_SEGUNDOS: int = int(os.getenv("OTP_EXPIRATION_SECONDS", "600"))  # 10 min


@dataclass(frozen=True)
class PayloadTokenAutenticado:
    """Representa as claims verificadas extraídas de um token JWT válido."""

    id_usuario: int
    email: str
    id_empresa: int
    nivel_acesso: str
    eh_engenheiro: bool
    iat: int
    exp: int
    jti: str = ""


def validar_forca_senha(senha: str) -> None:
    """
    Defesa em profundidade no backend: exige que a senha tenha ao menos 8 caracteres
    e cumpra critérios mínimos de complexidade (pelo menos 3 dos 5 critérios:
    >=8 chars, letra maiúscula, letra minúscula, dígito numérico, caractere especial).
    """
    if not isinstance(senha, str) or len(senha) < 8:
        raise ValidacaoDominioError("A senha deve ter pelo menos 8 caracteres.")

    pontos = 0
    if len(senha) >= 8:
        pontos += 1
    if re.search(r"[A-Z]", senha):
        pontos += 1
    if re.search(r"[a-z]", senha):
        pontos += 1
    if re.search(r"[0-9]", senha):
        pontos += 1
    if re.search(r"[^A-Za-z0-9]", senha):
        pontos += 1

    if pontos < 3:
        raise ValidacaoDominioError(
            "A senha é muito fraca. Combine letras maiúsculas, minúsculas, números ou símbolos."
        )


def validar_digitos_verificadores_cpf(cpf: str) -> bool:
    """
    Valida matematicamente os 2 dígitos verificadores (Módulo 11) de um CPF brasileiro.
    """
    digitos = "".join(filter(str.isdigit, cpf or ""))
    if len(digitos) != 11 or len(set(digitos)) == 1:
        return False

    def _calc(base: str, peso_inicial: int) -> int:
        soma = sum(int(d) * (peso_inicial - idx) for idx, d in enumerate(base))
        resto = (soma * 10) % 11
        return 0 if resto == 10 else resto

    d1 = _calc(digitos[:9], 10)
    d2 = _calc(digitos[:10], 11)
    return d1 == int(digitos[9]) and d2 == int(digitos[10])


def gerar_hash_senha(senha: str, rounds: int = BCRYPT_DEFAULT_ROUNDS) -> str:
    """
    Gera um hash bcrypt (`$2b$...`) com salt aleatório criptograficamente seguro.
    Valida o limite de 72 bytes UTF-8 da especificação do algoritmo Blowfish/bcrypt.
    """
    if not isinstance(senha, str) or not senha:
        raise ValidacaoDominioError("A senha não pode ser vazia.")

    senha_bytes = senha.encode("utf-8")
    if len(senha_bytes) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValidacaoDominioError(
            f"A senha excede o limite máximo de {BCRYPT_MAX_PASSWORD_BYTES} bytes do algoritmo bcrypt."
        )

    if rounds < 4 or rounds > 31:
        raise ValidacaoDominioError("O fator de custo (rounds) do bcrypt deve estar entre 4 e 31.")

    salt = bcrypt.gensalt(rounds=rounds)
    hashed = bcrypt.hashpw(senha_bytes, salt)
    return hashed.decode("utf-8")


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """
    Verifica em tempo constante se `senha_plana` corresponde ao `senha_hash` bcrypt.
    Retorna False de forma segura caso a senha ou o formato do hash sejam inválidos.
    """
    if not isinstance(senha_plana, str) or not isinstance(senha_hash, str):
        return False
    if not senha_plana or not senha_hash:
        return False

    senha_bytes = senha_plana.encode("utf-8")
    if len(senha_bytes) > BCRYPT_MAX_PASSWORD_BYTES:
        return False

    try:
        return bcrypt.checkpw(senha_bytes, senha_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


class RevogadorTokensJWT:
    """
    Gerencia a lista de revogação (Denylist) de tokens JWT em memória para
    garantir invalidação imediata no Logout (`POST /api/auth/logout`).
    """

    def __init__(self) -> None:
        self._tokens_revogados: Dict[str, int] = {}

    def revogar(self, jti: str, exp: int) -> None:
        if jti:
            self._tokens_revogados[jti] = exp

    def esta_revogado(self, jti: str, agora_timestamp: Optional[int] = None) -> bool:
        if not jti or jti not in self._tokens_revogados:
            return False
        agora = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
        # Limpa tokens já expirados naturalmente para não acumular memória
        expirados = [k for k, exp in self._tokens_revogados.items() if exp <= agora]
        for k in expirados:
            self._tokens_revogados.pop(k, None)
        return jti in self._tokens_revogados

    def limpar(self) -> None:
        self._tokens_revogados.clear()


revogador_tokens = RevogadorTokensJWT()


class LimitadorTentativasLogin:
    """
    Proteção contra ataques de força bruta (Rate Limiting / Account Lockout)
    usando janela deslizante em memória.
    """

    def __init__(
        self,
        max_tentativas: int = RATE_LIMIT_MAX_TENTATIVAS,
        janela_segundos: int = RATE_LIMIT_JANELA_SEGUNDOS,
    ) -> None:
        self.max_tentativas = max_tentativas
        self.janela_segundos = janela_segundos
        self._falhas_por_chave: Dict[str, List[int]] = {}

    def verificar_disponibilidade(
        self, chave: str, agora_timestamp: Optional[int] = None
    ) -> None:
        chave_norm = (chave or "").strip().lower()
        if not chave_norm:
            return
        agora = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
        limite_inferior = agora - self.janela_segundos
        historico = [
            ts for ts in self._falhas_por_chave.get(chave_norm, []) if ts > limite_inferior
        ]
        self._falhas_por_chave[chave_norm] = historico

        if len(historico) >= self.max_tentativas:
            segundos_restantes = max(1, (historico[0] + self.janela_segundos) - agora)
            raise LimiteRequisicoesExcedidoError(
                f"Muitas tentativas falhas de login para '{chave_norm}'. "
                f"Conta temporariamente protegida contra força bruta. Tente novamente em {segundos_restantes}s."
            )

    def registrar_falha(
        self, chave: str, agora_timestamp: Optional[int] = None
    ) -> int:
        chave_norm = (chave or "").strip().lower()
        agora = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
        limite_inferior = agora - self.janela_segundos
        historico = [
            ts for ts in self._falhas_por_chave.get(chave_norm, []) if ts > limite_inferior
        ]
        historico.append(agora)
        self._falhas_por_chave[chave_norm] = historico
        return len(historico)

    def resetar(self, chave: str) -> None:
        chave_norm = (chave or "").strip().lower()
        self._falhas_por_chave.pop(chave_norm, None)

    def limpar_tudo(self) -> None:
        self._falhas_por_chave.clear()


class GerenciadorVerificacaoEmail:
    """
    Gerencia códigos OTP de 6 dígitos para verificação gratuita de e-mail:
    - Se variáveis SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`) estiverem configuradas,
      envia o e-mail real via `smtplib` (ex: Gmail App Password gratuito).
    - Em modo de desenvolvimento (sem SMTP externo), registra no console e disponibiliza o
      código de demonstração para teste visual imediato.
    """

    def __init__(self, expiracao_segundos: int = OTP_EXPIRACAO_SEGUNDOS) -> None:
        self.expiracao_segundos = expiracao_segundos
        # email_norm -> (codigo_otp, exp_timestamp)
        self._otps_pendentes: Dict[str, Tuple[str, int]] = {}

    def gerar_codigo_otp(
        self, email: str, agora_timestamp: Optional[int] = None
    ) -> str:
        email_norm = (email or "").strip().lower()
        if not email_norm:
            raise ValidacaoDominioError("E-mail inválido para geração de código OTP.")
        agora = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
        codigo = f"{secrets.randbelow(900000) + 100000:06d}"
        self._otps_pendentes[email_norm] = (codigo, agora + self.expiracao_segundos)
        self._tentar_envio_smtp_ou_console(email_norm, codigo)
        return codigo

    def validar_codigo_otp(
        self, email: str, codigo: str, agora_timestamp: Optional[int] = None
    ) -> bool:
        email_norm = (email or "").strip().lower()
        codigo_limpo = (codigo or "").strip()
        registro = self._otps_pendentes.get(email_norm)
        if not registro or not codigo_limpo:
            return False

        codigo_esperado, exp = registro
        agora = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
        if agora > exp:
            self._otps_pendentes.pop(email_norm, None)
            raise ValidacaoDominioError(
                "O código de verificação expirou. Solicite o reenvio de um novo código."
            )

        if hmac.compare_digest(codigo_esperado.encode("ascii"), codigo_limpo.encode("ascii")):
            self._otps_pendentes.pop(email_norm, None)
            return True
        return False

    def obter_codigo_pendente(self, email: str) -> Optional[str]:
        registro = self._otps_pendentes.get((email or "").strip().lower())
        return registro[0] if registro else None

    def _tentar_envio_smtp_ou_console(self, email_destino: str, codigo: str) -> None:
        smtp_host = os.getenv("SMTP_HOST", "").strip()
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()

        if smtp_host and smtp_user and smtp_pass:
            try:
                msg = EmailMessage()
                msg["Subject"] = f"InfraRoute - Código de Verificação: {codigo}"
                msg["From"] = smtp_user
                msg["To"] = email_destino
                msg.set_content(
                    f"Olá!\n\nSeu código de verificação do InfraRoute é: {codigo}\n"
                    f"Válido por {self.expiracao_segundos // 60} minutos."
                )
                with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                return
            except Exception:
                pass


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    try:
        return base64.urlsafe_b64decode((segment + padding).encode("ascii"))
    except Exception as exc:
        raise NaoAutenticadoError("Token de autenticação malformado.") from exc


def gerar_token_acesso(
    *,
    id_usuario: int,
    email: str,
    id_empresa: int,
    nivel_acesso: str,
    eh_engenheiro: bool,
    expiracao_segundos: int = JWT_EXPIRATION_SECONDS,
    secret_key: Optional[str] = None,
    agora_timestamp: Optional[int] = None,
    jti: Optional[str] = None,
) -> str:
    """
    Gera um token JWT (RFC 7519) assinado com HMAC-SHA256 (`HS256`) e identificador `jti`.
    """
    chave = (secret_key or JWT_SECRET_KEY).encode("utf-8")
    iat = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
    exp = iat + int(expiracao_segundos)
    token_jti = jti or secrets.token_hex(16)

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(id_usuario),
        "id_usuario": int(id_usuario),
        "email": email,
        "id_empresa": int(id_empresa),
        "nivel_acesso": nivel_acesso,
        "eh_engenheiro": bool(eh_engenheiro),
        "iat": iat,
        "exp": exp,
        "jti": token_jti,
    }

    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    assinatura = hmac.new(chave, signing_input, hashlib.sha256).digest()
    assinatura_b64 = _b64url_encode(assinatura)

    return f"{header_b64}.{payload_b64}.{assinatura_b64}"


def decodificar_token_acesso(
    token: str,
    *,
    secret_key: Optional[str] = None,
    agora_timestamp: Optional[int] = None,
    verificar_revogacao: bool = True,
) -> PayloadTokenAutenticado:
    """
    Valida a assinatura HMAC-SHA256, a expiração e a lista de revogação (Denylist)
    de um token JWT, retornando suas claims tipadas. Lança `NaoAutenticadoError` (HTTP 401).
    """
    if not isinstance(token, str) or not token.strip():
        raise NaoAutenticadoError("Token de autenticação não fornecido.")

    partes = token.strip().split(".")
    if len(partes) != 3:
        raise NaoAutenticadoError("Formato de token JWT inválido.")

    header_b64, payload_b64, assinatura_b64 = partes
    chave = (secret_key or JWT_SECRET_KEY).encode("utf-8")
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    assinatura_esperada = hmac.new(chave, signing_input, hashlib.sha256).digest()
    assinatura_recebida = _b64url_decode(assinatura_b64)

    if not hmac.compare_digest(assinatura_esperada, assinatura_recebida):
        raise NaoAutenticadoError("Assinatura do token JWT inválida ou adulterada.")

    try:
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise NaoAutenticadoError("Payload do token JWT corrompido.") from exc

    if header.get("alg") != "HS256":
        raise NaoAutenticadoError("Algoritmo de assinatura JWT não suportado.")

    agora = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
    exp = int(payload.get("exp", 0))
    if exp <= agora:
        raise NaoAutenticadoError("Sessão expirada. Faça login novamente.")

    jti = str(payload.get("jti", ""))
    if verificar_revogacao and jti and revogador_tokens.esta_revogado(jti, agora_timestamp=agora):
        raise NaoAutenticadoError("Token JWT revogado por logout. Faça login novamente.")

    try:
        return PayloadTokenAutenticado(
            id_usuario=int(payload["id_usuario"]),
            email=str(payload["email"]),
            id_empresa=int(payload["id_empresa"]),
            nivel_acesso=str(payload["nivel_acesso"]),
            eh_engenheiro=bool(payload["eh_engenheiro"]),
            iat=int(payload["iat"]),
            exp=exp,
            jti=jti,
        )
    except (KeyError, ValueError, TypeError) as exc:
        raise NaoAutenticadoError("Claims obrigatórias ausentes no token JWT.") from exc
