# InfraRoute

Plataforma SaaS multi-tenant para planejamento geoespacial, cálculo de Árvore Geradora Mínima Constrita (Algoritmo de Prim via Listas de Adjacência) e gestão de infraestrutura de fibra óptica.

---

## Estrutura do Projeto

```text
infra-route/
├── backend/
│   ├── controllers/
│   │   ├── auth_controller.py         # POST /api/auth/login e POST /api/auth/register
│   │   ├── projetos_controller.py     # CRUD de Projetos, Pontos, Catálogos 3FN e Soft Delete
│   │   └── topologia_controller.py    # POST /api/projetos/{id_projeto}/mst
│   ├── models/
│   │   └── schemas.py                 # Contratos e validações Pydantic
│   ├── services/
│   │   ├── exceptions.py              # Exceções de domínio mapeadas para códigos HTTP
│   │   ├── governanca_service.py      # Isolamento Multi-tenant, RBAC, CREA (p, d) e Soft Delete
│   │   ├── prim_service.py            # Lista de Adjacência Bidirecional e Algoritmo de Prim
│   │   └── workspace_store.py         # Orquestração de estado e persistência
│   ├── tests/
│   │   ├── test_governanca_backend.py # Testes de Multi-tenant, RBAC, CREA e Soft Delete
│   │   ├── test_prim_service.py       # Testes de robustez do Algoritmo de Prim e Google Maps
│   │   └── test_workspace_fluxo_completo.py # Testes integrados do fluxo de tela
│   ├── database.py                    # Pool de conexões e transações SQLAlchemy / PostGIS
│   ├── main.py                        # Servidor FastAPI, CORS e handler global de erros
│   └── requirements.txt               # Dependências Python do backend
├── src/
│   ├── lib/
│   │   └── api.js                     # Cliente HTTP e gerenciamento de sessão
│   ├── pages/
│   │   ├── Cadastro/                  # Tela de cadastro de engenheiros (/cadastro)
│   │   ├── Login/                     # Tela de autenticação corporativa (/login)
│   │   ├── Projetos/                  # Painel de gestão de projetos (/projetos)
│   │   └── Workspace/                 # Workspace GIS com Google Maps e AGM/Prim (/workspace)
│   ├── App.jsx                        # Roteamento React Router e proteção de rotas
│   ├── index.css                      # Estilos globais e Tailwind CSS
│   └── main.jsx                       # Ponto de entrada React
├── database/
│   ├── schema_postgis.sql             # DDL PostgreSQL + PostGIS / pgRouting (SRID 4326)
│   └── seed.sql                       # Dados iniciais para testes
├── docs/
│   ├── Documentacao_Arquitetura_de_Banco_de_Dados.pdf
│   ├── Documentacao_Modelagem_Conceitual.pdf
│   ├── Documentacao_Modelagem_Fisica.pdf
│   └── Documentacao_Modelagem_Logica.pdf
├── index.html                         # Template HTML principal (Vite)
├── package.json                       # Scripts e dependências do frontend (React + Vite)
├── tailwind.config.js                 # Configuração do Tailwind CSS
└── vite.config.js                     # Configuração do Vite e proxy para a API (/api -> :8000)
```

---

## Como Executar o Projeto Localmente

Requisitos: **Node.js 20.19+** (ou **22.12+**) e **Python 3.10+**.

### 1. Executar a Suíte de Testes do Backend
Os serviços de domínio (`prim_service.py`, `governanca_service.py` e `workspace_store.py`) são desacoplados em Python puro e podem ser validados imediatamente:

```powershell
python -m unittest discover -s backend/tests -v
```

### 2. Iniciar o Backend (FastAPI + Uvicorn)
Na raiz do repositório (`infra-route/`), crie/ative um ambiente virtual Python, instale as dependências e inicie o servidor:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
npm run dev:backend
```

A API fica disponível em `http://127.0.0.1:8000`:
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`

### 3. Iniciar o Frontend (React + Vite)
Em outro terminal na raiz do projeto:

```powershell
npm install
npm run dev
```

O Vite encaminha automaticamente `/api` e `/health` para `http://127.0.0.1:8000`.

### 4. Configurar a Chave do Google Maps
Copie `.env.example` para `.env.local` na raiz do projeto e informe sua chave da **Google Maps JavaScript API**:

```env
VITE_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

Reinicie o Vite após alterar o arquivo `.env.local`.

### 5. Rotas e Credenciais de Demonstração
- **Rotas do Frontend:** `/cadastro` · `/login` · `/projetos` · `/workspace?id_projeto=<id>`
- **Conta Seed para Login:** `engenheiro@empresa.com.br` / senha `123456`
- Novos cadastros realizados em `/cadastro` são automaticamente vinculados à empresa de demonstração com perfil `Projetista`.

---

## Principais Rotas da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autentica colaborador e retorna perfil, CREA e `nivel_acesso`. |
| `POST` | `/api/auth/register` | Cadastra novo engenheiro e vincula à empresa de demonstração. |
| `GET` | `/api/catalogos` | Lista os catálogos em 3FN (`Tipo_Equipamento` e `Tipo_Cabo`). |
| `GET` | `/api/projetos` | Lista os projetos da empresa ativa com `metragem_total` e `custo_estimado` memoizados. |
| `POST` | `/api/projetos` | Cria novo projeto validando Triângulo Multi-Tenant, CREA e RBAC. |
| `GET` | `/api/projetos/{id_projeto}` | Retorna o projeto, seus `pontos` (`Ponto_Rede`) e `trechos` (`Trecho_Rede`). |
| `POST` | `/api/projetos/{id_projeto}/pontos` | Registra um novo `Ponto_Rede` (poste/caixa) no projeto. |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}` | Atualiza as coordenadas geográficas de um ponto do projeto. |
| `POST` | `/api/projetos/{id_projeto}/calcular-mst` | Executa o **Algoritmo de Prim** sobre os pontos armazenados do projeto. |
| `POST` | `/api/projetos/{id_projeto}/mst` | Executa o **Algoritmo de Prim** (sobre os pontos do projeto ou payload customizado). |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}/soft-delete` | Inativa/remove logicamente um ponto (`Status_Ponto`), respeitando a trava `RESTRICT`. |

---

## Banco de Dados (PostgreSQL + PostGIS)
Para inicializar o banco físico PostgreSQL com a extensão PostGIS:

```powershell
psql -U postgres -d infraroute -f database/schema_postgis.sql
psql -U postgres -d infraroute -f database/seed.sql
```
Configure a variável de ambiente `DATABASE_URL` (padrão: `postgresql+psycopg2://postgres:postgres@localhost:5432/infraroute`).
