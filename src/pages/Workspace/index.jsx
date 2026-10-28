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
    label: "Dutos Subterrâneos",
    icon: default15,
    enabled: false,
    bright: false,
  },
  {
    label: "Caixas CTO Existentes",
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

function createPoleElement() {
  const element = document.createElement("div");
  element.className = "pole-marker";
  element.setAttribute("role", "button");
  return element;
}

// A aparência vem do CSS (.pole-marker, .pole-marker--selected e
// [data-tool] para o cursor). Aqui só alternamos classes e atributos.
function applyPoleStyle(element, { selected, tool }) {
  element.classList.toggle("pole-marker--selected", selected);
  element.dataset.tool = tool;
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
    if (suppressClick || handlersRef.current.tool !== "select") return;
    handlersRef.current.onSelectPole(
      pole.id,
      event.shiftKey || event.metaKey || event.ctrlKey,
    );
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
  searchResult,
  onMapReady,
  onViewChange,
  onStatusChange,
  onAddPole,
  onMovePole,
  onSelectPole,
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
    map.setOptions({ draggableCursor: tool === "pole" ? "crosshair" : null });
  }, [map, tool]);

  // Clique no mapa: adiciona poste (P) ou limpa a seleção (V).
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (event) => {
      if (tool === "pole" && event.latLng) {
        onAddPole(event.latLng.toJSON());
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
      if (!currentIds.has(id)) {
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
      });
    });
  }, [map, poles, selectedIds, tool]);

  // Resultado da busca: marcador âmbar e movimento da câmera.
  // Sincroniza os trechos (AGM/Prim) com polilinhas no mapa.
  useEffect(() => {
    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];
    if (!map || !window.google?.maps?.Polyline || !trechos?.length) return;

    const polesById = new Map(poles.map((pole) => [pole.id, pole]));
    trechos.forEach((trecho) => {
      const origin = polesById.get(trecho.origem_id ?? trecho.id_ponto_origem);
      const dest = polesById.get(trecho.destino_id ?? trecho.id_ponto_destino);
      if (!origin || !dest) return;
      const line = new window.google.maps.Polyline({
        path: [
          { lat: origin.lat, lng: origin.lng },
          { lat: dest.lat, lng: dest.lng },
        ],
        geodesic: true,
        strokeColor: "#38bdf8",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        clickable: false,
        map,
      });
      polylinesRef.current.push(line);
    });
  }, [map, poles, trechos]);

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

function ToolHint({ tool, selectedCount }) {
  let text;
  if (tool === "pole") {
    text = "Clique no mapa para posicionar um poste · Esc para voltar";
  } else if (tool === "select") {
    text =
      selectedCount > 0
        ? `${selectedCount} selecionado${selectedCount > 1 ? "s" : ""} · Delete remove · arraste para mover`
        : "Clique em um poste para selecionar · Shift para vários";
  } else {
    const item = toolItems.find((entry) => entry.id === tool);
    text = `${item?.label.split(" · ")[0]} ainda não está disponível`;
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

function MapStats({ poleCount, distanceMeters, estimatedCost }) {
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
            km
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
          {poleCount} {poleCount === 1 ? "Poste" : "Postes"} | 0 CTOs | 0 CEOs
        </span>
        <span className="map-stats__savings">
          <img className="icon-13" src={xdefault} alt="" />
          <span className="map-stats__savings-text">
            0% economia de material
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
  searchEnabled,
  onSearch,
  onClearSearch,
  projectName,
  canCalculate,
  onCalculate,
  isCalculating,
}) {
  const [search, setSearch] = useState("");
  const [searchState, setSearchState] = useState({
    message: "",
    error: false,
  });
  const [layerState, setLayerState] = useState(
    layers.map((layer) => layer.enabled),
  );
  const [cableType, setCableType] = useState("AS-80 12 FO");
  const [cablePrice, setCablePrice] = useState(8.5);
  const [maxSpan, setMaxSpan] = useState(45);

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
    setLayerState((current) =>
      current.map((value, layerIndex) =>
        layerIndex === index ? !value : value,
      ),
    );
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
              Rascunho
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
                Nenhum ativo carregado. As camadas habilitadas permanecem
                vazias.
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
                  onChange={(event) => setCableType(event.target.value)}
                  className="field__control"
                >
                  <option>AS-80 12 FO</option>
                  <option>AS-120 24 FO</option>
                  <option>AS-200 48 FO</option>
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
                    onChange={(event) => setCablePrice(event.target.value)}
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
                    onChange={(event) => setMaxSpan(event.target.value)}
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
                : `${poleCount} ${poleCount === 1 ? "poste inserido" : "postes inseridos"}`}
            </span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={onCalculate}
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
  const [poles, setPoles] = useState([]);
  const [trechos, setTrechos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [project, setProject] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [requestError, setRequestError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

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
        setProject(result);
        setDistanceMeters(result.metragem_total);
        setEstimatedCost(result.custo_estimado);
        setTrechos(result.trechos || []);
        setPoles(
          result.pontos
            .filter((point) => point.status_ponto === "Ativo")
            .map((point) => ({
              id: point.id_ponto,
              name: point.descricao,
              lat: point.latitude,
              lng: point.longitude,
            })),
        );
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
    if (toolId !== "select") setSelectedIds([]);
  }, []);

  const addPole = useCallback(async ({ lat, lng }) => {
    if (!project) return;
    setRequestError("");
    try {
      const point = await apiRequest(`/projetos/${projectId}/pontos`, {
        method: "POST",
        body: JSON.stringify({
          descricao: `Ponto ${poles.length + 1}`,
          latitude: lat,
          longitude: lng,
          status_fisico: "Projetado",
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
        },
      ]);
    } catch (error) {
      setRequestError(error.message);
    }
  }, [poles.length, project, projectId, session.id_usuario]);

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
    } catch (error) {
      setPoles((current) => current.map((pole) => (
        pole.id === id
          ? { ...pole, lat: previousPosition.lat, lng: previousPosition.lng }
          : pole
      )));
      setRequestError(error.message);
    }
  }, [poles, projectId, session.id_usuario]);

  const selectPole = useCallback((id, additive) => {
    setSelectedIds((current) => {
      if (!additive) return [id];
      return current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

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
      const result = await apiRequest(
        `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
        { method: "POST", body: "null" },
      );
      setDistanceMeters(result.metragem_total);
      setEstimatedCost(result.custo_estimado);
      setTrechos(result.trechos_mst || []);
      setPoles((current) => current.filter((pole) => !ids.includes(pole.id)));
      setSelectedIds([]);
    } catch (error) {
      setRequestError(error.message);
    }
  }, [projectId, session.id_usuario]);

  const calculateTopology = useCallback(async () => {
    setIsCalculating(true);
    setRequestError("");
    try {
      const result = await apiRequest(
        `/projetos/${projectId}/mst?id_usuario_autor=${session.id_usuario}`,
        { method: "POST", body: "null" },
      );
      setDistanceMeters(result.metragem_total);
      setEstimatedCost(result.custo_estimado);
      setTrechos(result.trechos_mst || []);
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
  }, [projectId, session.id_usuario]);

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
        setSnapEnabled((value) => !value);
      } else if (key === "escape") {
        setSelectedIds([]);
        setTool("select");
      } else if ((key === "delete" || key === "backspace") && selectedIds.length) {
        event.preventDefault();
        removeSelectedPoles(selectedIds);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, selectTool, removeSelectedPoles]);

  return (
    <main
      className="workspace"
      data-infraroute-02-sem-nticos-mode="modo-escuro"
    >
      <MapCanvas
        map={map}
        tool={tool}
        poles={poles}
        trechos={trechos}
        selectedIds={selectedIds}
        searchResult={searchResult}
        onMapReady={setMap}
        onViewChange={setView}
        onStatusChange={setStatus}
        onAddPole={addPole}
        onMovePole={movePole}
        onSelectPole={selectPole}
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
          onToggleSnap={() => setSnapEnabled((value) => !value)}
        />
        {status === "ready" && (
          <ToolHint tool={tool} selectedCount={selectedIds.length} />
        )}
        <MapStats
          poleCount={poles.length}
          distanceMeters={distanceMeters}
          estimatedCost={estimatedCost}
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
        searchEnabled={status === "ready"}
        onSearch={searchAddress}
        onClearSearch={clearSearch}
        projectName={project?.nome}
        canCalculate={Boolean(project)}
        onCalculate={calculateTopology}
        isCalculating={isCalculating}
      />
      {requestError && (
        <p className="workspace__status" role="alert">{requestError}</p>
      )}
    </main>
  );
};

export default WorkspaceGis;