"""
Serviço de Criptografia de Senhas (bcrypt) e Autenticação Stateless via Token JWT (HS256).

Implementa:
1. Hashing adaptativo de senhas com `bcrypt` (salt aleatório de 128 bits por senha e
   fator de trabalho configurável `rounds`).
2. Geração e verificação em tempo constante de JSON Web Tokens (JWT - RFC 7519)
   assinados com HMAC-SHA256 (`HS256`) contendo contexto Multi-Tenant e RBAC.
"""

import base64
from dataclasses import dataclass
import hashlib
import hmac
import json
import os
import time
from typing import Optional

import bcrypt

from backend.services.exceptions import NaoAutenticadoError, ValidacaoDominioError

BCRYPT_DEFAULT_ROUNDS: int = int(os.getenv("BCRYPT_ROUNDS", "12"))
BCRYPT_MAX_PASSWORD_BYTES: int = 72

JWT_SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY",
    "infraroute-secret-key-multi-tenant-rbac-hs256-2026",
)
JWT_EXPIRATION_SECONDS: int = int(os.getenv("JWT_EXPIRATION_SECONDS", "28800"))  # 8h


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
) -> str:
    """
    Gera um token JWT (RFC 7519) assinado com HMAC-SHA256 (`HS256`).
    """
    chave = (secret_key or JWT_SECRET_KEY).encode("utf-8")
    iat = int(time.time()) if agora_timestamp is None else int(agora_timestamp)
    exp = iat + int(expiracao_segundos)

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
) -> PayloadTokenAutenticado:
    """
    Valida a assinatura HMAC-SHA256 e a expiração de um token JWT, retornando
    suas claims tipadas. Lança `NaoAutenticadoError` (HTTP 401) se inválido.
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

    try:
        return PayloadTokenAutenticado(
            id_usuario=int(payload["id_usuario"]),
            email=str(payload["email"]),
            id_empresa=int(payload["id_empresa"]),
            nivel_acesso=str(payload["nivel_acesso"]),
            eh_engenheiro=bool(payload["eh_engenheiro"]),
            iat=int(payload["iat"]),
            exp=exp,
        )
    except (KeyError, ValueError, TypeError) as exc:
        raise NaoAutenticadoError("Claims obrigatórias ausentes no token JWT.") from exc
