# InfraRoute — Plataforma SaaS de Engenharia de Redes Ópticas (OSP / FTTH)

![Status do Projeto](https://img.shields.io/badge/Status-Em%20Desenvolvimento%20Ativo%20(MVP%20Funcional)-2563eb)
![Testes Automatizados](https://img.shields.io/badge/Testes%20Backend-42%20Passando-16a34a)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-slate)

Plataforma SaaS *multi-tenant* para planejamento geoespacial (**OSP** / **FTTH**), cálculo de **Árvore Geradora Mínima Constrita** (**Algoritmo de Prim** via Listas de Adjacência Bidirecionais), roteamento viário urbano (**Snap ON / OFF**) e governança corporativa de infraestrutura de fibra óptica.

---

## 1. Concepção do Projeto, Impacto Social e ODS (Aula 01)

### 1.1 Problema Real e Público-Alvo
Provedores regionais de internet (**ISPs**) e escritórios de engenharia de telecomunicações frequentemente planejam expansões de fibra óptica (**Planta Externa / OSP**) em planilhas desconectadas e arquivos CAD estáticos. Isso provoca:
- Superdimensionamento de cabos ópticos (15% a 30% de desperdício de metragem por ciclos redundantes);
- Erros de orçamento (**CAPEX**) por falta de integração entre o catálogo de cabos/equipamentos e as distâncias reais de arruamento;
- Ausência de governança técnica (rastreabilidade de engenheiros responsáveis com registro **CREA**, controle de versões e isolamento entre empresas).

**Público-Alvo:**
- Engenheiros de Telecomunicações e Projetistas **OSP/FTTH**;
- Coordenadores de Implantação de Redes e Gestores de **CAPEX** em provedores de internet (**ISPs**) e operadoras neutras.

### 1.2 Setores da Sociedade Atendidos
- **2º Setor (Privado — Foco Principal):** Operadoras de telecomunicações, provedores regionais (**ISPs**) e empresas de engenharia de redes que buscam eficiência operacional e redução de custos de implantação.
- **1º Setor (Público / Regulatório — Interface Direta):** Conformidade com normas de compartilhamento de infraestrutura urbana (postes de concessionárias de energia elétrica) e rastreabilidade de responsabilidade técnica (**CREA/CONFEA**).

### 1.3 Objetivos de Desenvolvimento Sustentável (ODS da ONU)
| ODS | Meta Relacionada | Contribuição Direta do InfraRoute |
| :--- | :--- | :--- |
| **ODS 8 — Trabalho Decente e Crescimento Econômico** | Meta 8.2 (Produtividade tecnológica) | Automatiza cálculos topológicos complexos, elevando a produtividade de equipes de engenharia. |
| **ODS 9 — Indústria, Inovação e Infraestrutura** | Meta 9.c (Acesso universal às TICs e internet) | Viabiliza financeiramente a expansão de redes de fibra óptica para bairros periféricos e municípios do interior. |
| **ODS 11 — Cidades e Comunidades Sustentáveis** | Meta 11.3 (Urbanização inclusiva e sustentável) | Reduz a poluição visual e a ocupação desordenada de postes urbanos por meio de malhas otimizadas. |
| **ODS 12 — Consumo e Produção Responsáveis** | Meta 12.2 (Uso eficiente de recursos naturais) | Elimina o desperdício de polímeros, sílica e materiais metálicos ao podar enlaces redundantes via **Algoritmo de Prim**. |

### 1.4 Valor Gerado e Checklist de Validação da Ideia
- [x] **Resolve uma dor real?** Sim — reduz em até 25% o custo de cabos ópticos e o tempo de elaboração de projetos executivos.
- [x] **Possui público-alvo bem definido?** Sim — engenheiros projetistas (**CREA**) e gestores de **ISPs**.
- [x] **É tecnicamente viável na Web?** Sim — SPA em React integrada a mapas interativos, geocodificação pública e API FastAPI.
- [x] **Gera impacto positivo mensurável?** Sim — exibe em tempo real a `% de economia de material (AGM Prim)` e o custo total acumulado da obra.
- [x] **Possui diferencial claro?** Sim — combina cálculo de **AGM (Prim)** com ajuste automático à malha viária real (**Snap ON** via OpenStreetMap/Valhalla) e governança multi-tenant.

---

## 2. Ciclo de Vida do Software e Metodologia Ágil (Aula 02)

### 2.1 Etapas do Ciclo de Vida (SDLC)
1. **Levantamento de Requisitos:** Especificação das regras de negócio de engenharia óptica, restrições de vão máximo por modelo de cabo (`AS-80`, `AS-120`, `AS-200`) e governança multi-tenant (documentados em `/docs`).
2. **Análise e Design:** Modelagem Conceitual, Lógica e Física em **3ª Forma Normal (3FN)** com extensão geoespacial **PostGIS** (`SRID 4326`) e prototipação **UI/UX** de alta fidelidade.
3. **Implementação:** Desenvolvimento desacoplado em camadas (Frontend React/Vite + Backend Python FastAPI).
4. **Testes e Verificação:** Suíte automatizada com **42 testes unitários e de integração** (`backend/tests/`) cobrindo segurança, governança, algoritmo de Prim e fluxo completo do workspace.
5. **Implantação e Evolução Contínua:** Build otimizado de produção (`vite build`) e migrações SQL versionadas (`database/`).

### 2.2 Metodologia Ágil Adotada: Scrumban (Scrum + Kanban)
O desenvolvimento utiliza **Scrumban**, combinando ciclos iterativos de entrega (*Sprints* de 2 semanas com *Sprint Planning*, *Review* e *Retrospective*) e fluxo visual contínuo em quadro **Kanban**:
- **Colunas do Fluxo Kanban:** `Backlog do Produto` → `Selecionado para Sprint` → `Em Progresso (WIP Limit: 3)` → `Em Revisão / Testes Automatizados` → `Concluído (Done)`.

---

## 3. UI/UX, Psicologia Cognitiva e Heurísticas de Nielsen (Aula 03)

### 3.1 Persona Primária
> **Eng. Carlos Eduardo Mendes (34 anos) — Engenheiro Sênior de Projetos OSP/FTTH**
> - **Contexto:** Atua em um provedor regional em expansão no interior de São Paulo; gerencia simultaneamente 8 a 12 projetos de implantação.
> - **Dores:** Perde horas recalculando metragens manualmente quando um poste muda de lugar; sofre com planilhas desatualizadas entre campo e escritório.
> - **Objetivos:** Posicionar ativos rapidamente no mapa, validar se o vão máximo do cabo é respeitado, obter o orçamento exato em segundos e exportar o memorial descritivo.

### 3.2 Jornada do Usuário
1. **Autenticação (`/login` ou `/cadastro`):** Acesso corporativo com validação instantânea de campos, preenchimento de demonstração em 1 clique e rascunho automático não sensível.
2. **Verificação de Identidade (OTP):** Confirmação opcional de e-mail por código de 6 dígitos sem bloquear a navegação inicial.
3. **Gestão de Portfólio (`/projetos`):** Visualização tabular semântica de projetos da empresa, busca instantânea, paginação, ordenação alfabética e totalizadores financeiros no rodapé da tabela.
4. **Planejamento Espacial (`/workspace`):** Busca de endereço/CEP (ViaCEP + Nominatim), inserção de Postes (`P`), CTOs (`C`), CEOs (`E`) e OLTs (`O`) no mapa escuro de alto contraste.
5. **Otimização Topológica (`Calcular Malha Otimizada`):** Execução do **Algoritmo de Prim** com opção de ajuste viário (**Snap ON**) e alerta automático de ilhas topológicas.
6. **Governança e Exportação:** Mudança controlada de status (`Em Planejamento` → `Em Execução` → `Concluído`) e exportação do Memorial Descritivo em JSON.

### 3.3 Leis da Psicologia Cognitiva Aplicadas
- **Lei de Fitts:** Botões de ação primária (`Entrar na Plataforma`, `Enviar Cadastro`, `Calcular Malha Otimizada`) possuem altura mínima de `48px` (`min-h-12`) e largura total na barra lateral, reduzindo o tempo de aquisição do alvo.
- **Lei de Hick:** A barra de ferramentas flutuante do GIS limita-se às **7 ferramentas essenciais** separadas por divisores visuais e associadas a teclas de atalho de 1 letra (`V`, `L`, `P`, `C`, `E`, `O`, `D`, `S`).
- **Leis da Gestalt (Proximidade, Similaridade e Região Comum):** Agrupamento semântico de campos com `<fieldset>` e `<legend>`, cartões delimitados por bordas sutis e código de cores consistente para ativos (`Poste` em índigo, `CTO` em verde-esmeralda, `CEO` em âmbar, `OLT` em magenta).

### 3.4 As 7 Heurísticas de Usabilidade de Nielsen no InfraRoute
1. **Visibilidade do Status do Sistema:** Indicadores em tempo real (`Carregando projetos...`, `Calculando...`, `Buscando…`, badge `Traçado Viário (Snap ON)` e contador de ativos/trechos no rodapé da barra lateral).
2. **Correspondência entre o Sistema e o Mundo Real:** Uso do vocabulário técnico autêntico da engenharia de telecomunicações (`OSP`, `FTTH`, `CTO`, `CEO`, `OLT`, `Vão máximo`, `AS-80 12 FO`, `CREA`) com tags `<abbr title="...">` explicativas.
3. **Controle e Liberdade do Usuário:** Suporte à tecla `<kbd>Esc</kbd>` para cancelar ferramentas ou seleções a qualquer momento, botão `Limpar` no cadastro, *Soft Delete* de ativos e alternância livre entre `Snap ON` e `Snap OFF`.
4. **Consistência e Padrões:** Paleta semântica padronizada via Design Tokens CSS (`--cor-primaria`, `--cor-escuro`, `--cor-perigo`), tipografia `Inter` e componentes de erro reutilizáveis (`<CampoErro />`).
5. **Prevenção de Erros:** Validação em tempo real de CPF (dígitos verificadores), telefone, CREA e força de senha; desabilitação de botões durante submissões (`disabled={isSubmitting}`); trava de imutabilidade em projetos `Concluído` ou `Cancelado`.
6. **Reconhecimento em vez de Memorização:** Dica contextual dinâmica (`ToolHint`) abaixo da barra de ferramentas explicando exatamente como usar a ferramenta ativa e seus atalhos (`<kbd>`).
7. **Flexibilidade e Eficiência de Uso:** Atalhos de teclado completos no mapa GIS (`V`, `L`, `P`, `C`, `E`, `O`, `D`, `S`, `Esc`, `Del`) para usuários avançados e botão de preenchimento rápido de credenciais de demonstração na tela de login.

---

## 4. Arquitetura de Software e ADRs (Aula 04)

### 4.1 Arquitetura em Camadas (`UI ≠ Lógica ≠ Dados`)
O projeto separa estritamente a interface gráfica, as regras de negócio/serviços e a camada de persistência tanto no **Frontend** quanto no **Backend**:

```text
+-------------------------------------------------------------------------+
| CAMADA DE APRESENTAÇÃO (UI — React 18 + Tailwind CSS + HTML5 Semântico) |
| - src/pages/ (Login, Cadastro, Projetos, Workspace)                     |
| - src/components/ (CampoErro) | src/styles/ (tokens.css)                |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| CAMADA DE SERVIÇOS E LÓGICA DE CLIENTE (Frontend Services & Utils)      |
| - src/api/client.js (Cliente HTTP + Injeção Bearer JWT + Tratamento 401)|
| - src/services/geocodingService.js (Fila Nominatim OSM 1 req/s + ViaCEP)|
| - src/utils/validators.js (Regras puras de CPF, CREA, Telefone e Senha) |
| - src/utils/storage.js (Web Storage seguro com namespace e filtro LGPD) |
+------------------------------------+------------------------------------+
                                     | REST JSON (/api/*)
                                     v
+-------------------------------------------------------------------------+
| CAMADA DE CONTROLE E DOMÍNIO (Backend FastAPI Controllers & Services)   |
| - backend/controllers/ (auth, projetos, topologia)                      |
| - backend/services/prim_service.py (Grafo + Algoritmo de Prim + Valhalla|
| - backend/services/governanca_service.py (Multi-Tenant + RBAC + CREA)   |
| - backend/services/security_service.py (bcrypt + JWT HS256 + Rate Limit)|
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| CAMADA DE PERSISTÊNCIA E DADOS (PostgreSQL/PostGIS + Cache JSON Dev)    |
| - backend/database.py & backend/services/workspace_store.py             |
| - database/schema_postgis.sql (DDL 3FN + SRID 4326) & database/seed.sql |
+-------------------------------------------------------------------------+
```

### 4.2 Registro de Decisões de Arquitetura (ADRs)

#### ADR-001: Adoção de React 18 + Vite + Design Tokens CSS no Frontend
- **Data:** 2026-03-10 | **Status:** Aceito
- **Contexto:** O sistema exige uma interface reativa de baixa latência para manipular dezenas de marcadores e polilinhas sobre o Google Maps sem recarregar a página, mantendo conformidade com HTML5 semântico e acessibilidade.
- **Alternativas Consideradas:** (1) MPA tradicional renderizada no servidor (Jinja2/Django); (2) SPA com React 18 + Vite + Tailwind CSS + variáveis CSS nativas (`:root`).
- **Decisão:** Adotar React 18 + Vite com separação modular em `/src` (`api`, `components`, `pages`, `services`, `styles`, `utils`).
- **Consequências:** Positivas: Hot Module Replacement instantâneo, estado reativo fluido no mapa GIS e reutilização de componentes. Negativas: Necessidade de gerenciar títulos dinâmicos (`document.title`) e rotas protegidas no cliente.

#### ADR-002: Algoritmo de Prim sobre Grafo Bidirecional com Snap Viário em Lote
- **Data:** 2026-03-24 | **Status:** Aceito
- **Contexto:** Conectar todos os ativos ópticos com o menor custo de cabo possível configura o problema clássico da **Árvore Geradora Mínima (AGM)**, sujeito à restrição física de vão máximo de cada modelo de cabo e ao traçado real das ruas urbanas.
- **Alternativas Consideradas:** (1) Algoritmo de Kruskal sem restrição viária; (2) Algoritmo de Prim sobre Lista de Adjacência Bidirecional com distância geodésica de Haversine (`Snap OFF`) ou roteamento viário OpenStreetMap/Valhalla em lote (`Snap ON`).
- **Decisão:** Implementar o **Algoritmo de Prim** em `backend/services/prim_service.py` operando sobre listas de adjacência bidirecionais e consultando o motor Valhalla em lote para contornar quarteirões.
- **Consequências:** Positivas: Complexidade ótima para grafos conexos, detecção explícita de ilhas topológicas (`grafo_conexo: false`) e cálculo preciso de economia percentual de material. Negativas: Latência adicional de rede (~300–800 ms) quando o roteamento viário externo (`Snap ON`) não está em cache.

#### ADR-003: Autenticação Stateless com JWT (HS256), Senhas Salgadas (`bcrypt`) e Token Denylist
- **Data:** 2026-04-02 | **Status:** Aceito
- **Contexto:** A API RESTful precisa autenticar engenheiros de múltiplas empresas (*multi-tenant*), proteger credenciais contra vazamentos e ataques de força bruta, e permitir revogação imediata no logout.
- **Alternativas Consideradas:** (1) Sessões stateful em memória no servidor; (2) Tokens JWT assinados com `HMAC-SHA256` (`jti`, `sub`, `exp`, `iat`), hash `bcrypt` (12 rounds com fallback `PBKDF2-HMAC-SHA256`), *Rate Limiting* por janela deslizante e *Denylist* para revogação.
- **Decisão:** Adotar JWT `HS256` + `bcrypt` + *Rate Limiting* (máximo de 5 falhas por janela) em `backend/services/security_service.py`, aliado a higienização de dados sensíveis no `localStorage` (`src/utils/storage.js`).
- **Consequências:** Positivas: Escalabilidade stateless, verificação de expiração do payload JWT diretamente no cliente (`isJwtExpired`) e proteção contra força bruta. Negativas: Necessidade de manter a *Denylist* sincronizada em caso de múltiplos workers.

#### ADR-004: Modelagem Relacional em 3FN com Soft Delete e Imutabilidade Histórica
- **Data:** 2026-04-15 | **Status:** Aceito
- **Contexto:** Projetos de engenharia concluídos possuem valor legal/regulatório e não podem sofrer alterações acidentais de traçado ou exclusão física de ativos que quebrem o histórico de auditoria.
- **Alternativas Consideradas:** (1) Exclusão física (`DELETE CASCADE`) de pontos e projetos; (2) Modelagem em **3ª Forma Normal (3FN)** com *Soft Delete* (`Status_Ponto = 'Removido'`) e trava de estado para projetos `Concluído`/`Cancelado`.
- **Decisão:** Implementar validação estrita em `backend/services/governanca_service.py` impedindo mutações em projetos finalizados e aplicando *Soft Delete* lógico nos pontos de rede.
- **Consequências:** Positivas: Rastreabilidade completa de auditoria e preservação da integridade referencial. Negativas: Consultas de listagem de pontos ativos devem filtrar `status_ponto == 'Ativo'`.

---

## 5. Estrutura do Repositório e Governança Git (Aula 05)

### 5.1 Estrutura de Pastas Padronizada

```text
infra-route/
├── backend/                           # API Backend em Python (FastAPI)
│   ├── controllers/                   # Controladores REST (auth, projetos, topologia)
│   ├── models/                        # Contratos e validações Pydantic (schemas.py)
│   ├── services/                      # Regras de negócio (prim, governanca, security, store)
│   ├── tests/                         # Suíte com 42 testes automatizados (unittest)
│   ├── database.py                    # Conexão SQLAlchemy / PostGIS
│   ├── main.py                        # Ponto de entrada FastAPI + middlewares OWASP
│   └── requirements.txt               # Dependências Python
├── database/                          # Scripts de Banco de Dados Relacional / Geoespacial
│   ├── schema_postgis.sql             # DDL PostgreSQL + PostGIS (3FN, SRID 4326)
│   └── seed.sql                       # Carga inicial de catálogos, empresas e projetos
├── docs/                              # Documentação Técnica e Acadêmica
│   ├── Documentacao_Arquitetura_de_Banco_de_Dados.pdf
│   ├── Documentacao_Modelagem_Conceitual.pdf
│   ├── Documentacao_Modelagem_Fisica.pdf
│   └── Documentacao_Modelagem_Logica.pdf
├── src/                               # Aplicação Frontend (React 18 + Vite)
│   ├── api/                           # Camada de comunicação HTTP e sessão (client.js)
│   ├── components/                    # Componentes visuais reutilizáveis (CampoErro.jsx)
│   ├── lib/                           # Re-export de compatibilidade da camada de API
│   ├── pages/                         # Páginas da aplicação (Login, Cadastro, Projetos, Workspace)
│   ├── services/                      # Serviços externos desacoplados (geocodingService.js)
│   ├── styles/                        # Design Tokens CSS (:root), reset e utilitários (tokens.css)
│   ├── utils/                         # Funções puras de validação e Web Storage (validators, storage)
│   ├── App.jsx                        # Roteamento SPA e guardas de autenticação JWT
│   ├── index.css                      # Folha de estilo global e diretivas Tailwind
│   └── main.jsx                       # Inicialização da árvore React
├── .env.example                       # Exemplo de variáveis de ambiente
├── .gitignore                         # Regras de exclusão do Git (node_modules, .env, .cache, dist)
├── index.html                         # Documento HTML5 raiz com metadados SEO e Google Fonts
├── LICENSE                            # Licença MIT do projeto
├── package.json                       # Manifesto NPM e scripts de build/dev
├── README.md                          # Documentação principal do repositório
├── tailwind.config.js                 # Configuração do Tailwind CSS
└── vite.config.js                     # Configuração do bundler Vite e proxy reverso (/api)
```

### 5.2 Fluxo de Branches e Conventional Commits
- **Branches:**
  - `main`: Código estável homologado e pronto para produção.
  - `develop`: Branch de integração contínua das entregas da Sprint.
  - `feature/<escopo>`: Novas funcionalidades (ex.: `feature/workspace-mst-snap`, `feature/tabela-semantica-projetos`).
  - `fix/<escopo>`: Correções de defeitos (ex.: `fix/validacao-cpf-cadastro`).
  - `docs/<escopo>`: Atualizações de documentação e ADRs.
- **Padrão de Mensagens (Conventional Commits):**
  - `feat:` nova funcionalidade para o usuário.
  - `fix:` correção de bug em produção ou desenvolvimento.
  - `docs:` alterações exclusivas em documentação (`README.md`, `/docs`).
  - `style:` ajustes de formatação e tokens CSS sem alteração de regra de negócio.
  - `refactor:` refatoração de código mantendo comportamento externo.
  - `test:` adição ou atualização de testes automatizados.

---

## 6. Conformidade com Boas Práticas Web (Aulas 06 a 15)

- **HTML5 Semântico, SEO e Acessibilidade (Aulas 06, 07, 08 e 09):**
  - Metadados `<title>` dinâmicos por rota e `<meta name="description">` concisa (≤ 160 caracteres) em [`index.html`](index.html).
  - Hierarquia estrita de títulos (`<h1>` único por página → `<h2>` → `<h3>`, sem pular níveis) e ausência de `<br>` para espaçamento visual.
  - Elementos semânticos textuais: `<abbr title="...">` para siglas técnicas (`OSP`, `FTTH`, `GIS`, `AGM`, `CREA`, `CPF`), `<kbd>` para atalhos de teclado, `<small>` para avisos secundários e `<address>` nos rodapés (`<footer>`).
  - Listas estruturadas (`<ul>`/`<ol>` + `<li>`) em todos os menus `<nav>`, breadcrumbs, paginação e gerenciador de camadas.
  - Tabela semântica completa (`<table>`, `<caption>`, `<thead>`, `<tbody>`, `<tfoot>`, `<th scope="col">`, `<th scope="row">`) em [`CurrentProjectsSection.jsx`](src/pages/Projetos/components/CurrentProjectsSection.jsx) envolvida por `.tabela-wrap` (`overflow-x: auto`).
  - Formulários acessíveis com `<fieldset>`, `<legend>`, `<label htmlFor="...">` explícito em 100% dos campos, validação nativa HTML5 (`required`, `minLength`, `maxLength`, `pattern`) combinada à validação em tempo real e botões com rótulos específicos (`Entrar na Plataforma`, `Enviar Cadastro`, `Limpar`).
- **CSS Moderno, Design Tokens e Layout Responsivo Mobile-First (Aulas 10 e 11):**
  - Variáveis CSS globais (`:root`) em [`src/styles/tokens.css`](src/styles/tokens.css), `box-sizing: border-box` universal, imagens fluidas (`max-width: 100%; height: auto; display: block`), foco acessível `:focus-visible` e zero estilos inline (`style={{ ... }}`) no JSX.
  - Layout **Mobile-First** utilizando Flexbox e CSS Grid (`flex-col lg:flex-row`, `grid-cols-1 sm:grid-cols-2`).
- **JavaScript Moderno, Web Storage Seguro e Autenticação JWT (Aulas 12, 13, 14 e 15):**
  - Carregamento não bloqueante (`defer` no script principal), imutabilidade com `const`, `async/await` com tratamento `try/catch/finally` e separação de responsabilidades.
  - Gerenciador de armazenamento [`src/utils/storage.js`](src/utils/storage.js) com verificação `typeof Storage !== "undefined"`, chaves padronizadas com namespace (`infraroute:auth:session`, `infraroute:form:cadastro`, `infraroute:config:workspace`), serialização JSON resiliente, limpeza seletiva via `removeItem` (nunca `localStorage.clear()`) e bloqueio automático do armazenamento de dados sensíveis (`senha` e `cpf`).
  - Decodificação Base64URL do payload JWT no cliente (`decodeJwtPayload`, `isJwtExpired`) para validação proativa de expiração (`exp`) antes de requisições autenticadas com `Authorization: Bearer <token>`.

---

## 7. Como Executar o Projeto Localmente

Requisitos: **Node.js 20.19+** (ou **22.12+**) e **Python 3.10+**.

> **Nota para Windows PowerShell:** Caso a política de execução (`ExecutionPolicy`) bloqueie o comando `npm`, utilize `npm.cmd` (ex.: `npm.cmd install`, `npm.cmd run dev`, `npm.cmd run build`).

### 7.1 Executar a Suíte de Testes Automatizados (42 testes)
```powershell
python -m unittest discover -s backend/tests -v
```

### 7.2 Iniciar o Backend (FastAPI + Uvicorn na porta `8000`)
```powershell
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`

### 7.3 Iniciar o Frontend (React + Vite na porta `5173`)
Em outro terminal na raiz do projeto:
```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```
O Vite encaminha automaticamente `/api` e `/health` para `http://127.0.0.1:8000`.

### 7.4 Configurar a Chave do Google Maps
Copie `.env.example` para `.env.local` na raiz do projeto e informe sua chave da **Google Maps JavaScript API**:
```env
VITE_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

### 7.5 Credenciais de Demonstração
- **Login Rápido (1 clique na tela `/login`):** `engenheiro@empresa.com.br` / senha `123456`
- **Persistência em Desenvolvimento:** Novos cadastros, projetos criados, alterações de status e ativos desenhados no mapa são salvos automaticamente em `.cache/dev_users.json` e `.cache/dev_workspace.json`, sobrevivendo ao reinício do servidor.

---

## 8. Principais Rotas da API REST

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

## 9. Equipe, Banco de Dados e Licença

### 9.1 Inicialização do Banco Físico (PostgreSQL + PostGIS)
```powershell
psql -U postgres -d infraroute -f database/schema_postgis.sql
psql -U postgres -d infraroute -f database/seed.sql
```

### 9.2 Integrantes do Projeto Integrador (PUC)
- Equipe de Engenharia de Software e Telecomunicações — Projeto Integrador **InfraRoute** (PUC Campinas).

### 9.3 Licença
Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](LICENSE) para mais informações.
