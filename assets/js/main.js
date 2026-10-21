const latPadrao = -22.7045;
const lngPadrao = -46.9852;

let mapInstance = null;
let mapMarkers = [];
let mapPolylines = [];

const projetosMock = {
  1: new window.Projeto({
    idProjeto: 1,
    nome: "Expansão Distrito Industrial",
    status: "Em Planejamento",
    pontos: [
      new window.PontoRede({
        idPonto: 101,
        descricao: "Ponto #101 (POP Central)",
        latitude: -22.7045,
        longitude: -46.9852,
        statusFisico: "Instalado",
        idTipoEquipamento: 3
      }),
      new window.PontoRede({
        idPonto: 102,
        descricao: "Ponto #102 (Poste Concreto)",
        latitude: -22.7054,
        longitude: -46.9845,
        statusFisico: "Projetado",
        idTipoEquipamento: 1
      })
    ]
  }),
  2: new window.Projeto({
    idProjeto: 2,
    nome: "Malha Centro Histórico",
    status: "Em Execução",
    pontos: [
      new window.PontoRede({
        idPonto: 201,
        descricao: "Ponto #201 (CEO Praça Matriz)",
        latitude: -22.7012,
        longitude: -46.9910,
        statusFisico: "Instalado",
        idTipoEquipamento: 2
      }),
      new window.PontoRede({
        idPonto: 202,
        descricao: "Ponto #202 (CTO Comércio)",
        latitude: -22.7025,
        longitude: -46.9895,
        statusFisico: "Instalado",
        idTipoEquipamento: 1
      })
    ]
  })
};

let projetoAtivoId = 1;
let proximoIdPonto = 103;

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarNumero(valor) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function atualizarInterface() {
  const projeto = projetosMock[projetoAtivoId];
  if (!projeto) return;

  const elMetragem = document.getElementById("metric-metragem");
  const elCusto = document.getElementById("metric-custo");
  const elStatus = document.getElementById("metric-status");
  const tbody = document.getElementById("tabela-trechos-body");

  if (elMetragem) elMetragem.textContent = `${formatarNumero(projeto.metragemTotal)} m`;
  if (elCusto) elCusto.textContent = formatarMoeda(projeto.custoEstimado);
  if (elStatus) elStatus.textContent = projeto.status;

  if (tbody) {
    tbody.innerHTML = "";

    if (projeto.trechos.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5">Nenhum trecho calculado. Adicione ao menos 2 pontos e clique em "Gerar Traçado Óptico".</td>`;
      tbody.appendChild(tr);
    } else {
      projeto.trechos.forEach((trecho) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <th scope="row">#${trecho.idTrecho}</th>
          <td>${trecho.origem.descricao}</td>
          <td>${trecho.destino.descricao}</td>
          <td>${trecho.modeloCabo}</td>
          <td>${formatarNumero(trecho.distanciaMetros)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  renderizarMapa(projeto);
}

function renderizarMapa(projeto) {
  const mapContainer = document.getElementById("map-canvas");
  if (!mapContainer) return;

  if (mapInstance && window.google?.maps) {
    mapMarkers.forEach((m) => m.setMap(null));
    mapPolylines.forEach((l) => l.setMap(null));
    mapMarkers = [];
    mapPolylines = [];

    projeto.pontos.forEach((ponto) => {
      const marker = new google.maps.Marker({
        position: { lat: ponto.latitude, lng: ponto.longitude },
        map: mapInstance,
        title: `${ponto.descricao} (${ponto.statusFisico})`
      });
      mapMarkers.push(marker);
    });

    projeto.trechos.forEach((trecho) => {
      const line = new google.maps.Polyline({
        path: [
          { lat: trecho.origem.latitude, lng: trecho.origem.longitude },
          { lat: trecho.destino.latitude, lng: trecho.destino.longitude }
        ],
        geodesic: true,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map: mapInstance
      });
      mapPolylines.push(line);
    });
  } else {
    mapContainer.innerHTML = `
      <div class="map-placeholder">
        <p><strong>${projeto.nome}</strong> — ${projeto.pontos.length} nó(s) ativo(s) e ${projeto.trechos.length} trecho(s) conectado(s) (SRID 4326).</p>
      </div>
    `;
  }
}

function initMap() {
  const mapContainer = document.getElementById("map-canvas");
  if (!mapContainer || !window.google?.maps) return;

  mapInstance = new google.maps.Map(mapContainer, {
    center: { lat: latPadrao, lng: lngPadrao },
    zoom: 15
  });

  atualizarInterface();
}

window.initMap = initMap;

function carregarGoogleMapsSeConfigurado() {
  const apiKey = window.INFRAROUTE_CONFIG?.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return;

  const googleMapsScript = document.createElement("script");
  googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initMap`;
  googleMapsScript.async = true;
  document.head.appendChild(googleMapsScript);
}

document.addEventListener("DOMContentLoaded", () => {
  Object.values(projetosMock).forEach((proj) => {
    proj.trechos = window.calcularAGMPrim(proj.pontos, proj.idProjeto);
  });

  const selectProjeto = document.getElementById("select-projeto");
  const formPonto = document.getElementById("form-ponto-rede");
  const btnCalcularAGM = document.getElementById("btn-calcular-agm");

  if (selectProjeto) {
    selectProjeto.addEventListener("change", (e) => {
      projetoAtivoId = Number(e.target.value);
      atualizarInterface();
    });
  }

  if (formPonto) {
    formPonto.addEventListener("submit", (e) => {
      e.preventDefault();
      const projeto = projetosMock[projetoAtivoId];
      if (!projeto) return;

      const descricao = document.getElementById("desc-ponto").value.trim();
      const latitude = parseFloat(document.getElementById("coord-lat").value);
      const longitude = parseFloat(document.getElementById("coord-lng").value);
      const idTipoEquipamento = document.getElementById("tipo-equipamento").value;
      const statusFisico = document.getElementById("status-fisico").value;

      const novoPonto = new window.PontoRede({
        idPonto: proximoIdPonto++,
        descricao,
        latitude,
        longitude,
        statusFisico,
        idTipoEquipamento: idTipoEquipamento || null
      });

      projeto.pontos.push(novoPonto);
      formPonto.reset();
      atualizarInterface();
    });
  }

  if (btnCalcularAGM) {
    btnCalcularAGM.addEventListener("click", () => {
      const projeto = projetosMock[projetoAtivoId];
      if (!projeto) return;

      projeto.trechos = window.calcularAGMPrim(projeto.pontos, projeto.idProjeto);
      atualizarInterface();
    });
  }

  atualizarInterface();
  carregarGoogleMapsSeConfigurado();
});
