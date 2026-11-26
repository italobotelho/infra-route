import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CARTO_DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const OSM_FALLBACK_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const TOOL_EQUIPMENT_SET = new Set(["pole", "cto", "ceo", "olt"]);

function getMarkerAcronym(idTipoEquipamento) {
  if (idTipoEquipamento === 1) return "CTO";
  if (idTipoEquipamento === 2) return "CEO";
  if (idTipoEquipamento === 3) return "OLT";
  return "P";
}

function getMarkerTypeDescription(idTipoEquipamento) {
  if (idTipoEquipamento === 1) return "Caixa CTO Furukawa · R$ 380,00";
  if (idTipoEquipamento === 2) return "Caixa de Emenda CEO Furukawa · R$ 520,00";
  if (idTipoEquipamento === 3) return "Switch / OLT Central Huawei · R$ 2.450,00";
  return "Poste de Passagem · R$ 0,00";
}

function getCableStrokeColor(trecho, theme = "dark") {
  const modelo = (trecho?.modelo_cabo || "").toUpperCase();
  if (theme === "light") {
    if (modelo.includes("AS-200") || trecho?.id_tipo_cabo === 3) return "#d97706";
    if (modelo.includes("AS-120") || trecho?.id_tipo_cabo === 2) return "#7c3aed";
    return "#0284c7";
  }
  if (modelo.includes("AS-200") || trecho?.id_tipo_cabo === 3) return "#f59e0b";
  if (modelo.includes("AS-120") || trecho?.id_tipo_cabo === 2) return "#a855f7";
  return "#38bdf8";
}

function createPoleDivIcon(pole, selected, tool) {
  const equipAttr = pole.id_tipo_equipamento ? `data-equip="${pole.id_tipo_equipamento}"` : "";
  const selectedClass = selected ? " pole-marker--selected" : "";
  const removedClass = pole.isRemoved ? " pole-marker--removed" : "";
  const acronym = getMarkerAcronym(pole.id_tipo_equipamento);
  const titleText = pole.isRemoved
    ? `${pole.name} (Removido — Clique para restaurar)`
    : `${pole.name} (${getMarkerTypeDescription(pole.id_tipo_equipamento)}) — Clique para inspecionar`;

  return L.divIcon({
    className: "leaflet-pole-wrapper",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="pole-marker leaflet-pole-inner${selectedClass}${removedClass}" role="button" tabindex="0" data-tool="${tool}" ${equipAttr} title="${titleText.replace(/"/g, "&quot;")}" aria-label="${titleText.replace(/"/g, "&quot;")}">${acronym}</div>`,
  });
}

export function LeafletMapCanvas({
  center,
  defaultZoom,
  theme = "dark",
  tool,
  isReadOnly = false,
  poles,
  trechos = [],
  selectedIds,
  selectedTrecho,
  highlightedTrechoIds = [],
  lassoStart = null,
  searchResult,
  onMapReady,
  onViewChange,
  onStatusChange,
  onAddPole,
  onMovePole,
  onSelectPole,
  onSelectTrecho,
  onSelectLassoBounds,
  onClearSelection,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const switchedToFallbackRef = useRef(false);
  const initialThemeRef = useRef(theme);
  const markersRef = useRef(new Map());
  const polylinesRef = useRef([]);
  const searchMarkerRef = useRef(null);
  const lassoMarkerRef = useRef(null);
  const lassoRectRef = useRef(null);
  const lassoDragRef = useRef(null);
  const suppressLassoClickRef = useRef(false);
  const handlersRef = useRef({});

  handlersRef.current = {
    tool,
    isReadOnly,
    lassoStart,
    onAddPole,
    onMovePole,
    onSelectPole,
    onSelectTrecho,
    onSelectLassoBounds,
    onClearSelection,
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const leafletMap = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: defaultZoom,
      minZoom: 10,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: false,
    });

    const initialTileUrl =
      initialThemeRef.current === "light" ? CARTO_LIGHT_TILES : CARTO_DARK_TILES;
    const tileLayer = L.tileLayer(initialTileUrl, {
      subdomains: "abcd",
      maxZoom: 20,
    });

    switchedToFallbackRef.current = false;
    tileLayer.on("tileerror", () => {
      if (!switchedToFallbackRef.current) {
        switchedToFallbackRef.current = true;
        tileLayer.setUrl(OSM_FALLBACK_TILES);
      }
    });
    tileLayer.addTo(leafletMap);
    tileLayerRef.current = tileLayer;

    const emitView = () => {
      const currentCenter = leafletMap.getCenter();
      onViewChange({
        zoom: leafletMap.getZoom() ?? defaultZoom,
        lat: currentCenter?.lat ?? center.lat,
      });
    };

    const clearLassoRect = () => {
      if (lassoRectRef.current) {
        lassoRectRef.current.remove();
        lassoRectRef.current = null;
      }
    };

    const drawLassoRect = (start, end) => {
      const south = Math.min(start.lat, end.lat);
      const north = Math.max(start.lat, end.lat);
      const west = Math.min(start.lng, end.lng);
      const east = Math.max(start.lng, end.lng);
      const bounds = [
        [south, west],
        [north, east],
      ];
      if (!lassoRectRef.current) {
        lassoRectRef.current = L.rectangle(bounds, {
          color: "#22d3ee",
          weight: 2,
          dashArray: "6 4",
          fillColor: "#22d3ee",
          fillOpacity: 0.22,
          interactive: false,
          className: "lasso-rect-animated",
        }).addTo(leafletMap);
      } else {
        lassoRectRef.current.setBounds(bounds);
      }
    };

    leafletMap.on("zoomend moveend", emitView);
    leafletMap.on("mousedown", (event) => {
      if (handlersRef.current.tool !== "lasso" || event.originalEvent?.button !== 0) return;
      const start = { lat: event.latlng.lat, lng: event.latlng.lng };
      lassoDragRef.current = {
        start,
        last: start,
        startX: event.originalEvent.clientX,
        startY: event.originalEvent.clientY,
        moved: false,
      };
    });

    leafletMap.on("mousemove", (event) => {
      if (handlersRef.current.tool !== "lasso") return;
      const current = { lat: event.latlng.lat, lng: event.latlng.lng };
      const drag = lassoDragRef.current;
      if (drag) {
        const dist = Math.hypot(
          event.originalEvent.clientX - drag.startX,
          event.originalEvent.clientY - drag.startY,
        );
        if (dist >= 5) drag.moved = true;
        drag.last = current;
        if (drag.moved) {
          drawLassoRect(drag.start, current);
        }
      } else if (handlersRef.current.lassoStart) {
        drawLassoRect(handlersRef.current.lassoStart, current);
      }
    });

    const finishDragLasso = () => {
      const drag = lassoDragRef.current;
      if (!drag) return;
      lassoDragRef.current = null;
      if (!drag.moved) return;
      suppressLassoClickRef.current = true;
      window.setTimeout(() => {
        suppressLassoClickRef.current = false;
      }, 0);
      clearLassoRect();
      handlersRef.current.onSelectLassoBounds?.({
        south: Math.min(drag.start.lat, drag.last.lat),
        north: Math.max(drag.start.lat, drag.last.lat),
        west: Math.min(drag.start.lng, drag.last.lng),
        east: Math.max(drag.start.lng, drag.last.lng),
      });
    };

    leafletMap.on("mouseup", finishDragLasso);
    window.addEventListener("mouseup", finishDragLasso);

    leafletMap.on("click", (event) => {
      if (suppressLassoClickRef.current) return;
      const {
        tool: activeTool,
        isReadOnly: readOnly,
        onAddPole: addFn,
        onClearSelection: clearFn,
      } = handlersRef.current;
      const latlng = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (!readOnly && TOOL_EQUIPMENT_SET.has(activeTool)) {
        addFn(latlng, activeTool);
      } else if (activeTool === "lasso") {
        addFn(latlng, "lasso");
      } else if (activeTool === "select" && !event.originalEvent?.shiftKey) {
        clearFn();
      }
    });

    const mapBridge = {
      setCenter: (pos) => leafletMap.setView([pos.lat, pos.lng], leafletMap.getZoom()),
      setZoom: (nextZoom) => leafletMap.setZoom(nextZoom),
      getZoom: () => leafletMap.getZoom(),
      fitBounds: (bounds) => {
        if (!bounds) return;
        leafletMap.fitBounds(
          [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
          ],
          { padding: [48, 48], maxZoom: 18 },
        );
      },
      getBounds: () => ({
        toJSON: () => {
          const b = leafletMap.getBounds();
          return {
            south: b.getSouth(),
            north: b.getNorth(),
            west: b.getWest(),
            east: b.getEast(),
          };
        },
      }),
    };

    mapRef.current = leafletMap;
    onMapReady(mapBridge);
    onStatusChange("ready");
    emitView();

    return () => {
      window.removeEventListener("mouseup", finishDragLasso);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      polylinesRef.current.forEach((line) => line.remove());
      polylinesRef.current = [];
      searchMarkerRef.current?.remove();
      lassoMarkerRef.current?.remove();
      clearLassoRect();
      tileLayerRef.current = null;
      leafletMap.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng, defaultZoom, onMapReady, onStatusChange, onViewChange]);

  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;
    switchedToFallbackRef.current = false;
    tileLayer.setUrl(theme === "light" ? CARTO_LIGHT_TILES : CARTO_DARK_TILES);
  }, [theme]);

  useEffect(() => {
    const el = containerRef.current;
    const leafletMap = mapRef.current;
    if (el) {
      const isCrosshair = (!isReadOnly && TOOL_EQUIPMENT_SET.has(tool)) || tool === "lasso";
      el.dataset.cursorTool = isCrosshair ? "crosshair" : "grab";
    }
    if (leafletMap) {
      if (tool === "lasso") {
        leafletMap.dragging.disable();
      } else {
        leafletMap.dragging.enable();
        lassoDragRef.current = null;
        if (lassoRectRef.current) {
          lassoRectRef.current.remove();
          lassoRectRef.current = null;
        }
      }
    }
  }, [tool, isReadOnly]);

  useEffect(() => {
    const leafletMap = mapRef.current;
    if (!leafletMap) return;

    const registry = markersRef.current;
    const activeIds = new Set(poles.map((p) => p.id));

    registry.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        registry.delete(id);
      }
    });

    poles.forEach((pole) => {
      const isSelected = selectedIds.includes(pole.id);
      const canDrag = tool === "select" && !isReadOnly && !pole.isRemoved;
      const icon = createPoleDivIcon(pole, isSelected, tool);
      let marker = registry.get(pole.id);

      if (!marker) {
        marker = L.marker([pole.lat, pole.lng], {
          icon,
          draggable: canDrag,
          keyboard: true,
        }).addTo(leafletMap);

        marker.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          const { tool: activeTool, onSelectPole: selectFn } = handlersRef.current;
          if (activeTool === "select" || activeTool === "cable") {
            const orig = event.originalEvent;
            selectFn(pole.id, Boolean(orig?.shiftKey || orig?.metaKey || orig?.ctrlKey));
          }
        });

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          handlersRef.current.onMovePole(pole.id, { lat: pos.lat, lng: pos.lng });
        });

        registry.set(pole.id, marker);
      } else {
        const currentPos = marker.getLatLng();
        if (Math.abs(currentPos.lat - pole.lat) > 1e-8 || Math.abs(currentPos.lng - pole.lng) > 1e-8) {
          marker.setLatLng([pole.lat, pole.lng]);
        }
        marker.setIcon(icon);
        if (marker.dragging) {
          if (canDrag) marker.dragging.enable();
          else marker.dragging.disable();
        }
      }
    });
  }, [poles, selectedIds, tool, isReadOnly]);

  useEffect(() => {
    const leafletMap = mapRef.current;
    polylinesRef.current.forEach((line) => line.remove());
    polylinesRef.current = [];
    if (!leafletMap || !trechos?.length) return;

    const polesById = new Map(poles.map((pole) => [pole.id, pole]));
    trechos.forEach((trecho) => {
      const origin = polesById.get(trecho.origem_id ?? trecho.id_ponto_origem);
      const dest = polesById.get(trecho.destino_id ?? trecho.id_ponto_destino);
      if (!origin || !dest) return;

      const rawCoords = Array.isArray(trecho.caminho_coordenadas) ? trecho.caminho_coordenadas : [];
      const latlngs =
        rawCoords.length >= 2
          ? [
              [origin.lat, origin.lng],
              ...rawCoords.slice(1, -1).map((c) => [Number(c.lat), Number(c.lng)]),
              [dest.lat, dest.lng],
            ]
          : [
              [origin.lat, origin.lng],
              [dest.lat, dest.lng],
            ];

      const isSelected =
        selectedTrecho?.id_trecho === trecho.id_trecho ||
        highlightedTrechoIds.includes(trecho.id_trecho);
      const line = L.polyline(latlngs, {
        color: isSelected ? "#22d3ee" : getCableStrokeColor(trecho, theme),
        opacity: isSelected ? 1.0 : 0.92,
        weight: isSelected ? 5 : 3.5,
      }).addTo(leafletMap);

      line.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        handlersRef.current.onSelectTrecho?.(trecho);
      });

      polylinesRef.current.push(line);
    });
  }, [poles, trechos, selectedTrecho, highlightedTrechoIds, theme]);

  useEffect(() => {
    const leafletMap = mapRef.current;
    if (!leafletMap) return;
    if (lassoMarkerRef.current) {
      lassoMarkerRef.current.remove();
      lassoMarkerRef.current = null;
    }
    if (!lassoStart) {
      if (!lassoDragRef.current && lassoRectRef.current) {
        lassoRectRef.current.remove();
        lassoRectRef.current = null;
      }
      return;
    }
    const lassoIcon = L.divIcon({
      className: "leaflet-search-wrapper",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      html: '<div class="lasso-pin leaflet-search-inner" title="1º canto da área de seleção"></div>',
    });
    lassoMarkerRef.current = L.marker([lassoStart.lat, lassoStart.lng], {
      icon: lassoIcon,
      interactive: false,
    }).addTo(leafletMap);
  }, [lassoStart]);

  useEffect(() => {
    const leafletMap = mapRef.current;
    if (!leafletMap) return;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
    if (!searchResult) return;

    const searchIcon = L.divIcon({
      className: "leaflet-search-wrapper",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: `<div class="search-marker leaflet-search-inner" title="${String(searchResult.label || "").replace(/"/g, "&quot;")}"></div>`,
    });

    searchMarkerRef.current = L.marker([searchResult.lat, searchResult.lng], {
      icon: searchIcon,
      interactive: false,
    }).addTo(leafletMap);

    if (searchResult.precise || !searchResult.bounds) {
      leafletMap.setView([searchResult.lat, searchResult.lng], 18);
    } else {
      leafletMap.fitBounds([
        [searchResult.bounds.south, searchResult.bounds.west],
        [searchResult.bounds.north, searchResult.bounds.east],
      ]);
    }
  }, [searchResult]);

  return (
    <section
      className="map-canvas"
      aria-label="Mapa GIS Interativo (OpenStreetMap / Leaflet)"
    >
      <div ref={containerRef} className="fill-parent" />
    </section>
  );
}
