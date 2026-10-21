/**
 * Cálculo geodésico (Haversine - WGS 84 / SRID 4326) e Algoritmo de Prim
 * para geração da Árvore Geradora Mínima (AGM) da malha óptica.
 */

function calcularDistanciaMetros(pontoA, pontoB) {
  const R = 6371000; // Raio médio da Terra em metros
  const toRad = (graus) => (graus * Math.PI) / 180;

  const dLat = toRad(pontoB.latitude - pontoA.latitude);
  const dLng = toRad(pontoB.longitude - pontoA.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(pontoA.latitude)) *
      Math.cos(toRad(pontoB.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcularAGMPrim(pontos, idProjeto) {
  if (!Array.isArray(pontos) || pontos.length < 2) {
    return [];
  }

  const n = pontos.length;
  const visitado = new Array(n).fill(false);
  const trechos = [];

  visitado[0] = true;
  let arestasCriadas = 0;

  while (arestasCriadas < n - 1) {
    let menorDistancia = Infinity;
    let idxOrigem = -1;
    let idxDestino = -1;

    for (let i = 0; i < n; i++) {
      if (visitado[i]) {
        for (let j = 0; j < n; j++) {
          if (!visitado[j]) {
            const dist = calcularDistanciaMetros(pontos[i], pontos[j]);
            if (dist < menorDistancia && dist > 0) {
              menorDistancia = dist;
              idxOrigem = i;
              idxDestino = j;
            }
          }
        }
      }
    }

    if (idxOrigem === -1 || idxDestino === -1) {
      break;
    }

    visitado[idxDestino] = true;
    arestasCriadas++;

    const idTipoCabo = menorDistancia > 2000 ? 2 : 1;

    trechos.push(
      new window.TrechoRede({
        idTrecho: arestasCriadas,
        origem: pontos[idxOrigem],
        destino: pontos[idxDestino],
        distanciaMetros: Number(menorDistancia.toFixed(2)),
        idProjeto,
        idTipoCabo
      })
    );
  }

  return trechos;
}

window.calcularDistanciaMetros = calcularDistanciaMetros;
window.calcularAGMPrim = calcularAGMPrim;
