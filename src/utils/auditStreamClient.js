/**
 * Cliente Orientado a Objetos (POO ES6) para monitoramento em tempo real
 * da Trilha de Auditoria (`Log_Auditoria`).
 * Utiliza Server-Sent Events (SSE) com fallback automático para polling incremental (`since_id`).
 */

export class AuditStreamClient {
  #apiBase;
  #token;
  #lastEventId;
  #eventSource;
  #pollTimer;
  #running;
  #mode;
  #onEvents;
  #onStatusChange;

  constructor({
    apiBase = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, ""),
    token = "",
    initialLastId = 0,
  } = {}) {
    this.#apiBase = apiBase;
    this.#token = token;
    this.#lastEventId = Number(initialLastId) || 0;
    this.#eventSource = null;
    this.#pollTimer = null;
    this.#running = false;
    this.#mode = "paused";
    this.#onEvents = () => {};
    this.#onStatusChange = () => {};
  }

  getStatus() {
    return this.#mode;
  }

  setLastEventId(lastId) {
    const parsed = Number(lastId) || 0;
    if (parsed > this.#lastEventId) {
      this.#lastEventId = parsed;
    }
  }

  #setMode(nextMode) {
    if (this.#mode !== nextMode) {
      this.#mode = nextMode;
      this.#onStatusChange(nextMode);
    }
  }

  #emitBatch(events) {
    if (!Array.isArray(events) || events.length === 0) return;
    const maxId = Math.max(...events.map((e) => Number(e.id_evento) || 0));
    if (maxId > this.#lastEventId) {
      this.#lastEventId = maxId;
    }
    this.#onEvents(events);
  }

  async fetchIncremental() {
    if (!this.#token || !this.#running) return;
    try {
      const url = `${this.#apiBase}/auth/auditoria?since_id=${this.#lastEventId}&limit=50`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.#token}` },
      });
      if (response.status === 403 || response.status === 401) {
        this.stop();
        this.#setMode("forbidden");
        return;
      }
      if (!response.ok) return;
      const items = await response.json();
      if (Array.isArray(items) && items.length > 0) {
        this.#emitBatch(items);
      }
    } catch {
      // ignora erro transitório de rede durante polling
    }
  }

  #startPollingFallback() {
    if (!this.#running || this.#pollTimer) return;
    this.#setMode("polling");
    this.#pollTimer = window.setInterval(() => {
      if (!this.#running) return;
      if (typeof document !== "undefined" && document.hidden) return;
      this.fetchIncremental();
    }, 1500);
  }

  async #solicitarTicketStream() {
    const response = await fetch(`${this.#apiBase}/auth/auditoria/stream-ticket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/json",
      },
    });
    if (response.status === 403 || response.status === 401) {
      throw Object.assign(new Error("Acesso negado ao stream de logs."), { status: response.status });
    }
    if (!response.ok) {
      throw new Error("Falha ao emitir ticket SSE.");
    }
    const data = await response.json();
    return data?.ticket || "";
  }

  async start({ initialLastId, onEvents, onStatusChange } = {}) {
    this.stop();
    if (typeof initialLastId === "number") {
      this.setLastEventId(initialLastId);
    }
    if (typeof onEvents === "function") this.#onEvents = onEvents;
    if (typeof onStatusChange === "function") this.#onStatusChange = onStatusChange;
    if (!this.#token) {
      this.#setMode("paused");
      return;
    }

    this.#running = true;

    if (typeof window !== "undefined" && typeof window.EventSource === "function") {
      try {
        const ticket = await this.#solicitarTicketStream();
        if (!this.#running) return;
        const streamUrl = `${this.#apiBase}/auth/auditoria/stream?ticket=${encodeURIComponent(
          ticket,
        )}&since_id=${this.#lastEventId}`;
        const es = new window.EventSource(streamUrl);
        this.#eventSource = es;

        es.onopen = () => {
          if (this.#running) this.#setMode("sse");
        };

        es.addEventListener("audit", (event) => {
          if (!this.#running || !event?.data) return;
          try {
            const parsed = JSON.parse(event.data);
            this.#emitBatch([parsed]);
          } catch {
            // ignora payload inválido
          }
        });

        es.onerror = () => {
          if (!this.#running) return;
          if (this.#eventSource) {
            this.#eventSource.close();
            this.#eventSource = null;
          }
          this.#startPollingFallback();
        };
        return;
      } catch (err) {
        if (err?.status === 403 || err?.status === 401) {
          this.#running = false;
          this.#setMode("forbidden");
          return;
        }
        // cai no fallback de polling abaixo
      }
    }

    if (this.#running) {
      this.#startPollingFallback();
    }
  }

  stop() {
    this.#running = false;
    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = null;
    }
    if (this.#pollTimer) {
      window.clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
    this.#setMode("paused");
  }
}
