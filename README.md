# InfraRoute

Plataforma SaaS multi-tenant para planejamento geoespacial (OSP / FTTH), cálculo de **Árvore Geradora Mínima Constrita** (**Algoritmo de Prim** via Listas de Adjacência Bidirecionais), roteamento viário urbano (**Snap ON / OFF**) e governança corporativa de infraestrutura de fibra óptica.

---

## Principais Funcionalidades

### 1. Motor Topológico e Algoritmo de Prim (`prim_service.py`)
- **Grafo Não Direcionado Bidirecional (Seção 3.2):** Modela a malha óptica em memória por Lista de Adjacência (`Dict[int, List[Adjacencia]]`), preservando a orientação paramétrica dos vértices viários (`SRID 4326 / LINESTRING`).
- **Roteamento Viário Real em Lote (`Snap ON`):** Integração com o motor viário OpenStreetMap (`valhalla1.openstreetmap.de/route` em modo `pedestrian` com decodificação `polyline6`), encadeando até 10 waypoints por requisição HTTP para contornar esquinas e quarteirões reais sem atravessar edificações.
- **Modo Geodésico Direto (`Snap OFF`):** Cálculo instantâneo de distância geodésica esférica (**Fórmula de Haversine**) em linha reta entre ativos.
- **Métricas de Engenharia e Memoização $O(1)$ (Seção 2.5):**
  - `metragem_total` (soma dos $V - 1$ enlaces da AGM) vs `metragem_malha_candidata` (malha redundante completa).
  - `economia_percentual` gerada pela poda de ciclos redundantes.
  - `custo_estimado` combinando cabos ópticos (`Tipo_Cabo` com restrição de vão máximo `Limite_Distancia_Metros`) e ativos de rede (`Tipo_Equipamento` em 3FN).
  - Detecção automática de **Ilhas Topológicas** (`grafo_conexo: false`) quando o vão máximo configurado não alcança nós isolados (Seção 2.10).

### 2. Workspace GIS Interativo (`src/pages/Workspace/index.jsx`)
- **Ferramentas de Mapa e Atalhos Rápidos:**
  - `V` (**Selecionar**): Seleciona ativos ou polilinhas para inspeção de métricas, coordenadas e custos, ou arraste para reposicionar no mapa com recálculo automático da malha.
  - `L` (**Lasso**): Seleção múltipla por caixa retangular (clique em 2 cantos opostos no mapa).
  - `P` (**Poste**): Insere poste de apoio mecânico (`custo_equipamento = R$ 0,00`).
  - `C` (**CTO**): Insere Caixa de Terminação Óptica Furukawa (`R$ 380,00`).
  - `E` (**CEO**): Insere Caixa de Emenda Óptica Furukawa (`R$ 520,00`).
  - `O` (**OLT**): Insere Switch / OLT POP Huawei (`R$ 2.450,00`).
  - `D` (**Cabo**): Clique em dois ativos (`origem` e `destino`) para inspecionar o enlace óptico entre eles.
  - `S` (**Snap ON / OFF**): Alterna em tempo real entre o **Traçado Viário Pelas Ruas** (`Snap ON`) e o **Segmento Geodésico Direto** (`Snap OFF`).
  - `Delete` / `Backspace` (ou botão visual no cartão do ativo): Aplica **Soft Delete** (`Status_Ponto = 'Removido'`) e recalcula a AGM automaticamente.
- **Gerenciador de Camadas:** Switches em tempo real para exibir/ocultar *Postes Parceiros*, *Dutos e Cabos Ópticos* e *Caixas CTO / CEO / OLT*.
- **Busca Geoespacial Gratuita:** Geocodificação integrada via **Nominatim (OpenStreetMap)** e **ViaCEP**.

### 3. Segurança e Governança Corporativa (`security_service.py` e `governanca_service.py`)
- **Criptografia de Senhas (`bcrypt`):** Hashes salgados irreversíveis (`$2b$12$...`) com verificação em tempo constante (`hmac.compare_digest`).
- **Autenticação Stateless (`JWT HS256`) + Revogação (`jti` Denylist):** Tokens assinados com invalidação imediata no `POST /api/auth/logout`.
- **Proteção Anti-Força Bruta (Rate Limiting):** Janela deslizante em memória que bloqueia temporariamente (`HTTP 429`) após 5 tentativas falhas de login.
- **Verificação de E-mail por OTP de 6 Dígitos:** Geração de código criptográfico (`secrets.randbelow`) com validade de 15 minutos, suporte a SMTP real ou exibição em banner de desenvolvimento.
- **Isolamento Multi-Tenant, RBAC e CREA:** Validação da dependência triangular (`Empresa <-> Usuario <-> Projeto`), perfis de acesso (`Administrador`, `Projetista`, `Visualizador`) e trava de imutabilidade histórica para projetos `Concluído` ou `Cancelado` (Seção 3.3).

---

## Estrutura do Projeto

```text
infra-route/
├── backend/
│   ├── controllers/
│   │   ├── auth_controller.py         # Autenticação JWT, cadastro bcrypt, OTP 6 dígitos e auditoria
│   │   ├── projetos_controller.py     # CRUD de Projetos, Status, Pontos, Catálogos 3FN e Soft Delete
│   │   └── topologia_controller.py    # POST /api/projetos/{id_projeto}/mst (Prim + Snap Viário)
│   ├── models/
│   │   └── schemas.py                 # Contratos e validações Pydantic
│   ├── services/
│   │   ├── exceptions.py              # Exceções de domínio mapeadas para códigos HTTP
│   │   ├── governanca_service.py      # Isolamento Multi-tenant, RBAC, CREA (p, d) e Soft Delete
│   │   ├── prim_service.py            # Lista de Adjacência, Algoritmo de Prim e Roteamento Valhalla OSM
│   │   ├── security_service.py        # Criptografia bcrypt, JWT HS256, OTP, Rate Limiter e Denylist
│   │   └── workspace_store.py         # Orquestração de estado e persistência (.cache/)
│   ├── tests/
│   │   ├── test_governanca_backend.py # Testes de Multi-tenant, RBAC, CREA e Soft Delete
│   │   ├── test_prim_service.py       # Testes de robustez do Algoritmo de Prim e Google Maps
│   │   ├── test_security_auth.py      # Testes de bcrypt, JWT, Rate Limiting, Logout e OTP
│   │   └── test_workspace_fluxo_completo.py # Testes integrados do fluxo de tela e métricas
│   ├── database.py                    # Pool de conexões e transações SQLAlchemy / PostGIS
│   ├── main.py                        # Servidor FastAPI, CORS, headers OWASP e handler global
│   └── requirements.txt               # Dependências Python do backend
├── src/
│   ├── lib/
│   │   └── api.js                     # Cliente HTTP resiliente e gerenciamento de sessão JWT
│   ├── pages/
│   │   ├── Cadastro/                  # Tela de cadastro de engenheiros (/cadastro)
│   │   ├── Login/                     # Tela de autenticação corporativa (/login)
│   │   ├── Projetos/                  # Painel de gestão, status e exportação de projetos (/projetos)
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

> **Nota para Windows PowerShell:** Caso a política de execução (`ExecutionPolicy`) bloqueie o comando `npm`, utilize `npm.cmd` (ex.: `npm.cmd install`, `npm.cmd run dev`).

### 1. Executar a Suíte de Testes Automatizados (42 testes)
```powershell
python -m unittest discover -s backend/tests -v
```

### 2. Iniciar o Backend (FastAPI + Uvicorn na porta `8000`)
```powershell
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`

### 3. Iniciar o Frontend (React + Vite na porta `5173`)
Em outro terminal na raiz do projeto:
```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```
O Vite encaminha automaticamente `/api` e `/health` para `http://127.0.0.1:8000`.

### 4. Configurar a Chave do Google Maps
Copie `.env.example` para `.env.local` na raiz do projeto e informe sua chave da **Google Maps JavaScript API**:
```env
VITE_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

### 5. Credenciais de Demonstração
- **Login Rápido (1 clique na tela `/login`):** `engenheiro@empresa.com.br` / senha `123456`
- **Persistência em Desenvolvimento:** Novos cadastros, projetos criados, alterações de status e ativos desenhados no mapa são salvos automaticamente em `.cache/dev_users.json` e `.cache/dev_workspace.json`, sobrevivendo ao reinício do servidor.

---

## Principais Rotas da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autentica colaborador (`bcrypt` + Rate Limiting) e emite `access_token` JWT (`HS256`). |
| `POST` | `/api/auth/register` | Cadastra novo engenheiro (`bcrypt`), gera código OTP de 6 dígitos e retorna sessão JWT. |
| `GET` | `/api/auth/me` | Valida o token `Authorization: Bearer <token>` e retorna os dados da sessão ativa. |
| `POST` | `/api/auth/logout` | Revoga imediatamente o token JWT atual no servidor (*Token Denylist* por `jti`). |
| `POST` | `/api/auth/verificar-email` | Valida o código OTP de 6 dígitos e confirma o e-mail corporativo do engenheiro. |
| `POST` | `/api/auth/reenviar-codigo` | Gera e envia um novo código OTP de 6 dígitos para verificação de e-mail. |
| `GET` | `/api/auth/auditoria` | Lista a trilha de auditoria de segurança e governança. |
| `GET` | `/api/catalogos` | Lista os catálogos em 3FN (`Tipo_Equipamento` e `Tipo_Cabo`). |
| `GET` | `/api/projetos` | Lista os projetos da empresa ativa com `metragem_total` e `custo_estimado` memoizados. |
| `POST` | `/api/projetos` | Cria novo projeto validando Triângulo Multi-Tenant, CREA e RBAC. |
| `PATCH` | `/api/projetos/{id_projeto}/status` | Atualiza o status do projeto (`Em Planejamento`, `Em Execução`, `Concluído`, `Cancelado`). |
| `GET` | `/api/projetos/{id_projeto}` | Retorna o projeto detalhado, seus `pontos` (`Ponto_Rede`) e `trechos` (`Trecho_Rede`). |
| `POST` | `/api/projetos/{id_projeto}/pontos` | Registra um novo `Ponto_Rede` (`Poste`, `CTO`, `CEO`, `OLT`) no projeto. |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}` | Atualiza as coordenadas geográficas de um ponto do projeto. |
| `POST` | `/api/projetos/{id_projeto}/calcular-mst` | Executa o **Algoritmo de Prim** sobre os pontos armazenados do projeto. |
| `POST` | `/api/projetos/{id_projeto}/mst` | Executa o **Algoritmo de Prim** com suporte a `catalogo_cabos` dinâmico e `ajustar_malha_viaria` (`Snap ON/OFF`). |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}/soft-delete` | Inativa/remove logicamente um ponto (`Status_Ponto`), respeitando a trava `RESTRICT`. |

---

## Banco de Dados (PostgreSQL + PostGIS)
Para inicializar o banco físico PostgreSQL com a extensão PostGIS:

```powershell
psql -U postgres -d infraroute -f database/schema_postgis.sql
psql -U postgres -d infraroute -f database/seed.sql
```
Configure a variável de ambiente `DATABASE_URL` (padrão: `postgresql+psycopg2://postgres:postgres@localhost:5432/infraroute`).
