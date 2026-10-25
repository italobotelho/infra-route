import { useState } from "react";
import area from "./area.svg";
import arterial from "./arterial.svg";
import arterialBorder from "./arterial-border.svg";
import xdefault from "./default.svg";
import default2 from "./default-2.svg";
import default3 from "./default-3.svg";
import default4 from "./default-4.svg";
import default5 from "./default-5.svg";
import default6 from "./default-6.svg";
import default7 from "./default-7.svg";
import default8 from "./default-8.svg";
import default9 from "./default-9.svg";
import default10 from "./default-10.svg";
import default11 from "./default-11.svg";
import default12 from "./default-12.svg";
import default13 from "./default-13.svg";
import default14 from "./default-14.svg";
import default15 from "./default-15.svg";
import default16 from "./default-16.svg";
import default17 from "./default-17.svg";
import default18 from "./default-18.svg";
import default23 from "./default-23.svg";
import footprints from "./footprints.svg";
import image from "./image.svg";
import lagoon from "./lagoon.svg";
import local from "./local.svg";
import median from "./median.svg";
import paths from "./paths.svg";
import urban from "./urban.svg";
import zoom from "./zoom.svg";

const mapLabels = [
  {
    text: "Rua Paula Bueno",
    className:
      "top-[calc(50.00%_-_207px)] left-[calc(50.00%_-_288px)] rotate-[-5.70deg]",
  },
  {
    text: "Rua Dona Maria Umbelina Couto",
    className:
      "top-[calc(50.00%_-_10px)] left-[calc(50.00%_+_26px)] rotate-[-5.70deg]",
  },
  {
    text: "Rua Dr. Armando Sales de Oliveira",
    className:
      "top-[calc(50.00%_+_256px)] left-[calc(50.00%_-_227px)] rotate-[-5.70deg]",
  },
  {
    text: "Rua Azarias de Melo",
    className:
      "top-[calc(50.00%_+_198px)] left-[calc(50.00%_+_251px)] rotate-[-5.70deg]",
  },
  {
    text: "Rua Carolina Florence",
    className:
      "top-[calc(50.00%_+_308px)] left-[calc(50.00%_+_404px)] rotate-[-5.70deg]",
  },
  {
    text: "Rua José de Campos",
    className:
      "top-[calc(50.00%_-_244px)] left-[calc(50.00%_-_22px)] rotate-[76.50deg]",
  },
  {
    text: "Rua D. Pedro I",
    className:
      "top-[calc(50.00%_+_70px)] left-[calc(50.00%_-_263px)] rotate-[76.50deg]",
  },
  {
    text: "Rua Emília Paiva Meira",
    className:
      "top-[calc(50.00%_+_22px)] left-[calc(50.00%_+_488px)] rotate-[76.50deg]",
  },
  {
    text: "Av. Nossa Senhora de Fátima",
    className:
      "top-[calc(50.00%_+_43px)] left-[calc(50.00%_-_201px)] rotate-[-28.00deg] text-[#d1dae2] text-[11px]",
  },
  {
    text: "Av. Dr. Heitor Penteado",
    className:
      "top-[calc(50.00%_+_165px)] left-[calc(50.00%_+_170px)] rotate-[75.00deg] text-[#d1dae2] text-[11px]",
  },
];

const neighborhoodLabels = [
  {
    text: "TAQUARAL",
    className:
      "top-[calc(50.00%_-_119px)] left-[calc(50.00%_-_128px)] text-[17px] tracking-[0.68px]",
  },
  {
    text: "JARDIM",
    className:
      "top-[calc(50.00%_+_116px)] left-[calc(50.00%_+_416px)] text-[13px] tracking-[0.39px]",
  },
  {
    text: "NOSSA SENHORA",
    className:
      "top-[calc(50.00%_+_138px)] left-[calc(50.00%_+_400px)] text-[13px] tracking-[0.39px]",
  },
  {
    text: "AUXILIADORA",
    className:
      "top-[calc(50.00%_+_160px)] left-[calc(50.00%_+_426px)] text-[13px] tracking-[0.39px]",
  },
  {
    text: "CAMBUÍ",
    className:
      "top-[calc(50.00%_+_383px)] left-[calc(50.00%_-_233px)] text-xs tracking-[0.36px]",
  },
];

const toolItems = [
  { label: "Selecionar · V", icon: default2, active: true },
  { label: "Lasso · L", icon: default3 },
  { label: "Poste · P", icon: default4 },
  { label: "CTO · C", icon: default5 },
  { label: "CEO · E", icon: default6 },
  { label: "OLT · O", icon: default7 },
  { label: "Cabo · D", icon: default8 },
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

const mapImages = [
  {
    src: urban,
    alt: "Mapa urbano",
    className:
      "absolute top-[calc(50.00%_-_450px)] left-[calc(50.00%_-_720px)] w-[1440px] h-[900px]",
  },
  {
    src: footprints,
    alt: "Edificações do mapa",
    className:
      "absolute top-[calc(50.00%_-_450px)] left-[calc(50.00%_-_720px)] w-[1440px] h-[900px]",
  },
  {
    src: local,
    alt: "Ruas locais",
    className:
      "absolute top-[calc(50.00%_-_450px)] left-[calc(50.00%_-_720px)] w-[1440px] h-[900px]",
  },
  {
    src: area,
    alt: "Área do parque",
    className:
      "absolute top-[calc(50.00%_-_426px)] left-[calc(50.00%_+_285px)] w-[435px] h-[330px]",
  },
  {
    src: paths,
    alt: "Caminhos do parque",
    className:
      "absolute top-[calc(50.00%_-_401px)] left-[calc(50.00%_+_303px)] w-[417px] h-[283px]",
  },
  {
    src: lagoon,
    alt: "Lagoa",
    className:
      "absolute top-[calc(50.00%_-_377px)] left-[calc(50.00%_+_444px)] w-[193px] h-[195px]",
  },
  {
    src: arterialBorder,
    alt: "Borda das vias arteriais",
    className:
      "absolute top-[calc(50.00%_-_450px)] left-[calc(50.00%_-_544px)] w-[1264px] h-[900px]",
  },
  {
    src: arterial,
    alt: "Vias arteriais",
    className:
      "absolute top-[calc(50.00%_-_450px)] left-[calc(50.00%_-_543px)] w-[1263px] h-[900px]",
  },
  {
    src: median,
    alt: "Canteiros centrais",
    className:
      "absolute top-[calc(50.00%_-_450px)] left-[calc(50.00%_-_540px)] w-[1260px] h-[900px]",
  },
];

function MapCanvas() {
  return (
    <section
      className="absolute top-0 left-0 h-full w-full overflow-hidden bg-[#111a23]"
      aria-label="Mapa de Taquaral"
    >
      {mapImages.map((mapImage) => (
        <img
          key={mapImage.alt}
          className={mapImage.className}
          src={mapImage.src}
          alt={mapImage.alt}
        />
      ))}

      {mapLabels.map((label) => (
        <span
          key={label.text}
          className={`${label.className} absolute whitespace-nowrap [font-family:'Inter-Regular',Helvetica] font-normal text-[#bac6d2] text-[10px] tracking-[0] leading-[normal]`}
        >
          {label.text}
        </span>
      ))}

      {neighborhoodLabels.map((label) => (
        <span
          key={label.text}
          className={`${label.className} absolute [font-family:'Inter-Regular',Helvetica] font-normal text-[#a6b6c3] leading-[normal]`}
        >
          {label.text}
        </span>
      ))}

      <div className="absolute top-[calc(50.00%_-_323px)] left-[calc(50.00%_+_431px)] w-40 text-center [font-family:'Inter-Regular',Helvetica] text-[11px] font-normal leading-[16.5px] text-[#b5cec1]">
        Parque Portugal
        <br />
        Lagoa do Taquaral
      </div>
    </section>
  );
}

function ToolBar() {
  const [selectedTool, setSelectedTool] = useState("Selecionar · V");
  const [snapEnabled, setSnapEnabled] = useState(true);

  return (
    <nav
      className="absolute top-4 left-[calc(50.00%_-_123px)] inline-flex items-center gap-1 overflow-hidden rounded-[18px] border border-solid border-slate-700 bg-slate-900 p-2 shadow-[0px_8px_32px_#02061754] backdrop-blur-[10px]"
      aria-label="Ferramentas de edição"
    >
      {toolItems.slice(0, 2).map((tool) => (
        <button
          key={tool.label}
          type="button"
          onClick={() => setSelectedTool(tool.label)}
          aria-pressed={selectedTool === tool.label}
          className={`flex h-14 w-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl ${
            selectedTool === tool.label ? "bg-indigo-600" : ""
          }`}
        >
          <span className="relative h-5 w-5">
            <img
              className="absolute inset-0 h-full w-full"
              src={tool.icon}
              alt=""
            />
          </span>
          <span
            className={`[font-family:'Inter-${
              selectedTool === tool.label ? "SemiBold" : "Regular"
            }',Helvetica] text-[9px] leading-[normal] ${
              selectedTool === tool.label
                ? "font-semibold text-white"
                : "font-normal text-slate-300"
            }`}
          >
            {tool.label}
          </span>
        </button>
      ))}

      <span className="h-9 w-px bg-slate-700" aria-hidden="true" />
      {toolItems.slice(2).map((tool) => (
        <button
          key={tool.label}
          type="button"
          onClick={() => setSelectedTool(tool.label)}
          aria-pressed={selectedTool === tool.label}
          className={`flex h-14 w-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl ${
            selectedTool === tool.label ? "bg-indigo-600" : ""
          }`}
        >
          <span className="relative h-5 w-5">
            <img
              className="absolute inset-0 h-full w-full"
              src={tool.icon}
              alt=""
            />
          </span>
          <span className="relative w-fit [font-family:'Inter-Regular',Helvetica] text-[9px] font-normal leading-[normal] text-slate-300">
            {tool.label}
          </span>
        </button>
      ))}

      <span className="h-9 w-px bg-slate-700" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setSnapEnabled((value) => !value)}
        aria-pressed={snapEnabled}
        className={`relative flex h-14 w-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl ${
          snapEnabled ? "bg-[#123530]" : ""
        }`}
      >
        <span className="relative h-5 w-5">
          <img
            className="absolute inset-0 h-full w-full"
            src={snapEnabled ? default10 : default9}
            alt=""
          />
        </span>
        <span
          className={`[font-family:'Inter-SemiBold',Helvetica] text-[9px] font-semibold leading-[normal] ${
            snapEnabled ? "text-cyan-300" : "text-slate-300"
          }`}
        >
          Snap {snapEnabled ? "ON" : "OFF"} · S
        </span>
      </button>
    </nav>
  );
}

function MapStats() {
  return (
    <aside className="absolute bottom-6 left-[344px] inline-flex items-center gap-6 overflow-hidden rounded-xl border border-solid border-slate-700 bg-slate-900 px-5 py-4 shadow-[0px_8px_32px_#02061754]">
      <div className="inline-flex flex-col items-start gap-1.5">
        <span className="[font-family:'Inter-Regular',Helvetica] text-[10px] font-normal leading-[15px] text-slate-300">
          Distância Total Acumulada
        </span>
        <span className="inline-flex items-baseline gap-[5px]">
          <strong className="[font-family:'Inter-SemiBold',Helvetica] text-2xl font-semibold tracking-[-0.17px] text-slate-50">
            0.00
          </strong>
          <span className="[font-family:'Inter-Regular',Helvetica] text-[13px] font-normal leading-[19.5px] text-slate-300">
            km
          </span>
        </span>
      </div>
      <span className="h-9 w-px bg-slate-700" aria-hidden="true" />
      <div className="inline-flex flex-col items-start gap-1.5">
        <span className="[font-family:'Inter-Regular',Helvetica] text-[10px] font-normal leading-[15px] text-slate-300">
          Custo Estimado da Obra
        </span>
        <strong className="[font-family:'Inter-SemiBold',Helvetica] text-2xl font-semibold tracking-[-0.17px] text-slate-50">
          R$ 0,00
        </strong>
      </div>
      <span className="h-9 w-px bg-slate-700" aria-hidden="true" />
      <div className="inline-flex flex-col items-start gap-[9px]">
        <span className="[font-family:'Inter-Medium',Helvetica] text-[11px] font-medium leading-[16.5px] text-slate-300">
          0 Postes | 0 CTOs | 0 CEOs
        </span>
        <span className="inline-flex items-center gap-1.5">
          <img className="h-[13px] w-[13px]" src={xdefault} alt="" />
          <span className="[font-family:'Inter-Regular',Helvetica] text-[10px] font-normal leading-[15px] text-[#86efac]">
            0% economia de material
          </span>
        </span>
      </div>
    </aside>
  );
}

function MapControls() {
  const [zoomLevel, setZoomLevel] = useState(0);

  return (
    <>
      <div className="absolute bottom-[54px] right-6 inline-flex flex-col items-start gap-3">
        <div className="flex h-12 w-10 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-solid border-slate-700 bg-slate-900">
          <span className="[font-family:'Inter-SemiBold',Helvetica] text-[9px] font-semibold text-slate-300">
            N
          </span>
          <span className="relative h-[18px] w-[18px]">
            <img
              className="absolute inset-0 h-full w-full"
              src={image}
              alt="Orientação norte"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={() => setZoomLevel((level) => level + 1)}
          className="relative h-10 w-10"
          aria-label="Aumentar zoom"
        >
          <img className="h-full w-full" src={zoom} alt="" />
          <span className="absolute inset-x-0 top-1 text-lg leading-none text-slate-300">
            +
          </span>
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((level) => level - 1)}
          className="relative -mt-3 h-10 w-10"
          aria-label="Diminuir zoom"
        >
          <img className="h-full w-full" src={zoom} alt="" />
          <span className="absolute inset-x-0 bottom-1 text-lg leading-none text-slate-300">
            −
          </span>
        </button>
      </div>
      <span className="sr-only">Nível de zoom: {zoomLevel}</span>
    </>
  );
}

function WorkspaceHeader() {
  return (
    <header className="absolute top-28 left-[344px] inline-flex flex-col items-start gap-[3px]">
      <span className="[font-family:'Inter-Medium',Helvetica] text-[11px] font-medium text-slate-300">
        CAMPINAS / SP
      </span>
      <h1 className="[font-family:'Inter-Medium',Helvetica] text-xl font-medium tracking-[-0.10px] text-slate-50">
        Taquaral
      </h1>
      <p className="[font-family:'Inter-Regular',Helvetica] text-[11px] font-normal leading-[16.5px] text-slate-300">
        Edição inicial · Nenhum elemento
      </p>
    </header>
  );
}

function LayerSwitch({ layer, enabled, onToggle }) {
  return (
    <div className="flex h-12 w-full items-center gap-2.5">
      <span className="relative h-[17px] w-[17px]">
        <img
          className="absolute inset-0 h-full w-full"
          src={layer.icon}
          alt=""
        />
      </span>
      <span
        className={`flex-1 [font-family:'Inter-Regular',Helvetica] text-[11px] leading-[16.5px] ${
          layer.bright ? "text-slate-50" : "text-slate-300"
        }`}
      >
        {layer.label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${layer.label}: ${enabled ? "ativada" : "desativada"}`}
        onClick={onToggle}
        className={`flex h-[18px] w-[30px] items-center rounded-[999px] p-[3px] ${
          enabled ? "justify-end bg-indigo-600" : "justify-start bg-slate-700"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-md ${enabled ? "bg-white" : "bg-slate-300"}`}
        />
      </button>
    </div>
  );
}

function Sidebar() {
  const [search, setSearch] = useState("");
  const [layerState, setLayerState] = useState(
    layers.map((layer) => layer.enabled),
  );
  const [cableType, setCableType] = useState("AS-80 12 FO");
  const [cablePrice, setCablePrice] = useState(8.5);
  const [maxSpan, setMaxSpan] = useState(45);

  const updateLayer = (index) => {
    setLayerState((current) =>
      current.map((value, layerIndex) =>
        layerIndex === index ? !value : value,
      ),
    );
  };

  return (
    <aside className="absolute top-0 left-0 h-full w-80">
      <div className="flex h-full w-80 flex-col items-start border-r border-solid border-slate-700 bg-slate-950">
        <div className="flex w-full flex-col items-start gap-6 p-6">
          <div className="inline-flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-lg bg-indigo-600">
              <img className="h-[19px] w-[19px]" src={default11} alt="" />
            </div>
            <span className="[font-family:'Inter-Regular',Helvetica] text-[23px] font-normal tracking-[-0.16px] text-slate-50">
              InfraRoute
            </span>
            <span className="[font-family:'Inter-Medium',Helvetica] text-[9px] font-medium text-slate-300">
              GIS
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-2">
            <span className="[font-family:'Inter-Medium',Helvetica] text-[9px] font-medium tracking-[0.11px] text-slate-300">
              WORKSPACE DE ENGENHARIA
            </span>
            <h2 className="[font-family:'Inter-SemiBold',Helvetica] text-sm font-semibold leading-[22px] text-slate-50">
              Expansão Campinas - Lote 1
            </h2>
            <span className="rounded-[128px] bg-slate-900 px-2.5 py-1.5 [font-family:'Inter-Medium',Helvetica] text-[11px] font-medium leading-3 text-slate-300">
              Rascunho
            </span>
          </div>
        </div>
        <div className="h-px w-full bg-slate-700" />
        <div className="flex w-full flex-1 flex-col items-start">
          <div className="w-full p-6">
            <label className="flex h-11 w-full items-center gap-3 rounded-lg border border-solid border-slate-700 bg-slate-900 px-4">
              <img className="h-[19.45px] w-[19.45px]" src={default12} alt="" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar endereço ou CEP..."
                aria-label="Buscar endereço ou CEP"
                className="min-w-0 flex-1 [font-family:'Inter-Regular',Helvetica] text-xs leading-5 text-slate-300 placeholder:text-slate-300"
              />
            </label>
          </div>
          <div className="h-px w-full bg-slate-700" />
          <section
            className="flex w-full flex-col items-start gap-3 p-6"
            aria-labelledby="layers-heading"
          >
            <div className="flex w-full items-center gap-2">
              <img className="h-4 w-4" src={default13} alt="" />
              <h3
                id="layers-heading"
                className="[font-family:'Inter-SemiBold',Helvetica] text-[13px] font-semibold text-slate-50"
              >
                Gerenciador de Camadas
              </h3>
            </div>
            <div className="flex w-full flex-col items-start">
              {layers.map((layer, index) => (
                <LayerSwitch
                  key={layer.label}
                  layer={layer}
                  enabled={layerState[index]}
                  onToggle={() => updateLayer(index)}
                />
              ))}
            </div>
            <div className="flex w-full items-start gap-[7px]">
              <img className="h-[13px] w-[13px]" src={default17} alt="" />
              <p className="flex-1 [font-family:'Inter-Regular',Helvetica] text-[10px] leading-4 text-slate-300">
                Nenhum ativo carregado. As camadas habilitadas permanecem
                vazias.
              </p>
            </div>
          </section>
          <div className="h-px w-full bg-slate-700" />
          <section
            className="flex w-full flex-col items-start gap-5 p-6"
            aria-labelledby="parameters-heading"
          >
            <div className="flex w-full items-center gap-2">
              <img className="h-4 w-4" src={default18} alt="" />
              <h3
                id="parameters-heading"
                className="[font-family:'Inter-SemiBold',Helvetica] text-[13px] font-semibold text-slate-50"
              >
                Parâmetros do algoritmo
              </h3>
            </div>
            <label className="flex w-full flex-col items-start gap-2">
              <span className="[font-family:'Inter-Regular',Helvetica] text-[11px] leading-[16.5px] text-slate-300">
                Tipo de cabo
              </span>
              <span className="relative w-full">
                <select
                  value={cableType}
                  onChange={(event) => setCableType(event.target.value)}
                  className="h-[42px] w-full rounded-lg border border-solid border-slate-700 bg-slate-900 px-3 [font-family:'Inter-Regular',Helvetica] text-xs text-slate-50"
                >
                  <option>AS-80 12 FO</option>
                  <option>AS-120 24 FO</option>
                  <option>AS-200 48 FO</option>
                </select>
                <img
                  className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5"
                  src={default23}
                  alt=""
                />
              </span>
            </label>
            <div className="flex w-full items-start gap-3">
              <label className="flex flex-1 flex-col items-start gap-2">
                <span className="[font-family:'Inter-Regular',Helvetica] text-[11px] leading-[16.5px] text-slate-300">
                  Cabo/m
                </span>
                <span className="relative w-full">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={cablePrice}
                    onChange={(event) => setCablePrice(event.target.value)}
                    className="h-[42px] w-full rounded-lg border border-solid border-slate-700 bg-slate-900 px-3 pr-7 [font-family:'Inter-Regular',Helvetica] text-xs text-slate-50"
                    aria-label="Preço do cabo por metro"
                  />
                  <span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-50">
                    R$
                  </span>
                </span>
              </label>
              <label className="flex flex-1 flex-col items-start gap-2">
                <span className="[font-family:'Inter-Regular',Helvetica] text-[11px] leading-[16.5px] text-slate-300">
                  Vão máximo
                </span>
                <span className="relative w-full">
                  <input
                    type="number"
                    min="1"
                    value={maxSpan}
                    onChange={(event) => setMaxSpan(event.target.value)}
                    className="h-[42px] w-full rounded-lg border border-solid border-slate-700 bg-slate-900 px-3 pr-10 [font-family:'Inter-Regular',Helvetica] text-xs text-slate-50"
                    aria-label="Vão máximo em metros"
                  />
                  <span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-300">
                    m
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>
        <footer className="flex w-full flex-col items-start gap-3 border-t border-solid border-slate-700 p-6">
          <div className="flex w-full items-center gap-[7px]">
            <span className="h-[5px] w-[5px] rounded-[2.5px] bg-slate-300" />
            <span className="[font-family:'Inter-Regular',Helvetica] text-[10px] leading-[15px] text-slate-300">
              Aguardando inserção de elementos
            </span>
          </div>
          <button
            type="button"
            className="h-12 w-full rounded-lg bg-indigo-600 px-6 py-3 [font-family:'Inter-SemiBold',Helvetica] text-xs font-semibold leading-6 text-white"
          >
            Calcular Malha Otimizada ⚡
          </button>
        </footer>
      </div>
    </aside>
  );
}

export const WorkspaceGis = () => {
  return (
    <main
      className="relative min-h-[900px] w-full min-w-[1440px] overflow-hidden bg-slate-950"
      data-infraroute-02-sem-nticos-mode="modo-escuro"
    >
      <MapCanvas />
      <div className="absolute top-0 left-0 h-full w-full">
        <WorkspaceHeader />
        <ToolBar />
        <MapStats />
        <MapControls />
        <p className="absolute top-[882px] left-[344px] [font-family:'Inter-Regular',Helvetica] text-[9px] font-normal text-slate-300">
          Mapa ilustrativo · Sem conexão GIS
        </p>
        <div className="absolute top-[865px] left-[1292px] inline-flex items-center gap-2">
          <span className="relative h-[5px] w-[58px] border-b border-l border-r border-solid border-[#bac6d2]" />
          <span className="[font-family:'Inter-Regular',Helvetica] text-[9px] leading-[13.5px] text-slate-300">
            100 m
          </span>
        </div>
      </div>
      <Sidebar />
    </main>
  );
};

export default WorkspaceGis;
