# InfraRoute

Plataforma SaaS multi-tenant para planejamento geoespacial, cálculo de Árvore Geradora Mínima Constrita (Algoritmo de Prim via Listas de Adjacência) e gestão de infraestrutura de fibra óptica.

---

## Estrutura do Projeto

```text
infra-route/
├── assets/
│   ├── css/
│   │   ├── global.css                 # Reset, variáveis (:root) e classes globais base
│   │   ├── login.css                  # Estilos da tela de autenticação
│   │   └── workspace.css              # Layout do painel, mapa e tabelas
│   ├── img/
│   │   └── logo.jpg                   # Logotipo da plataforma
│   └── js/
│       ├── config.example.js          # Template para configuração da chave Google Maps API
│       ├── models.js                  # Estrutura de modelos no cliente
│       ├── prim.js                    # Estrutura de integração de otimização
│       ├── login.js                   # Lógica de autenticação (login.html)
│       └── main.js                    # Inicialização do workspace e Google Maps (index.html)
├── backend/
│   ├── controllers/
│   │   ├── auth_controller.py         # POST /api/auth/login
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
├── database/
│   ├── schema_postgis.sql             # DDL PostgreSQL + PostGIS / pgRouting (SRID 4326)
│   └── seed.sql                       # Dados iniciais para testes
├── docs/
│   ├── Documentacao_Arquitetura_de_Banco_de_Dados.pdf
│   ├── Documentacao_Modelagem_Conceitual.pdf
│   ├── Documentacao_Modelagem_Fisica.pdf
│   └── Documentacao_Modelagem_Logica.pdf
├── index.html                         # Workspace principal (Topologia e Projetos)
└── login.html                         # Tela de acesso corporativo
```

---

## Como Executar o Projeto

### 1. Executar a Suíte de Testes do Backend (Sem Dependências Externas)
Os serviços de domínio (`prim_service.py`, `governanca_service.py` e `workspace_store.py`) foram desacoplados em Python puro e podem ser validados imediatamente:

```powershell
python -m unittest discover -s backend/tests -v
```

### 2. Iniciar o Servidor da API (FastAPI + Uvicorn)
Na raiz do repositório (`infra-route/`), crie e ative o ambiente virtual Python e instale as dependências:

```powershell
# 1. Criar e ativar o ambiente virtual
python -m venv .venv
.\.venv\Scripts\activate

# 2. Instalar dependências
pip install -r backend/requirements.txt

# 3. Subir o servidor FastAPI na porta 8000
uvicorn backend.main:app --reload --port 8000
```

Com o servidor rodando, acesse a documentação interativa (Swagger UI) para testar todas as rotas:
- **Swagger UI:** `http://localhost:8000/docs`
- **Health Check:** `http://localhost:8000/health`

### 3. Principais Rotas da API para Integração com o Frontend

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autentica colaborador (`engenheiro@empresa.com.br` / `123456`) e retorna perfil, CREA e `nivel_acesso`. |
| `GET` | `/api/catalogos` | Lista os catálogos em 3FN (`Tipo_Equipamento` e `Tipo_Cabo`). |
| `GET` | `/api/projetos` | Lista os projetos da empresa ativa com `metragem_total` e `custo_estimado` memoizados ($O(1)$). |
| `POST` | `/api/projetos` | Cria novo projeto validando Triângulo Multi-Tenant, CREA e RBAC. |
| `GET` | `/api/projetos/{id_projeto}` | Retorna o projeto, seus `pontos` (`Ponto_Rede`) e `trechos` (`Trecho_Rede`). |
| `POST` | `/api/projetos/{id_projeto}/pontos` | Registra um novo `Ponto_Rede` (poste/caixa) no projeto. |
| `POST` | `/api/projetos/{id_projeto}/calcular-mst` | Executa o **Algoritmo de Prim** sobre os pontos armazenados do projeto e atualiza a memoização. |
| `POST` | `/api/projetos/{id_projeto}/mst` | Executa o **Algoritmo de Prim** diretamente a partir de um payload de coordenadas/polilinhas do Google Maps. |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}/soft-delete` | Inativa/remove logicamente um ponto (`Status_Ponto`), respeitando a trava `RESTRICT`. |

### 4. Executar o Frontend (`login.html` e `index.html`)
1. (Opcional) Copie `assets/js/config.example.js` para `assets/js/config.js` e preencha `GOOGLE_MAPS_API_KEY`.
2. Sirva os arquivos estáticos em outro terminal (ex.: porta `8080`):
   ```powershell
   python -m http.server 8080
   ```
3. Acesse `http://localhost:8080/login.html` ou `http://localhost:8080/index.html`.

### 5. Banco de Dados (PostgreSQL + PostGIS)
Para inicializar o banco físico PostgreSQL com a extensão PostGIS:
```powershell
psql -U postgres -d infraroute -f database/schema_postgis.sql
psql -U postgres -d infraroute -f database/seed.sql
```
Configure a variável de ambiente `DATABASE_URL` (padrão: `postgresql+psycopg2://postgres:postgres@localhost:5432/infraroute`).
