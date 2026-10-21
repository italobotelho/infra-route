# InfraRoute

Plataforma SaaS para planejamento geoespacial, cálculo de Árvore Geradora Mínima (Algoritmo de Prim) e gestão de infraestrutura de fibra óptica.

## Estrutura do Projeto

```text
infra-route/
├── assets/
│   ├── css/
│   │   ├── global.css        # Reset, variáveis (:root) e classes globais base
│   │   ├── login.css         # Estilos da tela de autenticação
│   │   └── workspace.css     # Layout do painel, mapa e tabelas
│   ├── img/
│   │   └── logo.jpg          # Logotipo da plataforma
│   └── js/
│       ├── config.example.js # Exemplo de configuração (Google Maps API Key)
│       ├── models.js         # Estrutura de modelos no cliente
│       ├── prim.js           # Estrutura para lógica de otimização
│       ├── login.js          # Lógica de autenticação
│       └── main.js           # Inicialização do workspace e mapa
├── backend/
│   ├── controllers/          # Rotas e endpoints da API (FastAPI)
│   ├── models/               # Modelos ORM (SQLAlchemy/GeoAlchemy2) e Schemas (Pydantic)
│   ├── services/             # Regras de negócio (Algoritmo de Prim, cálculos ópticos)
│   ├── database.py           # Conexão com PostgreSQL / PostGIS
│   ├── main.py               # Ponto de entrada do servidor FastAPI
│   └── requirements.txt      # Dependências Python do backend
├── database/
│   ├── schema_postgis.sql    # DDL PostgreSQL + PostGIS / pgRouting (SRID 4326)
│   └── seed.sql              # Dados iniciais para testes
├── docs/
│   ├── Documentacao_Arquitetura_de_Banco_de_Dados.pdf
│   ├── Documentacao_Modelagem_Conceitual.pdf
│   ├── Documentacao_Modelagem_Fisica.pdf
│   └── Documentacao_Modelagem_Logica.pdf
├── index.html                # Workspace principal (Topologia e Projetos)
└── login.html                # Tela de acesso corporativo
```

## Tecnologias

- **Frontend:** HTML5 Semântico, CSS3, JavaScript (ES6+), Google Maps JS API
- **Backend:** Python 3, FastAPI, Uvicorn, SQLAlchemy, GeoAlchemy2, Pydantic
- **Banco de Dados:** PostgreSQL com extensões **PostGIS** (`GEOMETRY(Point/LineString, 4326)`) e **pgRouting**
