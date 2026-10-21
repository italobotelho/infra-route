/**
 * Modelos de domínio do InfraRoute alinhados ao schema PostGIS (SRID 4326).
 */

const CATALOGO_EQUIPAMENTOS = {
  1: { id: 1, descricao: "CTO Furukawa 16 Portas", categoria: "CTO", fabricante: "Furukawa", custoUnitario: 380.0 },
  2: { id: 2, descricao: "Caixa de Emenda Óptica (CEO)", categoria: "Caixa de Emenda", fabricante: "Furukawa", custoUnitario: 520.0 },
  3: { id: 3, descricao: "Switch Industrial Huawei", categoria: "Switch", fabricante: "Huawei", custoUnitario: 2450.0 }
};

const CATALOGO_CABOS = {
  1: { id: 1, descricaoModelo: "Fibra AS-80 12FO", custoPorMetro: 4.5, limiteDistanciaMetros: 2000.0 },
  2: { id: 2, descricaoModelo: "Fibra AS-120 24FO", custoPorMetro: 6.8, limiteDistanciaMetros: 5000.0 }
};

class PontoRede {
  constructor({ idPonto, descricao, latitude, longitude, statusFisico = "Projetado", idTipoEquipamento = null }) {
    this.idPonto = idPonto;
    this.descricao = descricao;
    this.latitude = Number(latitude);
    this.longitude = Number(longitude);
    this.statusFisico = statusFisico;
    this.idTipoEquipamento = idTipoEquipamento ? Number(idTipoEquipamento) : null;
  }

  get custoEquipamento() {
    if (!this.idTipoEquipamento || !CATALOGO_EQUIPAMENTOS[this.idTipoEquipamento]) {
      return 0;
    }
    return CATALOGO_EQUIPAMENTOS[this.idTipoEquipamento].custoUnitario;
  }
}

class TrechoRede {
  constructor({ idTrecho, origem, destino, distanciaMetros, idProjeto, idTipoCabo = 1 }) {
    this.idTrecho = idTrecho;
    this.origem = origem;
    this.destino = destino;
    this.distanciaMetros = Number(distanciaMetros);
    this.idProjeto = idProjeto;
    this.idTipoCabo = idTipoCabo;
  }

  get modeloCabo() {
    return CATALOGO_CABOS[this.idTipoCabo]?.descricaoModelo || "Fibra AS-80 12FO";
  }

  get custoTrecho() {
    const custoMetro = CATALOGO_CABOS[this.idTipoCabo]?.custoPorMetro || 4.5;
    return this.distanciaMetros * custoMetro;
  }
}

class Projeto {
  constructor({ idProjeto, nome, status = "Em Planejamento", pontos = [], trechos = [] }) {
    this.idProjeto = idProjeto;
    this.nome = nome;
    this.status = status;
    this.pontos = pontos;
    this.trechos = trechos;
  }

  get metragemTotal() {
    return this.trechos.reduce((acc, t) => acc + t.distanciaMetros, 0);
  }

  get custoEstimado() {
    const custoCabos = this.trechos.reduce((acc, t) => acc + t.custoTrecho, 0);
    const custoEquipamentos = this.pontos.reduce((acc, p) => acc + p.custoEquipamento, 0);
    return custoCabos + custoEquipamentos;
  }
}

window.CATALOGO_EQUIPAMENTOS = CATALOGO_EQUIPAMENTOS;
window.CATALOGO_CABOS = CATALOGO_CABOS;
window.PontoRede = PontoRede;
window.TrechoRede = TrechoRede;
window.Projeto = Projeto;
