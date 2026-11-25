/**
 * Camada de Comunicação HTTP e Gestão de Sessão JWT (Aulas 04, 05, 14 e 15).
 * Delega armazenamento por aba e inspeção JWT à classe ES6 `TabSessionManager`.
 */

import { sessionManager } from "../utils/sessionVault";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const session = getSession();
  const authHeader = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...authHeader,
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor da API (porta 8000). Verifique se o backend está em execução.",
    );
  }

  let data = null;
  if (response.status !== 204) {
    const rawText = await response.text();
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    const detail = data?.detalhe || data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join(" ")
      : detail;
    if (message) {
      throw new Error(message);
    }
    if (response.status >= 500) {
      throw new Error(
        "Servidor da API indisponível (porta 8000). Verifique se o backend FastAPI está rodando.",
      );
    }
    throw new Error(`Falha na requisição (${response.status}).`);
  }
  return data;
}

export function getSession() {
  return sessionManager.getSession();
}

export function saveSession(session, options = {}) {
  sessionManager.saveSession(session, options);
}

export function clearSession() {
  sessionManager.clearSession();
}

export async function logoutSession() {
  const session = getSession();
  if (session?.access_token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch {
      // prossegue com limpeza local caso a rede falhe
    }
  }
  clearSession();
}
