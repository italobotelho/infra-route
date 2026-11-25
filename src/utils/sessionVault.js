/**
 * Gerenciador de Sessão JWT Isolada por Aba (POO ES6 — Aulas 14 e 15 + BDR POO).
 *
 * Permite abrir duas abas lado a lado no mesmo navegador com perfis diferentes
 * (ex.: Aba 1 como Projetista editando no mapa GIS e Aba 2 como Auditor/Admin
 * acompanhando os logs em tempo real) usando `sessionStorage` por aba como fonte primária.
 */

import {
  STORAGE_KEYS,
  decodeJwtPayload,
  isJwtExpired,
  sanitizeForStorage,
} from "./storage";

export const DEMO_PERSONAS = [
  {
    id: "superadmin-global",
    nomeCurto: "SecOps / Auditor Global",
    descricao: "Plataforma · Logs Multi-Empresa",
    nivel: "SuperAdmin",
    empresa: "InfraRoute Plataforma (Global)",
    email: "secops@infraroute.com.br",
    badgeClass: "border-rose-300 bg-rose-50 text-rose-800",
  },
  {
    id: "admin-e1",
    nomeCurto: "Engenheiro Admin",
    descricao: "CREA · InfraTelecom (Empresa 1)",
    nivel: "Administrador",
    empresa: "InfraTelecom S.A.",
    email: "engenheiro@empresa.com.br",
    badgeClass: "border-blue-300 bg-blue-50 text-blue-800",
  },
  {
    id: "projetista-e1",
    nomeCurto: "Eng. Marina (Projetista)",
    descricao: "CREA · InfraTelecom (Empresa 1)",
    nivel: "Projetista",
    empresa: "InfraTelecom S.A.",
    email: "projetista@empresa.com.br",
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  {
    id: "visualizador-e1",
    nomeCurto: "Analista Auditor",
    descricao: "Somente Leitura · InfraTelecom",
    nivel: "Visualizador",
    empresa: "InfraTelecom S.A.",
    email: "auditor@empresa.com.br",
    badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
  },
  {
    id: "gestor-e2",
    nomeCurto: "Gestor ConectaSul",
    descricao: "Tenant #2 · ConectaSul Fibra",
    nivel: "Administrador",
    empresa: "ConectaSul Ltda.",
    email: "gestor@conectasul.com.br",
    badgeClass: "border-purple-300 bg-purple-50 text-purple-800",
  },
];

export function podeAcessarLogsAuditoria(nivelAcesso) {
  return ["SuperAdmin", "Administrador", "Visualizador"].includes(nivelAcesso);
}

export function ehPerfilSomenteLeituraProjetos(nivelAcesso) {
  return ["Visualizador", "SuperAdmin"].includes(nivelAcesso);
}

export class TabSessionManager {
  #sessionKey;
  #legacyKey;
  #tabIsolatedKey;

  constructor(
    sessionKey = STORAGE_KEYS.AUTH_SESSION,
    legacyKey = STORAGE_KEYS.LEGACY_AUTH_SESSION,
  ) {
    this.#sessionKey = sessionKey;
    this.#legacyKey = legacyKey;
    this.#tabIsolatedKey = `${sessionKey}:tab-isolated`;
  }

  #readJson(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      storage.removeItem(key);
      return null;
    }
  }

  #enrichSession(rawSession) {
    if (!rawSession) return null;
    if (rawSession.access_token && isJwtExpired(rawSession.access_token)) {
      this.clearSession();
      return null;
    }
    const claims = rawSession.access_token ? decodeJwtPayload(rawSession.access_token) : null;
    return claims ? { ...rawSession, jwt_claims: claims } : rawSession;
  }

  isTabIsolated() {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(this.#tabIsolatedKey) === "1";
  }

  getSession() {
    if (typeof window === "undefined") return null;

    const tabSession = this.#readJson(window.sessionStorage, this.#sessionKey);
    if (tabSession) {
      return this.#enrichSession(tabSession);
    }

    if (this.isTabIsolated()) {
      return null;
    }

    const sharedSession =
      this.#readJson(window.localStorage, this.#sessionKey) ||
      this.#readJson(window.localStorage, this.#legacyKey);

    if (!sharedSession) return null;

    const enriched = this.#enrichSession(sharedSession);
    if (enriched) {
      try {
        window.sessionStorage.setItem(
          this.#sessionKey,
          JSON.stringify(sanitizeForStorage(sharedSession)),
        );
      } catch {
        // ignora falha de quota em sessionStorage
      }
    }
    return enriched;
  }

  saveSession(session, { isolateTab = false } = {}) {
    if (typeof window === "undefined" || !session) return;
    const safeSession = sanitizeForStorage(session);
    const serialized = JSON.stringify(safeSession);

    try {
      window.sessionStorage.setItem(this.#sessionKey, serialized);
      if (isolateTab) {
        window.sessionStorage.setItem(this.#tabIsolatedKey, "1");
      } else {
        window.sessionStorage.removeItem(this.#tabIsolatedKey);
        window.localStorage.setItem(this.#sessionKey, serialized);
        window.localStorage.setItem(this.#legacyKey, serialized);
      }
    } catch {
      // ignora falha de escrita em storage
    }
  }

  clearSession() {
    if (typeof window === "undefined") return;
    const isolated = this.isTabIsolated();
    try {
      window.sessionStorage.removeItem(this.#sessionKey);
      if (isolated) {
        window.sessionStorage.setItem(this.#tabIsolatedKey, "1");
      } else {
        window.localStorage.removeItem(this.#sessionKey);
        window.localStorage.removeItem(this.#legacyKey);
      }
    } catch {
      // ignora erro de acesso
    }
  }

  inspectTokenParts(token = this.getSession()?.access_token) {
    if (typeof token !== "string" || !token.trim()) return null;
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;

    const decodePart = (b64u) => {
      try {
        const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
        const decoded = decodeURIComponent(
          window
            .atob(padded)
            .split("")
            .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
            .join(""),
        );
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    };

    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    const exp = Number(payload?.exp);
    const secondsRemaining = Number.isFinite(exp)
      ? Math.max(0, exp - Math.floor(Date.now() / 1000))
      : null;

    return {
      rawHeader: parts[0],
      rawPayload: parts[1],
      signature: parts[2],
      header,
      payload,
      secondsRemaining,
    };
  }
}

export const sessionManager = new TabSessionManager();
