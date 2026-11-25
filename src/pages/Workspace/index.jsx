import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, getSession } from "../../lib/api";
import { LeafletMapCanvas } from "../../components/LeafletMapCanvas";
import { LiveAuditDrawer } from "../../components/LiveAuditDrawer";
import { ProjectReportModal } from "../../components/ProjectReportModal";
import { QuickPersonaSwitcher } from "../../components/QuickPersonaSwitcher";
import { ehPerfilSomenteLeituraProjetos } from "../../utils/sessionVault";
import { useToast } from "../../components/ToastProvider";
import {
  CEP_PATTERN,
  lookupCep as lookupCepService,
  nominatimSearch as nominatimSearchService,
} from "../../services/geocodingService";
import {
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
} from "../../utils/storage";
import "./workspace-gis.css";

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
const HAS_VALID_GOOGLE_MAPS_KEY = Boolean(
  GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "SUA_CHAVE_AQUI",
);

// Junta nomes de classe, ignorando valores falsos.
const cx = (...names) => names.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/* Ícones vetoriais semânticos do Workspace GIS                        */
/* ------------------------------------------------------------------ */

function WorkspaceIcon({ name, className = "h-4 w-4" }) {
  switch (name) {
    case "brand":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M8.2 7.2L10.8 16M15.8 7.2L13.2 16M8.5 6h7" />
        </svg>
      );
    case "select":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M5 4l6.5 16 2.3-6.2L20 11.5 5 4z" />
          <path d="M13.8 13.8L19 19" />
        </svg>
      );
    case "lasso":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2.5" />
          <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
        </svg>
      );
    case "pole":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3v18" />
          <path d="M7 7h10" />
          <path d="M8.5 11.5h7" />
          <path d="M9 21h6" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="17" cy="7" r="1" fill="currentColor" />
        </svg>
      );
    case "cto":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2.5" />
          <path d="M9 9h6M9 13h6" />
          <circle cx="9.5" cy="16.5" r="1" fill="currentColor" />
          <circle cx="14.5" cy="16.5" r="1" fill="currentColor" />
        </svg>
      );
    case "ceo":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="3" y="7" width="18" height="10" rx="5" />
          <path d="M12 7v10M7.5 12h9" />
        </svg>
      );
    case "olt":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="3" y="5" width="18" height="6" rx="1.5" />
          <rect x="3" y="13" width="18" height="6" rx="1.5" />
          <circle cx="7" cy="8" r="1" fill="currentColor" />
          <circle cx="7" cy="16" r="1" fill="currentColor" />
          <path d="M11 8h6M11 16h6" />
        </svg>
      );
    case "cable":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <path d="M8 16c2.5-2.5 5.5-5.5 8-8" />
        </svg>
      );
    case "snap":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M6 3v7a6 6 0 0 0 12 0V3" />
          <path d="M4 3h4M16 3h4" />
          <path d="M8 20h8" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.8-3.8" />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3L3 8l9 5 9-5-9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17.5l9 4.5 9-4.5" />
        </svg>
      );
    case "params":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2.2" />
          <circle cx="10" cy="17" r="2.2" />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "compass":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3l4.5 15L12 14.5 7.5 18 12 3z" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case "savings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "help":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    case "fit":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
    case "history":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Configuração do mapa                                                */
/* ------------------------------------------------------------------ */

const MAP_CENTER = { lat: -22.8892, lng: -47.0536 }; // Taquaral, Campinas/SP
const DEFAULT_ZOOM = 16;

// Tema escuro do mapa. Só as ruas mantêm nome: comércios, pontos de interesse,
// transporte, bairros, cidades e nomes de água/áreas ficam ocultos.
// Obs.: "styles" só funciona em mapas sem mapId.
const BG = "#111a23";
const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: BG }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#bac6d2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: BG }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14231f" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#162230" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b141c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#243242" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2f4156" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a4f68" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#d1dae2" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: BG }] },
];

const toolItems = [
  {
    id: "select",
    label: "Selecionar · V",
    shortcut: "v",
    icon: "select",
    title: "Selecionar, inspecionar ou arrastar ativos no mapa (Atalho: V)",
  },
  {
    id: "lasso",
    label: "Lasso · L",
    shortcut: "l",
    icon: "lasso",
    title: "Seleção em área: clique em dois cantos opostos no mapa (Atalho: L)",
  },
  {
    id: "pole",
    label: "Poste · P",
    shortcut: "p",
    icon: "pole",
    dotClass: "asset-dot--pole",
    title: "Inserir Poste de Passagem — R$ 0,00 (Atalho: P)",
  },
  {
    id: "cto",
    label: "CTO · C",
    shortcut: "c",
    icon: "cto",
    dotClass: "asset-dot--cto",
    title: "Inserir Caixa de Terminação Óptica CTO Furukawa — R$ 380,00 (Atalho: C)",
  },
  {
    id: "ceo",
    label: "CEO · E",
    shortcut: "e",
    icon: "ceo",
    dotClass: "asset-dot--ceo",
    title: "Inserir Caixa de Emenda Óptica CEO Furukawa — R$ 520,00 (Atalho: E)",
  },
  {
    id: "olt",
    label: "OLT · O",
    shortcut: "o",
    icon: "olt",
    dotClass: "asset-dot--olt",
    title: "Inserir Switch / OLT Central Huawei — R$ 2.450,00 (Atalho: O)",
  },
  {
    id: "cable",
    label: "Cabo · D",
    shortcut: "d",
    icon: "cable",
    title: "Inspecionar enlace óptico entre dois ativos (Atalho: D)",
  },
];

const layers = [
  {
    label: "Camada de Postes Parceiros",
    icon: "pole",
    dotClass: "asset-dot--pole",
    enabled: true,
    bright: true,
  },
  {
    label: "Dutos e Cabos Ópticos",
    icon: "cable",
    enabled: true,
    bright: true,
  },
  {
    label: "Caixas CTO / CEO / OLT",
    icon: "cto",
    dotClass: "asset-dot--cto",
    enabled: true,
    bright: true,
  },
  {
    label: "Histórico Removidos (Soft Delete)",
    icon: "history",
    enabled: false,
    bright: false,
  },
];

/* ------------------------------------------------------------------ */
/* Google Maps: carregamento e marcadores                              */
/* ------------------------------------------------------------------ */

let mapsLoader = null;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    // Com loading=async, o evento onload do script dispara antes de a API
    // estar pronta. O Google chama o callback quando importLibrary já existe.
    window.__onGoogleMapsReady = () => resolve();

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&language=pt-BR&region=BR&callback=__onGoogleMapsReady`;
    script.async = true;
    script.onerror = () => {
      mapsLoader = null;
      script.remove();
      reject(new Error("Não foi possível carregar o script do Google Maps."));
    };
    document.head.appendChild(script);
  });

  return mapsLoader;
}

/* ------------------------------------------------------------------ */
/* Busca de endereço e CEP (serviços gratuitos em src/services)        */
/* ------------------------------------------------------------------ */

function nominatimSearch(params) {
  return nominatimSearchService(params);
}

async function lookupCep(cep) {
  return lookupCepService(cep);
}

const TOOL_EQUIPMENT_CONFIG = {
  pole: { id_tipo_equipamento: null, prefix: "Poste" },
  cto: { id_tipo_equipamento: 1, prefix: "CTO" },
  ceo: { id_tipo_equipamento: 2, prefix: "CEO" },
  olt: { id_tipo_equipamento: 3, prefix: "OLT/POP" },
};

const CABLE_PRESETS = {
  "AS-80 12 FO": { id_cabo: 1, descricao_modelo: "Fibra AS-80 12FO", price: 4.5, maxSpan: 2000, color: "#38bdf8" },
  "AS-120 24 FO": { id_cabo: 2, descricao_modelo: "Fibra AS-120 24FO", price: 6.8, maxSpan: 5000, color: "#a855f7" },
  "AS-200 48 FO": { id_cabo: 3, descricao_modelo: "Fibra AS-200 48FO", price: 9.5, maxSpan: 10000, color: "#f59e0b" },
};

function getCableStrokeColor(trecho) {
  const modelo = (trecho?.modelo_cabo || "").toUpperCase();
  if (modelo.includes("AS-200") || trecho?.id_tipo_cabo === 3) return "#f59e0b";
  if (modelo.includes("AS-120") || trecho?.id_tipo_cabo === 2) return "#a855f7";
  return "#38bdf8";
}

function createPoleElement() {
  const element = document.createElement("div");
  element.className = "pole-marker";
  element.setAttribute("role", "button");
  return element;
}

// A aparência vem do CSS (.pole-marker, .pole-marker--selected e
// [data-tool] para o cursor). Aqui atualizamos sigla, classes e atributos.
function applyPoleStyle(element, { selected, tool, idTipoEquipamento, name, isRemoved = false }) {
  element.classList.toggle("pole-marker--selected", selected);
  element.classList.toggle("pole-marker--removed", isRemoved);
  element.dataset.tool = tool;
  const acronym =
    idTipoEquipamento === 1
      ? "CTO"
      : idTipoEquipamento === 2
        ? "CEO"
        : idTipoEquipamento === 3
          ? "OLT"
          : "P";
  if (element.textContent !== acronym) {
    element.textContent = acronym;
  }
  const typeDescription =
    idTipoEquipamento === 1
      ? "Caixa CTO Furukawa · R$ 380,00"
      : idTipoEquipamento === 2
        ? "Caixa de Emenda CEO Furukawa · R$ 520,00"
        : idTipoEquipamento === 3
          ? "Switch / OLT Central Huawei · R$ 2.450,00"
          : "Poste de Passagem · R$ 0,00";
  const tooltipText = isRemoved
    ? `${name} (Removido — Clique para restaurar)`
    : `${name} (${typeDescription}) — Clique para inspecionar ou arraste para mover`;
  element.title = tooltipText;
  element.setAttribute("aria-label", tooltipText);
  if (idTipoEquipamento) {
    element.dataset.equip = String(idTipoEquipamento);
  } else {
    delete element.dataset.equip;
  }
}

function createSearchElement() {
  const element = document.createElement("div");
  element.className = "search-marker";
  return element;
}

// Overlay que ancora um elemento HTML em uma coordenada do mapa.
// Criado sob demanda porque depende de window.google já estar carregado.
let ElementOverlayClass = null;

function getElementOverlayClass() {
  if (ElementOverlayClass) return ElementOverlayClass;

  ElementOverlayClass = class ElementOverlay extends window.google.maps.OverlayView {
    constructor(position, element) {
      super();
      this.position = position;
      this.element = element;
    }

    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this.element);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(
        new window.google.maps.LatLng(this.position),
      );
      if (!point) return;
      this.element.style.left = `${point.x}px`;
      this.element.style.top = `${point.y}px`;
    }

    onRemove() {
      this.element.remove();
    }

    setPosition(position) {
      this.position = position;
      this.draw();
    }
  };

  return ElementOverlayClass;
}

// Cria o marcador de um poste: seleção por clique e arraste (ferramenta V).
function createPoleEntry(map, pole, handlersRef) {
  const { maps } = window.google;
  const Overlay = getElementOverlayClass();
  const element = createPoleElement();
  element.title = pole.name;
  element.setAttribute("aria-label", pole.name);
  // Impede que cliques e arrastes no marcador movam o mapa ou disparem clique nele.
  maps.OverlayView.preventMapHitsFrom(element);

  const overlay = new Overlay({ lat: pole.lat, lng: pole.lng }, element);
  overlay.setMap(map);

  let drag = null;
  let suppressClick = false;

  const containerPoint = (event) => {
    const rect = map.getDiv().getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  element.addEventListener("pointerdown", (event) => {
    if (
      handlersRef.current.tool !== "select" ||
      handlersRef.current.isReadOnly ||
      pole.isRemoved ||
      event.button !== 0
    ) {
      return;
    }
    const projection = overlay.getProjection();
    if (!projection) return;
    const pointer = containerPoint(event);
    const center = projection.fromLatLngToContainerPixel(
      new maps.LatLng(overlay.position),
    );
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: center.x - pointer.x,
      offsetY: center.y - pointer.y,
      moved: false,
    };
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (!drag.moved && distance < 4) return;
    drag.moved = true;
    const projection = overlay.getProjection();
    if (!projection) return;
    const pointer = containerPoint(event);
    const latLng = projection.fromContainerPixelToLatLng(
      new maps.Point(pointer.x + drag.offsetX, pointer.y + drag.offsetY),
    );
    if (latLng) overlay.setPosition(latLng.toJSON());
  });

  element.addEventListener("pointerup", (event) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    if (moved) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
      handlersRef.current.onMovePole(pole.id, { ...overlay.position });
    }
  });

  element.addEventListener("pointercancel", () => {
    drag = null;
  });

  element.addEventListener("click", (event) => {
    if (suppressClick) return;
    if (handlersRef.current.tool === "select" || handlersRef.current.tool === "cable") {
      handlersRef.current.onSelectPole(
        pole.id,
        event.shiftKey || event.metaKey || event.ctrlKey,
      );
    }
  });

  return { overlay, element };
}

/* ------------------------------------------------------------------ */
/* Mapa                                                                */
/* ------------------------------------------------------------------ */

function MapCanvas({
  map,
  tool,
  isReadOnly = false,
  poles,
  trechos = [],
  selectedIds,
  selectedTrecho,
  lassoStart = null,
  searchResult,
  onMapReady,
  onViewChange,
  onStatusChange,
  onAddPole,
  onMovePole,
  onSelectPole,
  onSelectTrecho,
  onClearSelection,
}) {
  const containerRef = useRef(null);
  const markersRef = useRef({});
  const polylinesRef = useRef([]);
  const searchOverlayRef = useRef(null);
  const lassoOverlayRef = useRef(null);
  const handlersRef = useRef({});
  const [error, setError] = useState("");

  handlersRef.current = { tool, isReadOnly, onMovePole, onSelectPole };

  // Cria o mapa uma única vez.
  useEffect(() => {
    let cancelled = false;

    const fail = (message) => {
      setError(message);
      onStatusChange("fallback");
    };

    // O Google chama esta função quando a chave é recusada.
    window.gm_authFailure = () =>
      fail(
        "Chave Google Maps recusada — alternando para OpenStreetMap / Leaflet.",
      );

    (async () => {
      try {
        if (!HAS_VALID_GOOGLE_MAPS_KEY) {
          onStatusChange("fallback");
          return;
        }
        await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        const { Map: GoogleMap } = await window.google.maps.importLibrary("maps");
        if (cancelled || !containerRef.current) return;

        const instance = new GoogleMap(containerRef.current, {
          center: MAP_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: 10,
          maxZoom: 21,
          styles: MAP_STYLES,
          backgroundColor: BG,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });

        const emitView = () =>
          onViewChange({
            zoom: instance.getZoom() ?? DEFAULT_ZOOM,
            lat: instance.getCenter()?.lat() ?? MAP_CENTER.lat,
          });
        instance.addListener("zoom_changed", emitView);
        instance.addListener("idle", emitView);

        onMapReady(instance);
        onStatusChange("ready");
      } catch (err) {
        if (!cancelled) fail(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onMapReady, onViewChange, onStatusChange]);

  // Cursor do mapa de acordo com a ferramenta.
  useEffect(() => {
    if (!map) return;
    const isPlacementOrLasso = (!isReadOnly && Boolean(TOOL_EQUIPMENT_CONFIG[tool])) || tool === "lasso";
    map.setOptions({ draggableCursor: isPlacementOrLasso ? "crosshair" : null });
  }, [map, tool, isReadOnly]);

  // Clique no mapa: adiciona ativo (P, C, E, O), seleciona em caixa (L) ou limpa a seleção (V).
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (event) => {
      if (!isReadOnly && TOOL_EQUIPMENT_CONFIG[tool] && event.latLng) {
        onAddPole(event.latLng.toJSON(), tool);
      } else if (tool === "lasso" && event.latLng) {
        onAddPole(event.latLng.toJSON(), "lasso");
      } else if (tool === "select" && !event.domEvent?.shiftKey) {
        onClearSelection();
      }
    });
    return () => listener.remove();
  }, [map, tool, isReadOnly, onAddPole, onClearSelection]);

  // Sincroniza os marcadores com o estado de postes.
  useEffect(() => {
    if (!map) return;
    const registry = markersRef.current;
    const currentIds = new Set(poles.map((pole) => pole.id));

    Object.keys(registry).forEach((id) => {
      if (!currentIds.has(Number(id)) && !currentIds.has(id)) {
        registry[id].overlay.setMap(null);
        delete registry[id];
      }
    });

    poles.forEach((pole) => {
      let entry = registry[pole.id];

      if (!entry) {
        entry = createPoleEntry(map, pole, handlersRef);
        registry[pole.id] = entry;
      } else if (
        entry.overlay.position.lat !== pole.lat ||
        entry.overlay.position.lng !== pole.lng
      ) {
        entry.overlay.setPosition({ lat: pole.lat, lng: pole.lng });
      }

      applyPoleStyle(entry.element, {
        selected: selectedIds.includes(pole.id),
        tool,
        idTipoEquipamento: pole.id_tipo_equipamento,
        name: pole.name,
        isRemoved: Boolean(pole.isRemoved),
      });
    });
  }, [map, poles, selectedIds, tool]);

  // Sincroniza os trechos (AGM/Prim) com polilinhas interativas no mapa.
  useEffect(() => {
    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];
    if (!map || !window.google?.maps?.Polyline || !trechos?.length) return;

    const polesById = new Map(poles.map((pole) => [pole.id, pole]));
    trechos.forEach((trecho) => {
      const origin = polesById.get(trecho.origem_id ?? trecho.id_ponto_origem);
      const dest = polesById.get(trecho.destino_id ?? trecho.id_ponto_destino);
      if (!origin || !dest) return;

      const rawCoords = Array.isArray(trecho.caminho_coordenadas)
        ? trecho.caminho_coordenadas
        : [];
      const path =
        rawCoords.length >= 2
          ? [
              { lat: origin.lat, lng: origin.lng },
              ...rawCoords.slice(1, -1).map((c) => ({ lat: Number(c.lat), lng: Number(c.lng) })),
              { lat: dest.lat, lng: dest.lng },
            ]
          : [
              { lat: origin.lat, lng: origin.lng },
              { lat: dest.lat, lng: dest.lng },
            ];

      const isSelected = selectedTrecho?.id_trecho === trecho.id_trecho;
      const baseColor = getCableStrokeColor(trecho);

      const line = new window.google.maps.Polyline({
        path,
        geodesic: path.length <= 2,
        strokeColor: isSelected ? "#22d3ee" : baseColor,
        strokeOpacity: isSelected ? 1.0 : 0.92,
        strokeWeight: isSelected ? 5 : 3.5,
        clickable: true,
        zIndex: isSelected ? 10 : 2,
        map,
      });

      line.addListener("click", (event) => {
        if (event?.stop) event.stop();
        onSelectTrecho?.(trecho);
      });

      polylinesRef.current.push(line);
    });
  }, [map, poles, trechos, selectedTrecho, onSelectTrecho]);

  useEffect(() => {
    if (!map) return;

    if (searchOverlayRef.current) {
      searchOverlayRef.current.setMap(null);
      searchOverlayRef.current = null;
    }
    if (!searchResult) return;

    const Overlay = getElementOverlayClass();
    const element = createSearchElement();
    element.title = searchResult.label;
    const overlay = new Overlay(
      { lat: searchResult.lat, lng: searchResult.lng },
      element,
    );
    overlay.setMap(map);
    searchOverlayRef.current = overlay;

    if (searchResult.precise || !searchResult.bounds) {
      map.setCenter({ lat: searchResult.lat, lng: searchResult.lng });
      map.setZoom(18);
    } else {
      map.fitBounds(searchResult.bounds);
      window.google.maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 19) map.setZoom(19);
      });
    }
  }, [map, searchResult]);

  useEffect(() => {
    if (!map) return;
    if (lassoOverlayRef.current) {
      lassoOverlayRef.current.setMap(null);
      lassoOverlayRef.current = null;
    }
    if (!lassoStart) return;
    const Overlay = getElementOverlayClass();
    const element = document.createElement("div");
    element.className = "lasso-pin";
    element.title = "1º canto da área de seleção";
    const overlay = new Overlay(lassoStart, element);
    overlay.setMap(map);
    lassoOverlayRef.current = overlay;
  }, [map, lassoStart]);

  // Remove os marcadores ao desmontar.
  useEffect(() => {
    const registry = markersRef.current;
    const searchRef = searchOverlayRef;
    const lassoRef = lassoOverlayRef;
    return () => {
      Object.values(registry).forEach(({ overlay }) => overlay.setMap(null));
      polylinesRef.current.forEach((line) => line.setMap(null));
      searchRef.current?.setMap(null);
      lassoRef.current?.setMap(null);
    };
  }, []);

  return (
    <section
      className="map-canvas"
      aria-label="Mapa de Taquaral"
    >
      <div ref={containerRef} className="fill-parent" />
      {error && (
        <div
          role="alert"
          className="map-error"
        >
          <div className="map-error__card">
            <h2 className="map-error__title">
              Mapa indisponível
            </h2>
            <p className="map-error__text">
              {error}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Barra de ferramentas                                                */
/* ------------------------------------------------------------------ */

function ToolButton({ tool, active, disabled = false, onSelect }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(tool.id)}
      aria-pressed={active}
      aria-keyshortcuts={tool.shortcut.toUpperCase()}
      title={disabled ? "Bloqueado no modo somente leitura" : tool.title}
      className={cx(
        "tool-button disabled:cursor-not-allowed disabled:opacity-40",
        active && "tool-button--active",
      )}
    >
      {tool.dotClass && (
        <span
          className={cx("tool-button__dot", tool.dotClass)}
          aria-hidden="true"
        />
      )}
      <span className="icon-slot">
        <WorkspaceIcon name={tool.icon} className="h-[18px] w-[18px]" />
      </span>
      <span
        className="tool-button__label"
      >
        {tool.label.split(" · ")[0]} · <kbd>{tool.shortcut.toUpperCase()}</kbd>
      </span>
    </button>
  );
}

function ToolBar({ selectedTool, isReadOnly = false, onSelectTool, snapEnabled, onToggleSnap }) {
  return (
    <nav
      className="toolbar"
      aria-label="Ferramentas de edição"
    >
      <ul className="toolbar__list">
        {toolItems.slice(0, 2).map((tool) => (
          <li key={tool.id}>
            <ToolButton
              tool={tool}
              active={selectedTool === tool.id}
              onSelect={onSelectTool}
            />
          </li>
        ))}
        <li aria-hidden="true">
          <span className="divider-vertical" />
        </li>
        {toolItems.slice(2).map((tool) => {
          const isPlacement = Boolean(TOOL_EQUIPMENT_CONFIG[tool.id]);
          return (
            <li key={tool.id}>
              <ToolButton
                tool={tool}
                active={selectedTool === tool.id}
                disabled={isReadOnly && isPlacement}
                onSelect={onSelectTool}
              />
            </li>
          );
        })}
        <li aria-hidden="true">
          <span className="divider-vertical" />
        </li>
        <li>
          <button
            type="button"
            disabled={isReadOnly}
            onClick={onToggleSnap}
            aria-pressed={snapEnabled}
            aria-keyshortcuts="S"
            title={
              isReadOnly
                ? "Modo somente leitura"
                : snapEnabled
                  ? "Snap Viário ativado: os cabos acompanham o traçado das ruas (Atalho: S)"
                  : "Snap Viário desativado: cabos traçados em linha reta geodésica (Atalho: S)"
            }
            className={cx(
              "tool-button disabled:cursor-not-allowed disabled:opacity-40",
              snapEnabled && "tool-button--snap-on",
            )}
          >
            <span className="icon-slot">
              <WorkspaceIcon name="snap" className="h-[18px] w-[18px]" />
            </span>
            <span
              className="tool-button__label tool-button__label--snap"
            >
              Snap {snapEnabled ? "ON" : "OFF"} · <kbd>S</kbd>
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function ToolHint({ tool, isReadOnly = false, selectedCount, snapEnabled, lassoStart, cableOriginId }) {
  let text;
  if (isReadOnly) {
    text = "Modo Somente Leitura (Auditoria / Visualizador): clique em qualquer ativo ou cabo para inspecionar";
  } else if (tool === "pole") {
    text = (
      <>
        Clique no mapa para posicionar um Poste de passagem (R$ 0,00) · <kbd>Esc</kbd> para voltar
      </>
    );
  } else if (tool === "cto") {
    text = (
      <>
        Clique no mapa para posicionar uma Caixa <abbr title="Caixa de Terminação Óptica">CTO</abbr> (R$ 380,00) · <kbd>Esc</kbd> para voltar
      </>
    );
  } else if (tool === "ceo") {
    text = (
      <>
        Clique no mapa para posicionar uma Caixa de Emenda <abbr title="Caixa de Emenda Óptica">CEO</abbr> (R$ 520,00) · <kbd>Esc</kbd> para voltar
      </>
    );
  } else if (tool === "olt") {
    text = (
      <>
        Clique no mapa para posicionar um Switch / <abbr title="Optical Line Terminal">OLT</abbr> POP (R$ 2.450,00) · <kbd>Esc</kbd> para voltar
      </>
    );
  } else if (tool === "lasso") {
    text = lassoStart ? (
      <>
        Lasso: clique no 2º canto do retângulo para selecionar os ativos da área · <kbd>Esc</kbd> cancela
      </>
    ) : (
      "Lasso: clique no 1º canto no mapa para abrir uma caixa de seleção múltipla"
    );
  } else if (tool === "cable") {
    text = cableOriginId
      ? `Cabo: origem #${cableOriginId} selecionada · clique no ativo de destino para inspecionar o enlace`
      : "Cabo: clique no ativo de origem e depois no destino para inspecionar o trecho óptico";
  } else if (tool === "select") {
    text =
      selectedCount > 0 ? (
        <>
          {selectedCount} selecionado{selectedCount > 1 ? "s" : ""} · <kbd>Delete</kbd> remove · arraste para mover
        </>
      ) : (
        `Clique em um ativo ou trecho óptico para inspecionar · Modo ${snapEnabled ? "Snap Viário ON" : "Geodésico Direto OFF"}`
      );
  } else {
    const item = toolItems.find((entry) => entry.id === tool);
    text = `${item?.label.split(" · ")[0]} em modo de visualização`;
  }

  return (
    <p
      className="tool-hint"
      role="status"
    >
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Painéis sobre o mapa                                                */
/* ------------------------------------------------------------------ */

function MapStats({
  poles,
  distanceMeters,
  estimatedCost,
  custoCabos = 0,
  custoEquipamentos = 0,
  savingsPercent,
}) {
  const purePoles = poles.filter((p) => !p.id_tipo_equipamento).length;
  const ctoCount = poles.filter((p) => p.id_tipo_equipamento === 1).length;
  const ceoCount = poles.filter((p) => p.id_tipo_equipamento === 2).length;
  const oltCount = poles.filter((p) => p.id_tipo_equipamento === 3).length;

  return (
    <aside className="map-stats" aria-label="Métricas e legenda da malha óptica">
      <div className="map-stats__group">
        <span className="map-stats__label">
          Distância Total Acumulada
        </span>
        <span className="map-stats__value-row">
          <strong className="map-stats__value">
            {(distanceMeters / 1000).toFixed(2)}
          </strong>
          <span className="map-stats__unit">
            km ({distanceMeters.toFixed(1)} m)
          </span>
        </span>
      </div>
      <span className="divider-vertical" aria-hidden="true" />
      <div className="map-stats__group">
        <span className="map-stats__label">
          Custo Estimado da Obra
        </span>
        <strong className="map-stats__value">
          {estimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </strong>
        {(custoCabos > 0 || custoEquipamentos > 0) && (
          <span className="text-[10px] text-slate-300">
            Cabos: {custoCabos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Equip.:{" "}
            {custoEquipamentos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        )}
      </div>
      <span className="divider-vertical" aria-hidden="true" />
      <div className="map-stats__group map-stats__group--counts">
        <ul className="map-stats__legend-list" aria-label="Contagem de ativos por tipo">
          <li className="map-stats__legend-pill" title="Poste de Passagem (P) · R$ 0,00">
            <span className="asset-dot asset-dot--pole" aria-hidden="true" />
            <span>{purePoles} {purePoles === 1 ? "Poste" : "Postes"} (P)</span>
          </li>
          <li className="map-stats__legend-pill" title="Caixa de Terminação Óptica (CTO) · R$ 380,00">
            <span className="asset-dot asset-dot--cto" aria-hidden="true" />
            <span>{ctoCount} CTOs</span>
          </li>
          <li className="map-stats__legend-pill" title="Caixa de Emenda Óptica (CEO) · R$ 520,00">
            <span className="asset-dot asset-dot--ceo" aria-hidden="true" />
            <span>{ceoCount} CEOs</span>
          </li>
          {oltCount > 0 && (
            <li className="map-stats__legend-pill" title="Switch / OLT Central · R$ 2.450,00">
              <span className="asset-dot asset-dot--olt" aria-hidden="true" />
              <span>{oltCount} OLTs</span>
            </li>
          )}
        </ul>
        <span className="map-stats__savings">
          <span className="text-emerald-400">
            <WorkspaceIcon name="savings" className="icon-13" />
          </span>
          {poles.length < 3 ? (
            <span className="map-stats__savings-text map-stats__savings-text--hint">
              Adicione 3+ ativos para poda de ciclos (<abbr title="Árvore Geradora Mínima">AGM</abbr> Prim)
            </span>
          ) : (
            <span className="map-stats__savings-text">
              {Number(savingsPercent || 0).toFixed(1)}% economia de material (<abbr title="Árvore Geradora Mínima">AGM</abbr> Prim)
            </span>
          )}
        </span>
      </div>
    </aside>
  );
}

function MapControls({ zoomLevel, onZoomIn, onZoomOut, onFitBounds }) {
  return (
    <>
      <div className="map-controls">
        <div className="map-controls__compass" title="Orientação Norte">
          <span className="map-controls__compass-label">
            N
          </span>
          <span className="map-controls__compass-icon" aria-label="Orientação norte">
            <WorkspaceIcon name="compass" className="h-4 w-4" />
          </span>
        </div>
        <button
          type="button"
          onClick={onFitBounds}
          className="map-controls__fit"
          aria-label="Enquadrar toda a rede"
          title="Enquadrar todos os ativos da rede no mapa"
        >
          <WorkspaceIcon name="fit" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="map-controls__zoom"
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          <span className="map-controls__sign map-controls__sign--plus">
            +
          </span>
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="map-controls__zoom map-controls__zoom--out"
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
        >
          <span className="map-controls__sign map-controls__sign--minus">
            −
          </span>
        </button>
      </div>
      <span className="zoom-level-label">Nível de zoom: {Math.round(zoomLevel)}</span>
    </>
  );
}

function niceDistance(target) {
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const ratio = target / magnitude;
  return (ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1) * magnitude;
}

function ScaleBar({ zoomLevel, lat }) {
  const metersPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoomLevel;
  const distance = niceDistance(metersPerPixel * 58);
  const width = Math.round(distance / metersPerPixel);
  const widthClass =
    width >= 88
      ? "scale-bar__line--xl"
      : width >= 72
        ? "scale-bar__line--lg"
        : width >= 56
          ? "scale-bar__line--md"
          : "scale-bar__line--sm";
  const label = distance >= 1000 ? `${distance / 1000} km` : `${distance} m`;

  return (
    <div className="scale-bar">
      <span
        className={cx("scale-bar__line", widthClass)}
        aria-hidden="true"
      />
      <span className="scale-bar__label">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barra lateral                                                       */
/* ------------------------------------------------------------------ */

function LayerSwitch({ layer, enabled, onToggle }) {
  return (
    <li className="layer-switch">
      <span className="layer-switch__icon text-indigo-400">
        <WorkspaceIcon name={layer.icon} className="h-4 w-4" />
      </span>
      <span
        className={cx(
          "layer-switch__label",
          layer.bright && "layer-switch__label--bright",
        )}
      >
        {layer.label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${layer.label}: ${enabled ? "ativada" : "desativada"}`}
        onClick={onToggle}
        className={cx("layer-switch__toggle", enabled && "layer-switch__toggle--on")}
      >
        <span className="layer-switch__knob" />
      </button>
    </li>
  );
}

function Sidebar({
  poles,
  poleCount,
  selectedCount,
  trechoCount,
  isReadOnly = false,
  canChangeStatus = false,
  companyProjects = [],
  currentProjectId,
  onSwitchProject,
  onChangeProjectStatus,
  isUpdatingProjectStatus = false,
  projectStatus,
  searchEnabled,
  searchResult,
  onInsertAtSearch,
  onSearch,
  onClearSearch,
  projectName,
  canCalculate,
  onCalculate,
  isCalculating,
  cableType,
  onCableTypeChange,
  cablePrice,
  onCablePriceChange,
  maxSpan,
  onMaxSpanChange,
  rootNodeId,
  onRootNodeChange,
  snapEnabled,
  layerState,
  onToggleLayer,
  onOpenGraphModal,
  onOpenReportModal,
}) {
  const [search, setSearch] = useState("");
  const [searchState, setSearchState] = useState({
    message: "",
    error: false,
  });

  const cableSwatchClass =
    cableType === "AS-200 48 FO"
      ? "cable-swatch--as200"
      : cableType === "AS-120 24 FO"
        ? "cable-swatch--as120"
        : "cable-swatch--as80";

  const submitSearch = async (event) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    setSearchState({ message: "Buscando…", error: false });
    const result = await onSearch(query);
    setSearchState({ message: result.message, error: !result.ok });
  };

  const changeSearch = (event) => {
    const { value } = event.target;
    setSearch(value);
    if (!value) {
      onClearSearch();
      setSearchState({ message: "", error: false });
    }
  };

  const updateLayer = (index) => {
    onToggleLayer?.(index);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__panel">
        <div className="sidebar__header">
          <div className="brand">
            <div className="brand__mark">
              <WorkspaceIcon name="brand" className="brand__mark-icon" />
            </div>
            <span className="brand__name">
              InfraRoute
            </span>
            <span className="brand__tag">
              <abbr title="Geographic Information System (Sistema de Informações Geográficas)">GIS</abbr>
            </span>
          </div>
          <div className="project">
            <span className="project__eyebrow">
              WORKSPACE DE ENGENHARIA
            </span>
            <h1 className="project__name">
              {projectName || "Carregando projeto..."}
            </h1>
            {companyProjects.length > 1 && (
              <div className="w-full pt-1">
                <label htmlFor="switch-project" className="sr-only">
                  Trocar projeto ativo
                </label>
                <select
                  id="switch-project"
                  value={String(currentProjectId || "")}
                  onChange={(e) => onSwitchProject?.(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  {companyProjects.map((proj) => (
                    <option key={proj.id_projeto} value={String(proj.id_projeto)}>
                      IR-{String(proj.id_projeto).padStart(4, "0")} · {proj.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid w-full grid-cols-2 gap-1.5 pt-1">
              <div className="flex flex-col gap-0.5">
                <label htmlFor="switch-project-status" className="sr-only">
                  Status do projeto
                </label>
                <select
                  id="switch-project-status"
                  disabled={!canChangeStatus || isUpdatingProjectStatus || !projectStatus}
                  value={projectStatus || "Em Planejamento"}
                  onChange={(e) => onChangeProjectStatus?.(e.target.value)}
                  className="h-7 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10px] font-medium text-slate-200 disabled:opacity-60"
                >
                  <option value="Em Planejamento">Em Planejamento</option>
                  <option value="Em Execução">Em Execução</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
              <Link className="flex h-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10px] font-medium text-indigo-300 hover:bg-slate-800 hover:text-indigo-200" to="/projetos">
                ← Projetos
              </Link>
            </div>
            <div className="project__badges">
              <span className={cx("project__badge", snapEnabled && "project__badge--snap-on")}>
                {snapEnabled ? "Traçado Viário (Snap ON)" : "Geodésico Direto (Snap OFF)"}
              </span>
              <span className="project__badge">
                {poleCount} {poleCount === 1 ? "ativo" : "ativos"}
                {selectedCount > 0 ? ` · ${selectedCount} sel.` : ""}
              </span>
              {isReadOnly && (
                <span className="project__badge border-amber-500/50 bg-amber-950/60 text-amber-300">
                  🔒 {projectStatus || "Somente Leitura"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="divider-horizontal" />
        <div className="sidebar__content">
          <div className="w-full px-5 pt-3">
            <QuickPersonaSwitcher variant="compact" />
          </div>
          <form className="search" onSubmit={submitSearch} role="search">
            <label htmlFor="workspace-search" className="search__field">
              <span className="search__icon">
                <WorkspaceIcon name="search" className="h-4 w-4" />
              </span>
              <input
                id="workspace-search"
                name="search"
                type="search"
                value={search}
                onChange={changeSearch}
                disabled={!searchEnabled}
                placeholder="Buscar endereço ou CEP..."
                aria-label="Buscar endereço ou CEP"
                className="search__input"
              />
            </label>
            {searchState.message && (
              <p
                role="status"
                className={cx(
                  "search__message",
                  searchState.error && "search__message--error",
                )}
              >
                {searchState.message}
              </p>
            )}
            {searchResult && !isReadOnly && (
              <button
                type="button"
                onClick={onInsertAtSearch}
                className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-950/50 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-900/60"
              >
                + Inserir ativo neste endereço
              </button>
            )}
          </form>
          <div className="divider-horizontal" />
          <section
            className="panel-section"
            aria-labelledby="layers-heading"
          >
            <div className="panel-section__heading">
              <span className="text-indigo-400">
                <WorkspaceIcon name="layers" className="icon-16" />
              </span>
              <h2
                id="layers-heading"
                className="panel-section__title"
              >
                Gerenciador de Camadas
              </h2>
            </div>
            <ul className="layer-list">
              {layers.map((layer, index) => (
                <LayerSwitch
                  key={layer.label}
                  layer={layer}
                  enabled={layerState[index]}
                  onToggle={() => updateLayer(index)}
                />
              ))}
            </ul>
            <div className="panel-note">
              <span className="text-slate-400">
                <WorkspaceIcon name="info" className="icon-13" />
              </span>
              <p className="panel-note__text">
                {poleCount > 0
                  ? `${poleCount} ativo(s) e ${trechoCount} enlace(s) óptico(s) renderizados no mapa.`
                  : "Nenhum ativo carregado. Escolha Poste, CTO, CEO ou OLT na barra superior e clique no mapa."}
              </p>
            </div>
          </section>
          <div className="divider-horizontal" />
          <section
            className="panel-section panel-section--spaced"
            aria-labelledby="parameters-heading"
          >
            <div className="panel-section__heading">
              <span className="text-indigo-400">
                <WorkspaceIcon name="params" className="icon-16" />
              </span>
              <h2
                id="parameters-heading"
                className="panel-section__title"
              >
                Parâmetros do algoritmo
              </h2>
            </div>
            <fieldset className="m-0 flex w-full flex-col items-start gap-3.5 border-0 p-0">
              <legend className="sr-only">Configuração de cabos e vão máximo</legend>
              <label htmlFor="cable-type" className="field">
                <span className="field__label">
                  <span>Tipo de cabo</span>
                  <span
                    className={cx("cable-swatch", cableSwatchClass)}
                    title={`Cor do enlace no mapa para ${cableType}`}
                  />
                </span>
                <span className="field__wrap">
                  <select
                    id="cable-type"
                    name="cableType"
                    value={cableType}
                    onChange={(event) => onCableTypeChange(event.target.value)}
                    className="field__control"
                  >
                    <option value="AS-80 12 FO">AS-80 12 FO (Azul · R$ 4,50/m)</option>
                    <option value="AS-120 24 FO">AS-120 24 FO (Roxo · R$ 6,80/m)</option>
                    <option value="AS-200 48 FO">AS-200 48 FO (Âmbar · R$ 9,50/m)</option>
                  </select>
                  <span className="field__chevron">
                    <WorkspaceIcon name="chevron-down" className="h-3.5 w-3.5" />
                  </span>
                </span>
              </label>
              <div className="field-row">
                <label htmlFor="cable-price" className="field field--grow">
                  <span className="field__label">
                    Cabo/m
                  </span>
                  <span className="field__wrap">
                    <input
                      id="cable-price"
                      name="cablePrice"
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={cablePrice}
                      onChange={(event) => onCablePriceChange(event.target.value)}
                      className="field__control field__control--unit-sm"
                      aria-label="Preço do cabo por metro"
                    />
                    <span className="field__unit">
                      R$
                    </span>
                  </span>
                </label>
                <label htmlFor="max-span" className="field field--grow">
                  <span className="field__label">
                    Vão máximo
                  </span>
                  <span className="field__wrap">
                    <input
                      id="max-span"
                      name="maxSpan"
                      type="number"
                      min="1"
                      required
                      value={maxSpan}
                      onChange={(event) => onMaxSpanChange(event.target.value)}
                      className="field__control field__control--unit-md"
                      aria-label="Vão máximo em metros"
                    />
                    <span className="field__unit field__unit--muted">
                      m
                    </span>
                  </span>
                </label>
              </div>
              <label htmlFor="root-node" className="field">
                <span className="field__label">
                  <span>Nó raiz / OLT inicial (Prim)</span>
                </span>
                <span className="field__wrap">
                  <select
                    id="root-node"
                    name="rootNode"
                    value={rootNodeId}
                    onChange={(event) => onRootNodeChange(event.target.value)}
                    className="field__control"
                  >
                    <option value="">Automático (primeiro ativo)</option>
                    {poles.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        #{p.id} · {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="field__chevron">
                    <WorkspaceIcon name="chevron-down" className="h-3.5 w-3.5" />
                  </span>
                </span>
              </label>
            </fieldset>
          </section>
        </div>
        <footer className="sidebar__footer">
          <div className="sidebar__status">
            <span className="sidebar__status-dot" />
            <span className="sidebar__status-text">
              {poleCount === 0
                ? "Aguardando inserção de elementos"
                : `${poleCount} ${poleCount === 1 ? "ativo inserido" : "ativos inseridos"} · ${trechoCount} ${trechoCount === 1 ? "trecho" : "trechos"}`}
            </span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => onCalculate()}
            disabled={!canCalculate || isCalculating || isReadOnly}
            title={isReadOnly ? "Indisponível em modo somente leitura" : "Calcular Árvore Geradora Mínima"}
          >
            {isCalculating ? "Calculando..." : "Calcular Malha Otimizada ⚡"}
          </button>
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenGraphModal}
              disabled={!canCalculate}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-[11px] font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
            >
              Inspecionar Grafo
            </button>
            <button
              type="button"
              onClick={onOpenReportModal}
              disabled={!canCalculate}
              className="rounded-lg border border-indigo-500/40 bg-indigo-950/60 px-2.5 py-2 text-[11px] font-semibold text-indigo-200 transition hover:bg-indigo-900/60 disabled:opacity-40"
            >
              Memorial & BOM
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

const STATUS_LABELS = {
  loading: "Carregando mapa GIS…",
  ready: "Mapa GIS conectado · Busca: © OpenStreetMap e ViaCEP",
  fallback: "Alternando para OpenStreetMap / Leaflet…",
  error: "Mapa indisponível · veja a mensagem de erro no mapa",
};

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export const WorkspaceGis = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const session = getSession();
  const projectId = Number(searchParams.get("id_projeto"));
  const savedWorkspaceConfig = getStorageItem(STORAGE_KEYS.WORKSPACE_CONFIG, null);
  const [map, setMap] = useState(null);
  const [mapProvider, setMapProvider] = useState(
    HAS_VALID_GOOGLE_MAPS_KEY ? "google" : "leaflet",
  );
  const [status, setStatus] = useState("loading");
  const [view, setView] = useState({ zoom: DEFAULT_ZOOM, lat: MAP_CENTER.lat });
  const [tool, setTool] = useState("select");
  const [snapEnabled, setSnapEnabled] = useState(() =>
    typeof savedWorkspaceConfig?.snapEnabled === "boolean"
      ? savedWorkspaceConfig.snapEnabled
      : true,
  );
  const snapEnabledRef = useRef(snapEnabled);
  snapEnabledRef.current = snapEnabled;
  const [poles, setPoles] = useState([]);
  const [removedPoles, setRemovedPoles] = useState([]);
  const [trechos, setTrechos] = useState([]);
  const [adjacencyList, setAdjacencyList] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTrecho, setSelectedTrecho] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [project, setProject] = useState(null);
  const [companyProjects, setCompanyProjects] = useState([]);
  const [isUpdatingProjectStatus, setIsUpdatingProjectStatus] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [custoCabos, setCustoCabos] = useState(0);
  const [custoEquipamentos, setCustoEquipamentos] = useState(0);
  const [savingsPercent, setSavingsPercent] = useState(0);
  const [cableType, setCableType] = useState(
    () => savedWorkspaceConfig?.cableType || "AS-80 12 FO",
  );
  const [cablePrice, setCablePrice] = useState(
    () => savedWorkspaceConfig?.cablePrice ?? 4.5,
  );
  const [maxSpan, setMaxSpan] = useState(
    () => savedWorkspaceConfig?.maxSpan ?? 2000,
  );
  const [rootNodeId, setRootNodeId] = useState("");
  const [layerState, setLayerState] = useState(() =>
    Array.isArray(savedWorkspaceConfig?.layerState) &&
    savedWorkspaceConfig.layerState.length === layers.length
      ? savedWorkspaceConfig.layerState
      : layers.map((layer) => layer.enabled),
  );
  const [lassoStart, setLassoStart] = useState(null);
  const [cableOriginId, setCableOriginId] = useState(null);
  const [isGraphConnected, setIsGraphConnected] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [editDesc, setEditDesc] = useState("");
  const [editEquip, setEditEquip] = useState("0");
  const [editStatusFisico, setEditStatusFisico] = useState("Projetado");
  const [isSavingInspector, setIsSavingInspector] = useState(false);

  const isReadOnly =
    ehPerfilSomenteLeituraProjetos(session?.nivel_acesso) ||
    project?.status === "Concluído" ||
    project?.status === "Cancelado";

  useEffect(() => {
    document.title = project?.nome
      ? `${project.nome} | Workspace GIS — InfraRoute`
      : "Workspace GIS | InfraRoute — Engenharia de Redes";
  }, [project?.nome]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.WORKSPACE_CONFIG, {
      snapEnabled,
      cableType,
      cablePrice,
      maxSpan,
      layerState,
    });
  }, [snapEnabled, cableType, cablePrice, maxSpan, layerState]);

  const toggleLayer = useCallback((index) => {
    setLayerState((current) =>
      current.map((value, layerIndex) => (layerIndex === index ? !value : value)),
    );
  }, []);

  const showRemovedLayer = Boolean(layerState[3]);
  const allDisplayablePoles = showRemovedLayer ? [...poles, ...removedPoles] : poles;
  const visiblePoles = allDisplayablePoles.filter((pole) => {
    if (pole.isRemoved) return true;
    if (!pole.id_tipo_equipamento) return layerState[0] !== false;
    return layerState[2] !== false;
  });
  const visibleTrechos = layerState[1] !== false ? trechos : [];

  useEffect(() => {
    if (selectedIds.length !== 1) return;
    const target = allDisplayablePoles.find((p) => p.id === selectedIds[0]);
    if (!target) return;
    setEditDesc(target.name || "");
    setEditEquip(target.id_tipo_equipamento ? String(target.id_tipo_equipamento) : "0");
    setEditStatusFisico(target.status_fisico || "Projetado");
  }, [selectedIds, poles, removedPoles]);

  const handleCableTypeChange = useCallback((nextType) => {
    setCableType(nextType);
    const preset = CABLE_PRESETS[nextType];
    if (preset) {
      setCablePrice(preset.price);
      setMaxSpan(preset.maxSpan);
    }
  }, []);

  const buildCatalogoCabosPayload = useCallback(() => {
    const selectedPreset = CABLE_PRESETS[cableType] || CABLE_PRESETS["AS-80 12 FO"];
    const parsedPrice = Number(cablePrice);
    const parsedSpan = Number(maxSpan);
    const customCable = {
      id_cabo: selectedPreset.id_cabo,
      descricao_modelo: selectedPreset.descricao_modelo,
      custo_por_metro: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : selectedPreset.price,
      limite_distancia_metros: Number.isFinite(parsedSpan) && parsedSpan > 0 ? parsedSpan : selectedPreset.maxSpan,
    };

    const fallbackCables = Object.values(CABLE_PRESETS)
      .filter((preset) => preset.id_cabo !== customCable.id_cabo && preset.maxSpan > customCable.limite_distancia_metros)
      .map((preset) => ({
        id_cabo: preset.id_cabo,
        descricao_modelo: preset.descricao_modelo,
        custo_por_metro: Math.max(preset.price, customCable.custo_por_metro + 0.01),
        limite_distancia_metros: preset.maxSpan,
      }));

    return [customCable, ...fallbackCables];
  }, [cableType, cablePrice, maxSpan]);

  const mapPointToUi = (point, isRemoved = false) => ({
    id: point.id_ponto,
    name: point.descricao,
    lat: point.latitude,
    lng: point.longitude,
    status_fisico: point.status_fisico || "Projetado",
    status_ponto: point.status_ponto || "Ativo",
    id_tipo_equipamento: point.id_tipo_equipamento ?? null,
    custo_equipamento: point.custo_equipamento ?? 0,
    isRemoved,
  });

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      navigate("/projetos", { replace: true });
      return;
    }

    let cancelled = false;
    const loadProject = async () => {
      try {
        const [result, listRes] = await Promise.all([
          apiRequest(`/projetos/${projectId}?id_usuario_autor=${session.id_usuario}`),
          apiRequest(
            `/projetos?id_empresa=${session?.nivel_acesso === "SuperAdmin" ? 0 : session.id_empresa_padrao}&id_usuario_autor=${session.id_usuario}`,
          ).catch(() => []),
        ]);
        if (cancelled) return;
        setCompanyProjects(Array.isArray(listRes) ? listRes : []);
        const activePoints = (result.pontos || []).filter(
          (point) => point.status_ponto === "Ativo",
        );
        const deletedPoints = (result.pontos || []).filter(
          (point) => point.status_ponto !== "Ativo",
        );
        setProject(result);
        setDistanceMeters(result.metragem_total);
        setEstimatedCost(result.custo_estimado);
        setTrechos(result.trechos || []);
        setPoles(activePoints.map((pt) => mapPointToUi(pt, false)));
        setRemovedPoles(deletedPoints.map((pt) => mapPointToUi(pt, true)));

        const projectIsReadOnly =
          ehPerfilSomenteLeituraProjetos(session?.nivel_acesso) ||
          result.status === "Concluído" ||
          result.status === "Cancelado";

        if (!projectIsReadOnly && snapEnabledRef.current && activePoints.length >= 2) {
          const mstResult = await apiRequest(
            `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
            {
              method: "POST",
              body: JSON.stringify({
                catalogo_cabos: buildCatalogoCabosPayload(),
                ajustar_malha_viaria: true,
              }),
            },
          );
          if (!cancelled) {
            setDistanceMeters(mstResult.metragem_total);
            setEstimatedCost(mstResult.custo_estimado);
            setCustoCabos(mstResult.custo_total_cabos ?? 0);
            setCustoEquipamentos(mstResult.custo_total_equipamentos ?? 0);
            setSavingsPercent(mstResult.economia_percentual ?? 0);
            setIsGraphConnected(mstResult.grafo_conexo !== false);
            setTrechos(mstResult.trechos_mst || []);
            setAdjacencyList(mstResult.lista_adjacencia || {});
          }
        }
      } catch (error) {
        if (!cancelled) showToast(error.message, { type: "error" });
      }
    };

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [projectId, session.id_usuario, session.id_empresa_padrao, session?.nivel_acesso, navigate, showToast]);

  const handleChangeProjectStatus = useCallback(
    async (novoStatus) => {
      if (!project || ehPerfilSomenteLeituraProjetos(session?.nivel_acesso) || novoStatus === project.status) return;
      setIsUpdatingProjectStatus(true);
      try {
        const updated = await apiRequest(`/projetos/${projectId}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            novo_status: novoStatus,
            id_usuario_autor: session.id_usuario,
          }),
        });
        setProject((curr) => (curr ? { ...curr, status: updated.status } : curr));
        setCompanyProjects((curr) =>
          curr.map((p) => (p.id_projeto === projectId ? { ...p, status: updated.status } : p)),
        );
        showToast(`Status do projeto alterado para "${updated.status}".`, { type: "success" });
      } catch (err) {
        showToast(err.message, { type: "error" });
      } finally {
        setIsUpdatingProjectStatus(false);
      }
    },
    [project, projectId, session.id_usuario, session?.nivel_acesso, showToast],
  );

  const fitNetworkBounds = useCallback(
    (targetPoles = poles) => {
      if (!map || !targetPoles.length) return;
      if (targetPoles.length === 1) {
        map.setCenter({ lat: targetPoles[0].lat, lng: targetPoles[0].lng });
        return;
      }
      let south = 90;
      let north = -90;
      let west = 180;
      let east = -180;
      targetPoles.forEach((p) => {
        if (p.lat < south) south = p.lat;
        if (p.lat > north) north = p.lat;
        if (p.lng < west) west = p.lng;
        if (p.lng > east) east = p.lng;
      });
      map.fitBounds({ south, north, west, east });
    },
    [map, poles],
  );

  useEffect(() => {
    if (!map || !project?.pontos?.length) return;
    const activePts = project.pontos
      .filter((p) => p.status_ponto === "Ativo")
      .map((p) => ({ lat: p.latitude, lng: p.longitude }));
    if (activePts.length >= 2) {
      let south = 90;
      let north = -90;
      let west = 180;
      let east = -180;
      activePts.forEach((p) => {
        if (p.lat < south) south = p.lat;
        if (p.lat > north) north = p.lat;
        if (p.lng < west) west = p.lng;
        if (p.lng > east) east = p.lng;
      });
      map.fitBounds({ south, north, west, east });
    } else if (activePts.length === 1) {
      map.setCenter(activePts[0]);
    }
  }, [map, project?.id_projeto]);

  const selectTool = useCallback(
    (toolId) => {
      if (isReadOnly && Boolean(TOOL_EQUIPMENT_CONFIG[toolId])) {
        showToast("Ferramenta bloqueada no modo somente leitura.", { type: "warning" });
        return;
      }
      setTool(toolId);
      setLassoStart(null);
      setCableOriginId(null);
      if (toolId !== "select") {
        setSelectedIds([]);
        setSelectedTrecho(null);
      }
    },
    [isReadOnly, showToast],
  );

  const addPole = useCallback(async ({ lat, lng }, activeTool = "pole") => {
    if (activeTool === "lasso") {
      if (!lassoStart) {
        setLassoStart({ lat, lng });
      } else {
        const minLat = Math.min(lassoStart.lat, lat);
        const maxLat = Math.max(lassoStart.lat, lat);
        const minLng = Math.min(lassoStart.lng, lng);
        const maxLng = Math.max(lassoStart.lng, lng);
        const insideIds = poles
          .filter((p) => p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng)
          .map((p) => p.id);
        setSelectedIds(insideIds);
        setSelectedTrecho(null);
        setLassoStart(null);
        setTool("select");
      }
      return;
    }

    if (!project || isReadOnly) return;
    const equipConfig = TOOL_EQUIPMENT_CONFIG[activeTool] || TOOL_EQUIPMENT_CONFIG.pole;
    try {
      const point = await apiRequest(`/projetos/${projectId}/pontos`, {
        method: "POST",
        body: JSON.stringify({
          descricao: `${equipConfig.prefix} #${poles.length + 1}`,
          latitude: lat,
          longitude: lng,
          status_fisico: "Projetado",
          id_tipo_equipamento: equipConfig.id_tipo_equipamento,
          id_usuario_autor: session.id_usuario,
        }),
      });
      setPoles((current) => [...current, mapPointToUi(point, false)]);
      if (trechos.length > 0 && poles.length + 1 >= 2) {
        const mstResult = await apiRequest(
          `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
          {
            method: "POST",
            body: JSON.stringify({
              no_inicial_id: rootNodeId ? Number(rootNodeId) : null,
              catalogo_cabos: buildCatalogoCabosPayload(),
              ajustar_malha_viaria: snapEnabledRef.current,
            }),
          },
        );
        setDistanceMeters(mstResult.metragem_total);
        setEstimatedCost(mstResult.custo_estimado);
        setCustoCabos(mstResult.custo_total_cabos ?? 0);
        setCustoEquipamentos(mstResult.custo_total_equipamentos ?? 0);
        setSavingsPercent(mstResult.economia_percentual ?? 0);
        setIsGraphConnected(mstResult.grafo_conexo !== false);
        setTrechos(mstResult.trechos_mst || []);
        setAdjacencyList(mstResult.lista_adjacencia || {});
      }
    } catch (error) {
      showToast(error.message, { type: "error" });
    }
  }, [poles, project, isReadOnly, projectId, session.id_usuario, lassoStart, trechos.length, rootNodeId, buildCatalogoCabosPayload, showToast]);

  const movePole = useCallback(async (id, { lat, lng }) => {
    if (isReadOnly) return;
    const previousPosition = poles.find((pole) => pole.id === id);
    if (!previousPosition || previousPosition.isRemoved) return;
    setPoles((current) =>
      current.map((pole) => (pole.id === id ? { ...pole, lat, lng } : pole)),
    );
    try {
      await apiRequest(`/projetos/${projectId}/pontos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          id_usuario_autor: session.id_usuario,
        }),
      });
      if (trechos.length > 0 && poles.length >= 2) {
        const catalogoCabos = buildCatalogoCabosPayload();
        const mstResult = await apiRequest(
          `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
          {
            method: "POST",
            body: JSON.stringify({
              no_inicial_id: rootNodeId ? Number(rootNodeId) : null,
              catalogo_cabos: catalogoCabos,
              ajustar_malha_viaria: snapEnabled,
            }),
          },
        );
        setDistanceMeters(mstResult.metragem_total);
        setEstimatedCost(mstResult.custo_estimado);
        setCustoCabos(mstResult.custo_total_cabos ?? 0);
        setCustoEquipamentos(mstResult.custo_total_equipamentos ?? 0);
        setSavingsPercent(mstResult.economia_percentual ?? 0);
        setTrechos(mstResult.trechos_mst || []);
        setAdjacencyList(mstResult.lista_adjacencia || {});
      }
    } catch (error) {
      setPoles((current) => current.map((pole) => (
        pole.id === id
          ? { ...pole, lat: previousPosition.lat, lng: previousPosition.lng }
          : pole
      )));
      showToast(error.message, { type: "error" });
    }
  }, [poles, isReadOnly, projectId, session.id_usuario, trechos.length, rootNodeId, buildCatalogoCabosPayload, snapEnabled, showToast]);

  const selectPole = useCallback((id, additive) => {
    if (tool === "cable") {
      if (!cableOriginId || cableOriginId === id) {
        setCableOriginId(id);
        setSelectedIds([id]);
        setSelectedTrecho(null);
      } else {
        const matched = trechos.find(
          (t) =>
            (t.origem_id === cableOriginId && t.destino_id === id) ||
            (t.origem_id === id && t.destino_id === cableOriginId),
        );
        setSelectedIds([cableOriginId, id]);
        if (matched) {
          setSelectedTrecho(matched);
        }
        setCableOriginId(null);
        setTool("select");
      }
      return;
    }
    setSelectedTrecho(null);
    setSelectedIds((current) => {
      if (!additive) return [id];
      return current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
    });
  }, [tool, cableOriginId, trechos]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectedTrecho(null);
    setLassoStart(null);
    setCableOriginId(null);
  }, []);

  const calculateTopology = useCallback(async (overrideSnap) => {
    if (isReadOnly) return;
    const useStreetSnap =
      typeof overrideSnap === "boolean" ? overrideSnap : snapEnabledRef.current;
    setIsCalculating(true);
    try {
      const catalogoCabos = buildCatalogoCabosPayload();
      const result = await apiRequest(
        `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
        {
          method: "POST",
          body: JSON.stringify({
            no_inicial_id: rootNodeId ? Number(rootNodeId) : null,
            catalogo_cabos: catalogoCabos,
            ajustar_malha_viaria: useStreetSnap,
          }),
        },
      );

      setDistanceMeters(result.metragem_total);
      setEstimatedCost(result.custo_estimado);
      setCustoCabos(result.custo_total_cabos ?? 0);
      setCustoEquipamentos(result.custo_total_equipamentos ?? 0);
      setSavingsPercent(result.economia_percentual ?? 0);
      setIsGraphConnected(result.grafo_conexo !== false);
      setTrechos(result.trechos_mst || []);
      setAdjacencyList(result.lista_adjacencia || {});
      setSelectedTrecho(null);
      setProject((current) => current ? {
        ...current,
        metragem_total: result.metragem_total,
        custo_estimado: result.custo_estimado,
      } : current);
      showToast("Malha óptica recalculada (Algoritmo de Prim).", { type: "success" });
    } catch (error) {
      showToast(error.message, { type: "error" });
    } finally {
      setIsCalculating(false);
    }
  }, [isReadOnly, projectId, session.id_usuario, rootNodeId, buildCatalogoCabosPayload, showToast]);

  const handleToggleSnap = useCallback(() => {
    if (isReadOnly) return;
    const nextSnap = !snapEnabledRef.current;
    snapEnabledRef.current = nextSnap;
    setSnapEnabled(nextSnap);
    if (trechos.length > 0 && poles.length >= 2) {
      calculateTopology(nextSnap);
    }
  }, [isReadOnly, trechos.length, poles.length, calculateTopology]);

  const removeSelectedPoles = useCallback(async (ids) => {
    if (isReadOnly) return;
    const removable = poles.filter((p) => ids.includes(p.id));
    if (!removable.length) return;
    try {
      await Promise.all(removable.map((pt) => apiRequest(
        `/projetos/${projectId}/pontos/${pt.id}/soft-delete`,
        {
          method: "PATCH",
          body: JSON.stringify({
            novo_status_ponto: "Removido",
            forcar_recalculo_mst: true,
            id_usuario_autor: session.id_usuario,
          }),
        },
      )));
      const catalogoCabos = buildCatalogoCabosPayload();
      const result = await apiRequest(
        `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
        {
          method: "POST",
          body: JSON.stringify({
            no_inicial_id: rootNodeId ? Number(rootNodeId) : null,
            catalogo_cabos: catalogoCabos,
            ajustar_malha_viaria: snapEnabled,
          }),
        },
      );
      setDistanceMeters(result.metragem_total);
      setEstimatedCost(result.custo_estimado);
      setCustoCabos(result.custo_total_cabos ?? 0);
      setCustoEquipamentos(result.custo_total_equipamentos ?? 0);
      setSavingsPercent(result.economia_percentual ?? 0);
      setTrechos(result.trechos_mst || []);
      setAdjacencyList(result.lista_adjacencia || {});
      setPoles((current) => current.filter((pole) => !ids.includes(pole.id)));
      setRemovedPoles((current) => [
        ...current,
        ...removable.map((pt) => ({ ...pt, status_ponto: "Removido", isRemoved: true })),
      ]);
      setSelectedIds([]);
      setSelectedTrecho(null);
      showToast(`${removable.length} ativo(s) movido(s) para o histórico (Soft Delete).`, {
        type: "info",
      });
    } catch (error) {
      showToast(error.message, { type: "error" });
    }
  }, [isReadOnly, poles, projectId, session.id_usuario, rootNodeId, buildCatalogoCabosPayload, snapEnabled, showToast]);

  const saveInspectorEdits = useCallback(async (event, poleId) => {
    event.preventDefault();
    if (isReadOnly || !editDesc.trim()) return;
    setIsSavingInspector(true);
    try {
      const equipNum = Number(editEquip);
      const updated = await apiRequest(`/projetos/${projectId}/pontos/${poleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          descricao: editDesc.trim(),
          status_fisico: editStatusFisico,
          id_tipo_equipamento: equipNum > 0 ? equipNum : null,
          atualizar_tipo_equipamento: true,
          id_usuario_autor: session.id_usuario,
        }),
      });
      setPoles((current) =>
        current.map((p) => (p.id === poleId ? mapPointToUi(updated, false) : p)),
      );
      if (trechos.length > 0 && poles.length >= 2) {
        const result = await apiRequest(
          `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
          {
            method: "POST",
            body: JSON.stringify({
              no_inicial_id: rootNodeId ? Number(rootNodeId) : null,
              catalogo_cabos: buildCatalogoCabosPayload(),
              ajustar_malha_viaria: snapEnabled,
            }),
          },
        );
        setDistanceMeters(result.metragem_total);
        setEstimatedCost(result.custo_estimado);
        setCustoCabos(result.custo_total_cabos ?? 0);
        setCustoEquipamentos(result.custo_total_equipamentos ?? 0);
        setTrechos(result.trechos_mst || []);
        setAdjacencyList(result.lista_adjacencia || {});
      }
      showToast(`Ativo "${updated.descricao}" atualizado.`, { type: "success" });
    } catch (error) {
      showToast(error.message, { type: "error" });
    } finally {
      setIsSavingInspector(false);
    }
  }, [isReadOnly, editDesc, editEquip, editStatusFisico, projectId, session.id_usuario, trechos.length, poles.length, rootNodeId, buildCatalogoCabosPayload, snapEnabled, showToast]);

  const restoreRemovedPole = useCallback(async (poleId) => {
    if (isReadOnly) return;
    try {
      const restored = await apiRequest(
        `/projetos/${projectId}/pontos/${poleId}/soft-delete`,
        {
          method: "PATCH",
          body: JSON.stringify({
            novo_status_ponto: "Ativo",
            forcar_recalculo_mst: false,
            id_usuario_autor: session.id_usuario,
          }),
        },
      );
      setRemovedPoles((current) => current.filter((p) => p.id !== poleId));
      setPoles((current) => [...current, mapPointToUi(restored, false)]);
      setSelectedIds([poleId]);
      showToast(`Ativo "${restored.descricao}" restaurado à malha ativa.`, { type: "success" });
    } catch (error) {
      showToast(error.message, { type: "error" });
    }
  }, [isReadOnly, projectId, session.id_usuario, showToast]);

  const handleInsertAtSearch = useCallback(() => {
    if (!searchResult || isReadOnly) return;
    const chosenTool = TOOL_EQUIPMENT_CONFIG[tool] ? tool : "pole";
    addPole({ lat: searchResult.lat, lng: searchResult.lng }, chosenTool);
    showToast("Ativo inserido na coordenada encontrada.", { type: "success" });
  }, [searchResult, isReadOnly, tool, addPole, showToast]);

  const searchAddress = useCallback(
    async (query) => {
      if (!map) return { ok: false, message: "O mapa ainda está carregando." };

      const notFound = {
        ok: false,
        message: "Endereço não encontrado. Inclua cidade e estado.",
      };
      const baseParams = {
        format: "jsonv2",
        countrycodes: "br",
        limit: "1",
        "accept-language": "pt-BR",
      };

      try {
        let results;
        let cepLabel = null;

        if (CEP_PATTERN.test(query.trim())) {
          const cep = await lookupCep(query.trim());
          if (!cep) return { ok: false, message: "CEP não encontrado." };

          cepLabel = [cep.logradouro, cep.bairro, `${cep.localidade} - ${cep.uf}`]
            .filter(Boolean)
            .join(", ");

          const structured = new URLSearchParams({
            ...baseParams,
            city: cep.localidade,
            state: cep.uf,
            country: "Brasil",
          });
          if (cep.logradouro) structured.set("street", cep.logradouro);
          results = await nominatimSearch(structured);

          if (!results.length) {
            results = await nominatimSearch(
              new URLSearchParams({ ...baseParams, q: cepLabel }),
            );
          }
        } else {
          const params = new URLSearchParams({ ...baseParams, q: query });
          // Prefere resultados próximos da área visível do mapa.
          const view = map.getBounds()?.toJSON();
          if (view) {
            params.set("viewbox", `${view.west},${view.north},${view.east},${view.south}`);
          }
          results = await nominatimSearch(params);
        }

        const best = results[0];
        if (!best) return notFound;

        // boundingbox do Nominatim: [sul, norte, oeste, leste]
        const [south, north, west, east] = (best.boundingbox ?? []).map(Number);
        const label = cepLabel ?? best.display_name;

        setSearchResult({
          lat: Number(best.lat),
          lng: Number(best.lon),
          label,
          precise: best.class === "building" || best.addresstype === "house",
          bounds: best.boundingbox ? { south, north, west, east } : undefined,
        });
        return { ok: true, message: label };
      } catch {
        return {
          ok: false,
          message: "Serviço de busca indisponível. Aguarde alguns segundos e tente de novo.",
        };
      }
    },
    [map],
  );

  const clearSearch = useCallback(() => setSearchResult(null), []);

  const zoomBy = useCallback(
    (delta) => {
      if (map) map.setZoom((map.getZoom() ?? DEFAULT_ZOOM) + delta);
    },
    [map],
  );

  // Atalhos de teclado: V, P, L, C, E, O, D, S, Esc, Delete.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const matchedTool = toolItems.find((item) => item.shortcut === key);

      if (matchedTool) {
        selectTool(matchedTool.id);
      } else if (key === "s") {
        handleToggleSnap();
      } else if (key === "escape") {
        setSelectedIds([]);
        setSelectedTrecho(null);
        setTool("select");
      } else if ((key === "delete" || key === "backspace") && selectedIds.length) {
        event.preventDefault();
        removeSelectedPoles(selectedIds);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, selectTool, removeSelectedPoles, handleToggleSnap]);

  const handleMapStatusChange = useCallback((nextStatus) => {
    if (nextStatus === "fallback") {
      setMapProvider("leaflet");
      setMap(null);
      setStatus("loading");
      return;
    }
    setStatus(nextStatus);
  }, []);

  return (
    <main
      className="workspace"
      data-infraroute-02-sem-nticos-mode="modo-escuro"
    >
      {mapProvider === "google" ? (
        <MapCanvas
          map={map}
          tool={tool}
          isReadOnly={isReadOnly}
          poles={visiblePoles}
          trechos={visibleTrechos}
          selectedIds={selectedIds}
          selectedTrecho={selectedTrecho}
          lassoStart={lassoStart}
          searchResult={searchResult}
          onMapReady={setMap}
          onViewChange={setView}
          onStatusChange={handleMapStatusChange}
          onAddPole={addPole}
          onMovePole={movePole}
          onSelectPole={selectPole}
          onSelectTrecho={setSelectedTrecho}
          onClearSelection={clearSelection}
        />
      ) : (
        <LeafletMapCanvas
          center={MAP_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          tool={tool}
          isReadOnly={isReadOnly}
          poles={visiblePoles}
          trechos={visibleTrechos}
          selectedIds={selectedIds}
          selectedTrecho={selectedTrecho}
          lassoStart={lassoStart}
          searchResult={searchResult}
          onMapReady={setMap}
          onViewChange={setView}
          onStatusChange={handleMapStatusChange}
          onAddPole={addPole}
          onMovePole={movePole}
          onSelectPole={selectPole}
          onSelectTrecho={setSelectedTrecho}
          onClearSelection={clearSelection}
        />
      )}
      {/* Camada de interface: só os controles capturam o mouse; o resto deixa o clique passar para o mapa. */}
      <div className="workspace__overlay">
        <div className="toolbar-zone">
          <ToolBar
            selectedTool={tool}
            isReadOnly={isReadOnly}
            onSelectTool={selectTool}
            snapEnabled={snapEnabled}
            onToggleSnap={handleToggleSnap}
          />
          {status === "ready" && (
            <ToolHint
              tool={tool}
              isReadOnly={isReadOnly}
              selectedCount={selectedIds.length}
              snapEnabled={snapEnabled}
              lassoStart={lassoStart}
              cableOriginId={cableOriginId}
            />
          )}
        </div>
        <div className="quick-guide-wrap">
          <button
            type="button"
            onClick={() => setShowQuickGuide((prev) => !prev)}
            aria-expanded={showQuickGuide}
            className="quick-guide-btn"
          >
            <WorkspaceIcon name="help" className="h-3.5 w-3.5 text-indigo-400" />
            <span>{showQuickGuide ? "Fechar guia" : "Como usar"}</span>
          </button>
          {showQuickGuide && (
            <aside
              className="quick-guide-card"
              aria-label="Guia rápido do Workspace GIS"
            >
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                <strong className="text-xs font-semibold text-white">
                  Fluxo de Projeto (<abbr title="Árvore Geradora Mínima">AGM</abbr> Prim)
                </strong>
                <button
                  type="button"
                  onClick={() => setShowQuickGuide(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Fechar guia rápido"
                >
                  ✕
                </button>
              </div>
              <ol className="m-0 flex list-decimal flex-col gap-2 pl-4 text-[11px] leading-4 text-slate-300">
                <li>
                  <strong>Posicione ativos:</strong> escolha{" "}
                  <kbd>P</kbd> (Poste), <kbd>C</kbd> (<abbr title="Caixa de Terminação Óptica">CTO</abbr>),{" "}
                  <kbd>E</kbd> (<abbr title="Caixa de Emenda Óptica">CEO</abbr>) ou <kbd>O</kbd> (<abbr title="Optical Line Terminal">OLT</abbr>) e clique sobre o mapa.
                </li>
                <li>
                  <strong>Ajuste o traçado:</strong> ative <kbd>S</kbd> (Snap ON) para seguir as ruas ou escolha o modelo de fibra na barra lateral.
                </li>
                <li>
                  <strong>Otimize e inspecione:</strong> com 3+ ativos, o algoritmo de Prim poda ciclos redundantes. Clique em qualquer marcador ou cabo para ver custos e distâncias.
                </li>
              </ol>
            </aside>
          )}
        </div>
        <LiveAuditDrawer placement="workspace-top-right" />
        {!isGraphConnected && poles.length >= 2 && (
          <div
            role="alert"
            className="pointer-events-auto absolute top-28 left-88 z-20 max-w-md rounded-xl border border-amber-500/60 bg-amber-950/90 px-4 py-2.5 text-xs text-amber-200 shadow-xl"
          >
            <strong>Atenção (Ilhas Topológicas — Seção 2.10):</strong> Nem todos os ativos puderam ser conectados pelo Vão Máximo atual ({maxSpan} m). Aumente o vão máximo na barra lateral e recalcule a malha.
          </div>
        )}
        {selectedIds.length > 0 && !selectedTrecho && (() => {
          const selectedPolesList = allDisplayablePoles.filter((p) => selectedIds.includes(p.id));
          const firstPole = selectedPolesList[0];
          if (!firstPole) return null;
          return (
            <aside
              className="pointer-events-auto absolute top-28 right-6 z-20 flex w-80 flex-col gap-2.5 rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur-md"
              aria-label="Detalhes do ativo selecionado"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cyan-400">
                  {selectedPolesList.length === 1
                    ? `${firstPole.name} (#${firstPole.id})`
                    : `${selectedPolesList.length} ativos selecionados`}
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-400 hover:text-white"
                  aria-label="Limpar seleção"
                >
                  ✕
                </button>
              </div>
              {selectedPolesList.length === 1 && (
                firstPole.isRemoved ? (
                  <div className="space-y-2 border-t border-slate-800 pt-2">
                    <p className="rounded bg-rose-950/60 px-2.5 py-1.5 text-[11px] text-rose-200">
                      Status no projeto: <strong>Removido (Soft Delete)</strong>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Coordenadas: {firstPole.lat.toFixed(5)}, {firstPole.lng.toFixed(5)}
                    </p>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => restoreRemovedPole(firstPole.id)}
                        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Restaurar Ativo na Rede ↺
                      </button>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => saveInspectorEdits(e, firstPole.id)}
                    className="space-y-2.5 border-t border-slate-800 pt-2.5"
                  >
                    <div className="flex flex-col gap-1">
                      <label htmlFor="inspector-desc" className="text-[10px] font-semibold uppercase text-slate-400">
                        Descrição técnica
                      </label>
                      <input
                        id="inspector-desc"
                        type="text"
                        required
                        maxLength={255}
                        disabled={isReadOnly || isSavingInspector}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100 disabled:opacity-60"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="inspector-equip" className="text-[10px] font-semibold uppercase text-slate-400">
                          Equipamento
                        </label>
                        <select
                          id="inspector-equip"
                          disabled={isReadOnly || isSavingInspector}
                          value={editEquip}
                          onChange={(e) => setEditEquip(e.target.value)}
                          className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-100 disabled:opacity-60"
                        >
                          <option value="0">Poste (R$ 0)</option>
                          <option value="1">CTO Furukawa (R$ 380)</option>
                          <option value="2">CEO Furukawa (R$ 520)</option>
                          <option value="3">OLT Huawei (R$ 2.450)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="inspector-status" className="text-[10px] font-semibold uppercase text-slate-400">
                          Status Físico
                        </label>
                        <select
                          id="inspector-status"
                          disabled={isReadOnly || isSavingInspector}
                          value={editStatusFisico}
                          onChange={(e) => setEditStatusFisico(e.target.value)}
                          className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-100 disabled:opacity-60"
                        >
                          <option value="Projetado">Projetado</option>
                          <option value="Instalado">Instalado</option>
                          <option value="Em Manutenção">Em Manutenção</option>
                          <option value="Desativado">Desativado</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Custo:{" "}
                        <strong className="text-emerald-400">
                          {Number(firstPole.custo_equipamento || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </strong>
                      </span>
                      <span className="text-[10px]">
                        {firstPole.lat.toFixed(5)}, {firstPole.lng.toFixed(5)}
                      </span>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="submit"
                        disabled={isSavingInspector || !editDesc.trim()}
                        className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {isSavingInspector ? "Salvando..." : "Salvar Alterações"}
                      </button>
                    )}
                  </form>
                )
              )}
              {!isReadOnly && selectedPolesList.some((p) => !p.isRemoved) && (
                <button
                  type="button"
                  onClick={() => removeSelectedPoles(selectedIds)}
                  className="mt-0.5 w-full rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  {selectedPolesList.length === 1 ? (
                    <>
                      Remover Ativo (<kbd>Del</kbd>)
                    </>
                  ) : (
                    <>
                      Remover {selectedPolesList.length} Ativos (<kbd>Del</kbd>)
                    </>
                  )}
                </button>
              )}
            </aside>
          );
        })()}
        {selectedTrecho && (
          <aside
            className="pointer-events-auto absolute top-28 right-6 z-20 flex w-72 flex-col gap-1.5 rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl"
            aria-label="Detalhes do trecho óptico"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-400">
                Trecho #{selectedTrecho.id_trecho} · {selectedTrecho.modelo_cabo}
              </span>
              <button
                type="button"
                onClick={() => setSelectedTrecho(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Fechar detalhes do trecho"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-300">
              {selectedTrecho.origem_descricao} ↔ {selectedTrecho.destino_descricao}
            </p>
            <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-2">
              <span>Distância: <strong>{Number(selectedTrecho.distancia_metros).toFixed(2)} m</strong></span>
              <span>Custo: <strong className="text-emerald-400">{Number(selectedTrecho.custo_trecho).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span>
            </div>
            <span className="text-[10px] text-slate-400">
              Grafo Não Direcionado · {(selectedTrecho.caminho_coordenadas?.length || 0) > 2
                ? `Polilinha Viária (${selectedTrecho.caminho_coordenadas.length} vértices)`
                : "Segmento Geodésico Direto (2 vértices)"}
            </span>
          </aside>
        )}
        <MapStats
          poles={poles}
          distanceMeters={distanceMeters}
          estimatedCost={estimatedCost}
          custoCabos={custoCabos}
          custoEquipamentos={custoEquipamentos}
          savingsPercent={savingsPercent}
        />
        <MapControls
          zoomLevel={view.zoom}
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          onFitBounds={() => fitNetworkBounds(poles)}
        />
        <p className="workspace__status">
          {mapProvider === "google"
            ? `Google Maps · ${STATUS_LABELS[status]}`
            : `OpenStreetMap / Leaflet · ${STATUS_LABELS[status]}`}
        </p>
        <ScaleBar zoomLevel={view.zoom} lat={view.lat} />
      </div>
      <Sidebar
        poles={poles}
        poleCount={poles.length}
        selectedCount={selectedIds.length}
        trechoCount={trechos.length}
        isReadOnly={isReadOnly}
        canChangeStatus={!ehPerfilSomenteLeituraProjetos(session?.nivel_acesso)}
        companyProjects={companyProjects}
        currentProjectId={projectId}
        onSwitchProject={(nextId) => navigate(`/workspace?id_projeto=${nextId}`)}
        onChangeProjectStatus={handleChangeProjectStatus}
        isUpdatingProjectStatus={isUpdatingProjectStatus}
        projectStatus={project?.status}
        searchEnabled={status === "ready"}
        searchResult={searchResult}
        onInsertAtSearch={handleInsertAtSearch}
        onSearch={searchAddress}
        onClearSearch={clearSearch}
        projectName={project?.nome}
        canCalculate={Boolean(project)}
        onCalculate={calculateTopology}
        isCalculating={isCalculating}
        cableType={cableType}
        onCableTypeChange={handleCableTypeChange}
        cablePrice={cablePrice}
        onCablePriceChange={setCablePrice}
        maxSpan={maxSpan}
        onMaxSpanChange={setMaxSpan}
        rootNodeId={rootNodeId}
        onRootNodeChange={setRootNodeId}
        snapEnabled={snapEnabled}
        layerState={layerState}
        onToggleLayer={toggleLayer}
        onOpenGraphModal={() => setShowGraphModal(true)}
        onOpenReportModal={() => setShowReportModal(true)}
      />

      {showGraphModal && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Inspeção Topológica do Grafo AGM de Prim"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Grafo Otimizado — Árvore Geradora Mínima (Algoritmo de Prim)
                </h2>
                <p className="text-xs text-slate-400">
                  {poles.length} nós ativos · {trechos.length} enlaces na AGM · Economia:{" "}
                  {Number(savingsPercent || 0).toFixed(1)}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGraphModal(false)}
                aria-label="Fechar inspeção topológica"
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Fechar ✕
              </button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
              <section aria-labelledby="agm-edges-heading">
                <h3 id="agm-edges-heading" className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Enlaces Selecionados (Trecho_Rede)
                </h3>
                <div className="tabela-wrap rounded-xl border border-slate-800">
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">Arestas da Árvore Geradora Mínima</caption>
                    <thead className="bg-slate-950/80 text-[11px] text-slate-400">
                      <tr>
                        <th scope="col" className="px-3 py-2">Origem</th>
                        <th scope="col" className="px-3 py-2">Destino</th>
                        <th scope="col" className="px-3 py-2">Cabo</th>
                        <th scope="col" className="px-3 py-2 text-right">Distância</th>
                        <th scope="col" className="px-3 py-2 text-right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trechos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                            Calcule a malha otimizada para visualizar os enlaces da AGM.
                          </td>
                        </tr>
                      ) : (
                        trechos.map((tr) => (
                          <tr key={tr.id_trecho} className="border-t border-slate-800">
                            <td className="px-3 py-2 font-medium text-slate-100">
                              #{tr.origem_id} {tr.origem_descricao}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-100">
                              #{tr.destino_id} {tr.destino_descricao}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{tr.modelo_cabo}</td>
                            <td className="px-3 py-2 text-right">{Number(tr.distancia_metros).toFixed(2)} m</td>
                            <td className="px-3 py-2 text-right text-emerald-400">
                              {Number(tr.custo_trecho).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {Object.keys(adjacencyList).length > 0 && (
                <section aria-labelledby="adj-heading">
                  <h3 id="adj-heading" className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Lista de Adjacência (Grafo Não Direcionado)
                  </h3>
                  <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                    {Object.entries(adjacencyList).map(([nodeId, neighbors]) => (
                      <li
                        key={nodeId}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                      >
                        <strong className="text-cyan-300">Nó #{nodeId}</strong>
                        <p className="mt-1 text-[11px] text-slate-300">
                          {neighbors.length === 0
                            ? "Sem vizinhos no raio limite."
                            : neighbors
                                .map((n) => `→ #${n.destino_id} (${Number(n.distancia_metros).toFixed(1)}m)`)
                                .join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {showReportModal && project && (
        <ProjectReportModal
          projectId={projectId}
          initialDetail={{
            ...project,
            metragem_total: distanceMeters,
            custo_estimado: estimatedCost,
            pontos: poles.map((p) => ({
              id_ponto: p.id,
              descricao: p.name,
              latitude: p.lat,
              longitude: p.lng,
              status_fisico: p.status_fisico || "Projetado",
              status_ponto: "Ativo",
              id_tipo_equipamento: p.id_tipo_equipamento,
              custo_equipamento: p.custo_equipamento,
            })),
            trechos,
          }}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </main>
  );
};

export default WorkspaceGis;