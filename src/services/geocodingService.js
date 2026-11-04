/**
 * Serviço de Geocodificação e Consulta de CEP (Aulas 04 e 05 — Separação de Preocupações).
 * Isola a lógica de integração com Nominatim (OpenStreetMap) e ViaCEP fora dos componentes de UI.
 */

export const CEP_PATTERN = /^\d{5}-?\d{3}$/;

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const nominatimCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimCall = 0;

export function nominatimSearch(params) {
  const key = params.toString();
  if (nominatimCache.has(key)) return Promise.resolve(nominatimCache.get(key));

  const run = async () => {
    const wait = lastNominatimCall + NOMINATIM_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastNominatimCall = Date.now();

    const response = await fetch(`${NOMINATIM_URL}?${key}`);
    if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`);
    const data = await response.json();
    nominatimCache.set(key, data);
    return data;
  };

  const result = nominatimQueue.then(run);
  nominatimQueue = result.catch(() => {});
  return result;
}

export async function lookupCep(cep) {
  const digits = cep.replace(/\D/g, "");
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`);
  const data = await response.json();
  return data.erro ? null : data;
}

