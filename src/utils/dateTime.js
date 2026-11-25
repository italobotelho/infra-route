/**
 * Utilitários centralizados de Data e Hora (UTC ISO-8601 <-> America/Sao_Paulo pt-BR).
 * Corrige desvios de +3h provocados por fatiamento bruto de strings UTC.
 */

export const TIMEZONE_BR = "America/Sao_Paulo";

export function parseApiUtcDate(input) {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    const ms = input < 1e11 ? input * 1000 : input;
    const dt = new Date(ms);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  let raw = String(input).trim();
  if (!raw) return null;

  // Timestamps SQLite/Postgres sem timezone explícito devem ser tratados como UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    raw = `${raw.replace(" ", "T")}Z`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
    raw = `${raw}Z`;
  }

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getBrParts(dt) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map = {};
  for (const part of formatter.formatToParts(dt)) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  if (map.hour === "24") map.hour = "00";
  return map;
}

export function formatarDataHoraBr(input) {
  const dt = parseApiUtcDate(input);
  if (!dt) return "—";
  const p = getBrParts(dt);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export function formatarDataBr(input) {
  const dt = parseApiUtcDate(input);
  if (!dt) return "—";
  const p = getBrParts(dt);
  return `${p.day}/${p.month}/${p.year}`;
}

export function formatarHoraCurtaBr(input) {
  const dt = parseApiUtcDate(input);
  if (!dt) return "--:--:--";
  const p = getBrParts(dt);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function formatarTempoRelativo(input, agoraMs = Date.now()) {
  const dt = parseApiUtcDate(input);
  if (!dt) return "";
  const diffSeg = Math.max(0, Math.floor((agoraMs - dt.getTime()) / 1000));
  if (diffSeg < 10) return "agora";
  if (diffSeg < 60) return `há ${diffSeg}s`;
  const diffMin = Math.floor(diffSeg / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  return `há ${diffDias}d`;
}

export function formatarInputDatetimeLocalBr(input = new Date()) {
  const dt = parseApiUtcDate(input);
  if (!dt) return "";
  const p = getBrParts(dt);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function converterDatetimeLocalBrParaUtcIso(datetimeLocalStr) {
  if (!datetimeLocalStr || typeof datetimeLocalStr !== "string") return "";
  const match = datetimeLocalStr
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";

  const [, y, m, d, hh, mm, ss = "00"] = match;
  // Converte data/hora de parede de America/Sao_Paulo para UTC exato
  const utcGuessMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
  );
  const guessDate = new Date(utcGuessMs);
  const p = getBrParts(guessDate);
  const brAsUtcMs = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  const offsetMs = brAsUtcMs - utcGuessMs;
  return new Date(utcGuessMs - offsetMs).toISOString();
}
