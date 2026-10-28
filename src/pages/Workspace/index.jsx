import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, getSession } from "../../lib/api";
import "./workspace-gis.css";
import xdefault from "./assets/default.svg";
import default2 from "./assets/default-2.svg";
import default3 from "./assets/default-3.svg";
import default4 from "./assets/default-4.svg";
import default5 from "./assets/default-5.svg";
import default6 from "./assets/default-6.svg";
import default7 from "./assets/default-7.svg";
import default8 from "./assets/default-8.svg";
import default9 from "./assets/default-9.svg";
import default10 from "./assets/default-10.svg";
import default11 from "./assets/default-11.svg";
import default12 from "./assets/default-12.svg";
import default13 from "./assets/default-13.svg";
import default14 from "./assets/default-14.svg";
import default15 from "./assets/default-15.svg";
import default16 from "./assets/default-16.svg";
import default17 from "./assets/default-17.svg";
import default18 from "./assets/default-18.svg";
import default23 from "./assets/default-23.svg";
import image from "./assets/image.svg";
import zoom from "./assets/zoom.svg";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Junta nomes de classe, ignorando valores falsos.
const cx = (...names) => names.filter(Boolean).join(" ");

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
  { id: "select", label: "Selecionar · V", shortcut: "v", icon: default2 },
  { id: "lasso", label: "Lasso · L", shortcut: "l", icon: default3 },
  { id: "pole", label: "Poste · P", shortcut: "p", icon: default4 },
  { id: "cto", label: "CTO · C", shortcut: "c", icon: default5 },
  { id: "ceo", label: "CEO · E", shortcut: "e", icon: default6 },
  { id: "olt", label: "OLT · O", shortcut: "o", icon: default7 },
  { id: "cable", label: "Cabo · D", shortcut: "d", icon: default8 },
];

const layers = [
  {
    label: "Camada de Postes Parceiros",
    icon: default14,
    enabled: true,
    bright: true,
  },
  {
    label: "Dutos e Cabos Ópticos",
    icon: default15,
    enabled: true,
    bright: true,
  },
  {
    label: "Caixas CTO / CEO / OLT",
    icon: default16,
    enabled: true,
    bright: true,
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
/* Busca de endereço e CEP (serviços gratuitos)                        */
/* ------------------------------------------------------------------ */

const CEP_PATTERN = /^\d{5}-?\d{3}$/;

// Nominatim (OpenStreetMap) permite no máximo 1 consulta por segundo para o
// app inteiro e proíbe busca enquanto digita. Por isso: fila, intervalo
// mínimo entre chamadas e cache dos resultados.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const nominatimCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimCall = 0;

function nominatimSearch(params) {
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

// ViaCEP devolve rua, bairro e cidade do CEP (sem coordenadas).
async function lookupCep(cep) {
  const digits = cep.replace(/\D/g, "");
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`);
  const data = await response.json();
  return data.erro ? null : data;
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
// [data-tool] para o cursor). Aqui só alternamos classes e atributos.
function applyPoleStyle(element, { selected, tool, idTipoEquipamento }) {
  element.classList.toggle("pole-marker--selected", selected);
  element.dataset.tool = tool;
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
    if (handlersRef.current.tool !== "select" || event.button !== 0) return;
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
  poles,
  trechos = [],
  selectedIds,
  selectedTrecho,
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
  const handlersRef = useRef({});
  const [error, setError] = useState("");

  handlersRef.current = { tool, onMovePole, onSelectPole };

  // Cria o mapa uma única vez.
  useEffect(() => {
    let cancelled = false;

    const fail = (message) => {
      setError(message);
      onStatusChange("error");
    };

    // O Google chama esta função quando a chave é recusada.
    window.gm_authFailure = () =>
      fail(
        "O Google recusou a chave da API. Confira se a Maps JavaScript API está ativada e se as restrições de domínio permitem este endereço.",
      );

    (async () => {
      try {
        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error(
            "Chave não encontrada. Configure VITE_GOOGLE_MAPS_API_KEY ou GOOGLE_MAPS_API_KEY no arquivo .env.local na raiz do projeto e reinicie o Vite.",
          );
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
    const isPlacementOrLasso = Boolean(TOOL_EQUIPMENT_CONFIG[tool]) || tool === "lasso";
    map.setOptions({ draggableCursor: isPlacementOrLasso ? "crosshair" : null });
  }, [map, tool]);

  // Clique no mapa: adiciona ativo (P, C, E, O), seleciona em caixa (L) ou limpa a seleção (V).
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (event) => {
      if (TOOL_EQUIPMENT_CONFIG[tool] && event.latLng) {
        onAddPole(event.latLng.toJSON(), tool);
      } else if (tool === "lasso" && event.latLng) {
        onAddPole(event.latLng.toJSON(), "lasso");
      } else if (tool === "select" && !event.domEvent?.shiftKey) {
        onClearSelection();
      }
    });
    return () => listener.remove();
  }, [map, tool, onAddPole, onClearSelection]);

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

  // Remove os marcadores ao desmontar.
  useEffect(() => {
    const registry = markersRef.current;
    const searchRef = searchOverlayRef;
    return () => {
      Object.values(registry).forEach(({ overlay }) => overlay.setMap(null));
      polylinesRef.current.forEach((line) => line.setMap(null));
      searchRef.current?.setMap(null);
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

function ToolButton({ tool, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool.id)}
      aria-pressed={active}
      aria-keyshortcuts={tool.shortcut.toUpperCase()}
      className={cx("tool-button", active && "tool-button--active")}
    >
      <span className="icon-slot">
        <img
          className="icon-fill"
          src={tool.icon}
          alt=""
        />
      </span>
      <span
        className="tool-button__label"
      >
        {tool.label}
      </span>
    </button>
  );
}

function ToolBar({ selectedTool, onSelectTool, snapEnabled, onToggleSnap }) {
  return (
    <nav
      className="toolbar"
      aria-label="Ferramentas de edição"
    >
      {toolItems.slice(0, 2).map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={selectedTool === tool.id}
          onSelect={onSelectTool}
        />
      ))}

      <span className="divider-vertical" aria-hidden="true" />
      {toolItems.slice(2).map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={selectedTool === tool.id}
          onSelect={onSelectTool}
        />
      ))}

      <span className="divider-vertical" aria-hidden="true" />
      <button
        type="button"
        onClick={onToggleSnap}
        aria-pressed={snapEnabled}
        aria-keyshortcuts="S"
        className={cx(
          "tool-button",
          snapEnabled && "tool-button--snap-on",
        )}
      >
        <span className="icon-slot">
          <img
            className="icon-fill"
            src={snapEnabled ? default10 : default9}
            alt=""
          />
        </span>
        <span
          className="tool-button__label tool-button__label--snap"
        >
          Snap {snapEnabled ? "ON" : "OFF"} · S
        </span>
      </button>
    </nav>
  );
}

function ToolHint({ tool, selectedCount, snapEnabled, lassoStart, cableOriginId }) {
  let text;
  if (tool === "pole") {
    text = "Clique no mapa para posicionar um Poste de passagem · Esc para voltar";
  } else if (tool === "cto") {
    text = "Clique no mapa para posicionar uma Caixa CTO (R$ 380,00) · Esc para voltar";
  } else if (tool === "ceo") {
    text = "Clique no mapa para posicionar uma Caixa de Emenda CEO (R$ 520,00) · Esc para voltar";
  } else if (tool === "olt") {
    text = "Clique no mapa para posicionar um Switch / OLT POP (R$ 2.450,00) · Esc para voltar";
  } else if (tool === "lasso") {
    text = lassoStart
      ? "Lasso: clique no 2º canto do retângulo para selecionar os ativos da área · Esc cancela"
      : "Lasso: clique no 1º canto no mapa para abrir uma caixa de seleção múltipla";
  } else if (tool === "cable") {
    text = cableOriginId
      ? `Cabo: origem #${cableOriginId} selecionada · clique no ativo de destino para inspecionar o enlace`
      : "Cabo: clique no ativo de origem e depois no destino para inspecionar o trecho óptico";
  } else if (tool === "select") {
    text =
      selectedCount > 0
        ? `${selectedCount} selecionado${selectedCount > 1 ? "s" : ""} · Delete remove · arraste para mover`
        : `Clique em um ativo ou trecho óptico para inspecionar · Modo ${snapEnabled ? "Snap Viário ON" : "Geodésico Direto OFF"}`;
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

function MapStats({ poles, distanceMeters, estimatedCost, savingsPercent }) {
  const purePoles = poles.filter((p) => !p.id_tipo_equipamento).length;
  const ctoCount = poles.filter((p) => p.id_tipo_equipamento === 1).length;
  const ceoCount = poles.filter((p) => p.id_tipo_equipamento === 2).length;
  const oltCount = poles.filter((p) => p.id_tipo_equipamento === 3).length;

  return (
    <aside className="map-stats">
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
      </div>
      <span className="divider-vertical" aria-hidden="true" />
      <div className="map-stats__group map-stats__group--counts">
        <span className="map-stats__counts">
          {purePoles} {purePoles === 1 ? "Poste" : "Postes"} | {ctoCount} CTOs | {ceoCount} CEOs{oltCount > 0 ? ` | ${oltCount} OLTs` : ""}
        </span>
        <span className="map-stats__savings">
          <img className="icon-13" src={xdefault} alt="" />
          <span className="map-stats__savings-text">
            {Number(savingsPercent || 0).toFixed(1)}% economia de material (AGM Prim)
          </span>
        </span>
      </div>
    </aside>
  );
}

function MapControls({ zoomLevel, onZoomIn, onZoomOut }) {
  return (
    <>
      <div className="map-controls">
        <div className="map-controls__compass">
          <span className="map-controls__compass-label">
            N
          </span>
          <span className="map-controls__compass-icon">
            <img
              className="icon-fill"
              src={image}
              alt="Orientação norte"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={onZoomIn}
          className="map-controls__zoom"
          aria-label="Aumentar zoom"
        >
          <img className="fill-parent" src={zoom} alt="" />
          <span className="map-controls__sign map-controls__sign--plus">
            +
          </span>
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="map-controls__zoom map-controls__zoom--out"
          aria-label="Diminuir zoom"
        >
          <img className="fill-parent" src={zoom} alt="" />
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
  const label = distance >= 1000 ? `${distance / 1000} km` : `${distance} m`;

  return (
    <div className="scale-bar">
      <span
        className="scale-bar__line"
        style={{ width }}
      />
      <span className="scale-bar__label">
        {label}
      </span>
    </div>
  );
}

function WorkspaceHeader({ poleCount, selectedCount }) {
  let summary = "Edição inicial · Nenhum elemento";
  if (poleCount > 0) {
    summary = `${poleCount} ${poleCount === 1 ? "elemento" : "elementos"}`;
    if (selectedCount > 0) {
      summary += ` · ${selectedCount} ${selectedCount === 1 ? "selecionado" : "selecionados"}`;
    }
  }

  return (
    <header className="workspace-header">
      <p className="workspace-header__summary">
        {summary}
      </p>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Barra lateral                                                       */
/* ------------------------------------------------------------------ */

function LayerSwitch({ layer, enabled, onToggle }) {
  return (
    <div className="layer-switch">
      <span className="layer-switch__icon">
        <img
          className="icon-fill"
          src={layer.icon}
          alt=""
        />
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
    </div>
  );
}

function Sidebar({
  poleCount,
  trechoCount,
  searchEnabled,
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
  snapEnabled,
  layerState,
  onToggleLayer,
}) {
  const [search, setSearch] = useState("");
  const [searchState, setSearchState] = useState({
    message: "",
    error: false,
  });

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
              <img className="brand__mark-icon" src={default11} alt="" />
            </div>
            <span className="brand__name">
              InfraRoute
            </span>
            <span className="brand__tag">
              GIS
            </span>
          </div>
          <div className="project">
            <span className="project__eyebrow">
              WORKSPACE DE ENGENHARIA
            </span>
            <h2 className="project__name">
              {projectName || "Carregando projeto..."}
            </h2>
            <span className="project__badge">
              {snapEnabled ? "Traçado Viário (Snap ON)" : "Geodésico Direto (Snap OFF)"}
            </span>
            <Link className="mt-2 text-xs text-blue-600 hover:underline" to="/projetos">
              ← Voltar aos projetos
            </Link>
          </div>
        </div>
        <div className="divider-horizontal" />
        <div className="sidebar__content">
          <form className="search" onSubmit={submitSearch} role="search">
            <label className="search__field">
              <img className="search__icon" src={default12} alt="" />
              <input
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
          </form>
          <div className="divider-horizontal" />
          <section
            className="panel-section"
            aria-labelledby="layers-heading"
          >
            <div className="panel-section__heading">
              <img className="icon-16" src={default13} alt="" />
              <h3
                id="layers-heading"
                className="panel-section__title"
              >
                Gerenciador de Camadas
              </h3>
            </div>
            <div className="layer-list">
              {layers.map((layer, index) => (
                <LayerSwitch
                  key={layer.label}
                  layer={layer}
                  enabled={layerState[index]}
                  onToggle={() => updateLayer(index)}
                />
              ))}
            </div>
            <div className="panel-note">
              <img className="icon-13" src={default17} alt="" />
              <p className="panel-note__text">
                {poleCount > 0
                  ? `${poleCount} ativo(s) e ${trechoCount} enlace(s) óptico(s) renderizados no mapa.`
                  : "Nenhum ativo carregado. As camadas habilitadas permanecem vazias."}
              </p>
            </div>
          </section>
          <div className="divider-horizontal" />
          <section
            className="panel-section panel-section--spaced"
            aria-labelledby="parameters-heading"
          >
            <div className="panel-section__heading">
              <img className="icon-16" src={default18} alt="" />
              <h3
                id="parameters-heading"
                className="panel-section__title"
              >
                Parâmetros do algoritmo
              </h3>
            </div>
            <label className="field">
              <span className="field__label">
                Tipo de cabo
              </span>
              <span className="field__wrap">
                <select
                  value={cableType}
                  onChange={(event) => onCableTypeChange(event.target.value)}
                  className="field__control"
                >
                  <option value="AS-80 12 FO">AS-80 12 FO</option>
                  <option value="AS-120 24 FO">AS-120 24 FO</option>
                  <option value="AS-200 48 FO">AS-200 48 FO</option>
                </select>
                <img
                  className="field__chevron"
                  src={default23}
                  alt=""
                />
              </span>
            </label>
            <div className="field-row">
              <label className="field field--grow">
                <span className="field__label">
                  Cabo/m
                </span>
                <span className="field__wrap">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
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
              <label className="field field--grow">
                <span className="field__label">
                  Vão máximo
                </span>
                <span className="field__wrap">
                  <input
                    type="number"
                    min="1"
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
            disabled={!canCalculate || isCalculating}
          >
            {isCalculating ? "Calculando..." : "Calcular Malha Otimizada ⚡"}
          </button>
        </footer>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

const STATUS_LABELS = {
  loading: "Carregando Google Maps…",
  ready: "Google Maps · conectado · Busca: © OpenStreetMap e ViaCEP",
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
  const session = getSession();
  const projectId = Number(searchParams.get("id_projeto"));
  const [map, setMap] = useState(null);
  const [status, setStatus] = useState("loading");
  const [view, setView] = useState({ zoom: DEFAULT_ZOOM, lat: MAP_CENTER.lat });
  const [tool, setTool] = useState("select");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const snapEnabledRef = useRef(true);
  snapEnabledRef.current = snapEnabled;
  const [poles, setPoles] = useState([]);
  const [trechos, setTrechos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTrecho, setSelectedTrecho] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [project, setProject] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [savingsPercent, setSavingsPercent] = useState(0);
  const [cableType, setCableType] = useState("AS-80 12 FO");
  const [cablePrice, setCablePrice] = useState(4.5);
  const [maxSpan, setMaxSpan] = useState(2000);
  const [layerState, setLayerState] = useState(() => layers.map((layer) => layer.enabled));
  const [lassoStart, setLassoStart] = useState(null);
  const [cableOriginId, setCableOriginId] = useState(null);
  const [isGraphConnected, setIsGraphConnected] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  const toggleLayer = useCallback((index) => {
    setLayerState((current) =>
      current.map((value, layerIndex) => (layerIndex === index ? !value : value)),
    );
  }, []);

  const visiblePoles = poles.filter((pole) => {
    if (!pole.id_tipo_equipamento) return layerState[0] !== false;
    return layerState[2] !== false;
  });
  const visibleTrechos = layerState[1] !== false ? trechos : [];

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

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      navigate("/projetos", { replace: true });
      return;
    }

    let cancelled = false;
    const loadProject = async () => {
      setRequestError("");
      try {
        const result = await apiRequest(
          `/projetos/${projectId}?id_usuario_autor=${session.id_usuario}`,
        );
        if (cancelled) return;
        const activePoints = (result.pontos || []).filter(
          (point) => point.status_ponto === "Ativo",
        );
        setProject(result);
        setDistanceMeters(result.metragem_total);
        setEstimatedCost(result.custo_estimado);
        setTrechos(result.trechos || []);
        setPoles(
          activePoints.map((point) => ({
            id: point.id_ponto,
            name: point.descricao,
            lat: point.latitude,
            lng: point.longitude,
            id_tipo_equipamento: point.id_tipo_equipamento ?? null,
            custo_equipamento: point.custo_equipamento ?? 0,
          })),
        );

        // Se o projeto abriu com Snap ON ativo mas os trechos salvos ainda estão em linha reta (2 vértices),
        // ou para sincronizar economia_percentual e o traçado viário inicial automaticamente:
        if (snapEnabledRef.current && activePoints.length >= 2) {
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
            setSavingsPercent(mstResult.economia_percentual ?? 0);
            setIsGraphConnected(mstResult.grafo_conexo !== false);
            setTrechos(mstResult.trechos_mst || []);
          }
        }
      } catch (error) {
        if (!cancelled) setRequestError(error.message);
      }
    };

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [projectId, session.id_usuario, navigate]);

  useEffect(() => {
    if (!map || !project?.pontos?.length) return;
    const activePoint = project.pontos.find((p) => p.status_ponto === "Ativo") || project.pontos[0];
    map.setCenter({ lat: activePoint.latitude, lng: activePoint.longitude });
  }, [map, project?.id_projeto]);

  const selectTool = useCallback((toolId) => {
    setTool(toolId);
    setLassoStart(null);
    setCableOriginId(null);
    if (toolId !== "select") {
      setSelectedIds([]);
      setSelectedTrecho(null);
    }
  }, []);

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

    if (!project) return;
    setRequestError("");
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
      setPoles((current) => [
        ...current,
        {
          id: point.id_ponto,
          name: point.descricao,
          lat: point.latitude,
          lng: point.longitude,
          id_tipo_equipamento: point.id_tipo_equipamento ?? null,
          custo_equipamento: point.custo_equipamento ?? 0,
        },
      ]);
      if (trechos.length > 0 && poles.length + 1 >= 2) {
        const mstResult = await apiRequest(
          `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
          {
            method: "POST",
            body: JSON.stringify({
              catalogo_cabos: buildCatalogoCabosPayload(),
              ajustar_malha_viaria: snapEnabledRef.current,
            }),
          },
        );
        setDistanceMeters(mstResult.metragem_total);
        setEstimatedCost(mstResult.custo_estimado);
        setSavingsPercent(mstResult.economia_percentual ?? 0);
        setIsGraphConnected(mstResult.grafo_conexo !== false);
        setTrechos(mstResult.trechos_mst || []);
      }
    } catch (error) {
      setRequestError(error.message);
    }
  }, [poles, project, projectId, session.id_usuario, lassoStart, trechos.length, buildCatalogoCabosPayload]);

  const movePole = useCallback(async (id, { lat, lng }) => {
    const previousPosition = poles.find((pole) => pole.id === id);
    if (!previousPosition) return;
    setPoles((current) =>
      current.map((pole) => (pole.id === id ? { ...pole, lat, lng } : pole)),
    );
    setRequestError("");
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
              catalogo_cabos: catalogoCabos,
              ajustar_malha_viaria: snapEnabled,
            }),
          },
        );
        setDistanceMeters(mstResult.metragem_total);
        setEstimatedCost(mstResult.custo_estimado);
        setSavingsPercent(mstResult.economia_percentual ?? 0);
        setTrechos(mstResult.trechos_mst || []);
      }
    } catch (error) {
      setPoles((current) => current.map((pole) => (
        pole.id === id
          ? { ...pole, lat: previousPosition.lat, lng: previousPosition.lng }
          : pole
      )));
      setRequestError(error.message);
    }
  }, [poles, projectId, session.id_usuario, trechos.length, buildCatalogoCabosPayload, snapEnabled]);

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
    const useStreetSnap =
      typeof overrideSnap === "boolean" ? overrideSnap : snapEnabledRef.current;
    setIsCalculating(true);
    setRequestError("");
    try {
      const catalogoCabos = buildCatalogoCabosPayload();
      const result = await apiRequest(
        `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
        {
          method: "POST",
          body: JSON.stringify({
            catalogo_cabos: catalogoCabos,
            ajustar_malha_viaria: useStreetSnap,
          }),
        },
      );

      setDistanceMeters(result.metragem_total);
      setEstimatedCost(result.custo_estimado);
      setSavingsPercent(result.economia_percentual ?? 0);
      setIsGraphConnected(result.grafo_conexo !== false);
      setTrechos(result.trechos_mst || []);
      setSelectedTrecho(null);
      setProject((current) => current ? {
        ...current,
        metragem_total: result.metragem_total,
        custo_estimado: result.custo_estimado,
      } : current);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setIsCalculating(false);
    }
  }, [projectId, session.id_usuario, buildCatalogoCabosPayload]);

  const handleToggleSnap = useCallback(() => {
    const nextSnap = !snapEnabledRef.current;
    snapEnabledRef.current = nextSnap;
    setSnapEnabled(nextSnap);
    if (trechos.length > 0 && poles.length >= 2) {
      calculateTopology(nextSnap);
    }
  }, [trechos.length, poles.length, calculateTopology]);

  const removeSelectedPoles = useCallback(async (ids) => {
    setRequestError("");
    try {
      await Promise.all(ids.map((id) => apiRequest(
        `/projetos/${projectId}/pontos/${id}/soft-delete`,
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
            catalogo_cabos: catalogoCabos,
            ajustar_malha_viaria: snapEnabled,
          }),
        },
      );
      setDistanceMeters(result.metragem_total);
      setEstimatedCost(result.custo_estimado);
      setSavingsPercent(result.economia_percentual ?? 0);
      setTrechos(result.trechos_mst || []);
      setPoles((current) => current.filter((pole) => !ids.includes(pole.id)));
      setSelectedIds([]);
      setSelectedTrecho(null);
    } catch (error) {
      setRequestError(error.message);
    }
  }, [projectId, session.id_usuario, buildCatalogoCabosPayload, snapEnabled]);

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

  return (
    <main
      className="workspace"
      data-infraroute-02-sem-nticos-mode="modo-escuro"
    >
      <MapCanvas
        map={map}
        tool={tool}
        poles={visiblePoles}
        trechos={visibleTrechos}
        selectedIds={selectedIds}
        selectedTrecho={selectedTrecho}
        searchResult={searchResult}
        onMapReady={setMap}
        onViewChange={setView}
        onStatusChange={setStatus}
        onAddPole={addPole}
        onMovePole={movePole}
        onSelectPole={selectPole}
        onSelectTrecho={setSelectedTrecho}
        onClearSelection={clearSelection}
      />
      {/* Camada de interface: só os controles capturam o mouse; o resto deixa o clique passar para o mapa. */}
      <div className="workspace__overlay">
        <WorkspaceHeader
          poleCount={poles.length}
          selectedCount={selectedIds.length}
        />
        <ToolBar
          selectedTool={tool}
          onSelectTool={selectTool}
          snapEnabled={snapEnabled}
          onToggleSnap={handleToggleSnap}
        />
        {status === "ready" && (
          <ToolHint
            tool={tool}
            selectedCount={selectedIds.length}
            snapEnabled={snapEnabled}
            lassoStart={lassoStart}
            cableOriginId={cableOriginId}
          />
        )}
        {!isGraphConnected && poles.length >= 2 && (
          <div
            role="alert"
            className="pointer-events-auto absolute top-28 left-88 z-20 max-w-md rounded-xl border border-amber-500/60 bg-amber-950/90 px-4 py-2.5 text-xs text-amber-200 shadow-xl"
          >
            <strong>Atenção (Ilhas Topológicas — Seção 2.10):</strong> Nem todos os ativos puderam ser conectados pelo Vão Máximo atual ({maxSpan} m). Aumente o vão máximo na barra lateral e recalcule a malha.
          </div>
        )}
        {selectedIds.length > 0 && !selectedTrecho && (() => {
          const selectedPolesList = poles.filter((p) => selectedIds.includes(p.id));
          const firstPole = selectedPolesList[0];
          const equipLabel =
            firstPole?.id_tipo_equipamento === 1
              ? "Caixa CTO Furukawa"
              : firstPole?.id_tipo_equipamento === 2
                ? "Caixa de Emenda CEO Furukawa"
                : firstPole?.id_tipo_equipamento === 3
                  ? "Switch / OLT Huawei"
                  : "Poste de Passagem (Apoio)";
          return (
            <aside
              className="pointer-events-auto absolute top-28 right-6 z-20 flex w-72 flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl"
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
              {selectedPolesList.length === 1 && firstPole && (
                <>
                  <p className="text-[11px] text-slate-300">
                    Tipo: <strong>{equipLabel}</strong>
                  </p>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                    <span>Custo Unit.: <strong className="text-emerald-400">{Number(firstPole.custo_equipamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span>
                    <span className="text-[10px] text-slate-400">{firstPole.lat.toFixed(5)}, {firstPole.lng.toFixed(5)}</span>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => removeSelectedPoles(selectedIds)}
                className="mt-1 w-full rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                {selectedPolesList.length === 1
                  ? "Remover Ativo Selecionado (Del)"
                  : `Remover ${selectedPolesList.length} Ativos (Del)`}
              </button>
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
          savingsPercent={savingsPercent}
        />
        <MapControls
          zoomLevel={view.zoom}
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
        />
        <p className="workspace__status">
          {STATUS_LABELS[status]}
        </p>
        <ScaleBar zoomLevel={view.zoom} lat={view.lat} />
      </div>
      <Sidebar
        poleCount={poles.length}
        trechoCount={trechos.length}
        searchEnabled={status === "ready"}
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
        snapEnabled={snapEnabled}
        layerState={layerState}
        onToggleLayer={toggleLayer}
      />
      {requestError && (
        <p className="workspace__status" role="alert">{requestError}</p>
      )}
    </main>
  );
};

export default WorkspaceGis;