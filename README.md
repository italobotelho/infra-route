# InfraRoute — Plataforma SaaS de Engenharia de Redes Ópticas (OSP / FTTH)

![Status do Projeto](https://img.shields.io/badge/Status-MVP%20Funcional%20Integrado-2563eb)
![Testes Automatizados](https://img.shields.io/badge/Testes%20Backend-53%20Passando-16a34a)
![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%208%20%2B%20Leaflet-0ea5e9)
![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20PostgreSQL%2FPostGIS%20%2B%20SQLite-059669)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-slate)

Plataforma SaaS *multi-tenant* para planejamento geoespacial (**OSP** / **FTTH**), cálculo de **Árvore Geradora Mínima Constrita** (**Algoritmo de Prim** via Listas de Adjacência Bidirecionais), roteamento viário urbano (**Snap ON / OFF**), telemetria HTTP em tempo real (SSE) e governança corporativa de infraestrutura de fibra óptica.

---

## Sumário

1. [Concepção do Projeto, Impacto Social e ODS (Aula 01)](#1-concepção-do-projeto-impacto-social-e-ods-aula-01)
2. [Ciclo de Vida do Software e Metodologia Ágil (Aula 02)](#2-ciclo-de-vida-do-software-e-metodologia-ágil-aula-02)
3. [UI/UX, Psicologia Cognitiva e Heurísticas de Nielsen (Aula 03)](#3-uiux-psicologia-cognitiva-e-heurísticas-de-nielsen-aula-03)
4. [Arquitetura de Software e ADRs (Aula 04)](#4-arquitetura-de-software-e-adrs-aula-04)
5. [Estrutura do Repositório e Governança Git (Aula 05)](#5-estrutura-do-repositório-e-governança-git-aula-05)
6. [Conformidade com Boas Práticas Web, Segurança e Governança (Aulas 06 a 15)](#6-conformidade-com-boas-práticas-web-segurança-e-governança-aulas-06-a-15)
7. [Como Executar o Projeto Localmente](#7-como-executar-o-projeto-localmente)
8. [Rotas da API REST](#8-rotas-da-api-rest)
9. [Banco de Dados, Documentação, Equipe e Licença](#9-banco-de-dados-documentação-equipe-e-licença)

---

## 1. Concepção do Projeto, Impacto Social e ODS (Aula 01)

### 1.1 Problema Real e Público-Alvo
Provedores regionais de internet (**ISPs**) e escritórios de engenharia de telecomunicações frequentemente planejam expansões de fibra óptica (**Planta Externa / OSP**) em planilhas desconectadas e arquivos CAD estáticos. Isso provoca:
- Superdimensionamento de cabos ópticos (15% a 30% de desperdício de metragem por ciclos redundantes);
- Erros de orçamento (**CAPEX**) por falta de integração entre o catálogo de cabos/equipamentos e as distâncias reais de arruamento;
- Ausência de governança técnica (rastreabilidade de engenheiros responsáveis com registro **CREA**, controle de versões, trilha de auditoria e isolamento entre empresas).

**Público-Alvo:**
- Engenheiros de Telecomunicações e Projetistas **OSP/FTTH**;
- Coordenadores de Implantação de Redes, Auditores **SecOps** e Gestores de **CAPEX** em provedores de internet (**ISPs**) e operadoras neutras.

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
- [x] **Possui público-alvo bem definido?** Sim — engenheiros projetistas (**CREA**), gestores de **ISPs** e auditores técnicos.
- [x] **É tecnicamente viável na Web?** Sim — SPA em React 19 integrada a mapas interativos (Google Maps + fallback gratuito Leaflet/OpenStreetMap), geocodificação pública e API FastAPI.
- [x] **Gera impacto positivo mensurável?** Sim — exibe em tempo real a `% de economia de material (AGM Prim)` e o custo total acumulado da obra.
- [x] **Possui diferencial claro?** Sim — combina cálculo de **AGM (Prim)** com ajuste automático à malha viária real (**Snap ON** via OpenStreetMap/Valhalla), governança multi-tenant, RBAC e painel de logs ao vivo via SSE.

---

## 2. Ciclo de Vida do Software e Metodologia Ágil (Aula 02)

### 2.1 Etapas do Ciclo de Vida (SDLC)
1. **Levantamento de Requisitos:** Especificação das regras de negócio de engenharia óptica, restrições de vão máximo por modelo de cabo (`AS-80`, `AS-120`, `AS-200`) e governança multi-tenant (documentados em [`docs/`](docs/)).
2. **Análise e Design:** Modelagem Conceitual, Lógica e Física em **3ª Forma Normal (3FN)** com extensão geoespacial **PostGIS** (`SRID 4326`) e prototipação **UI/UX** de alta fidelidade.
3. **Implementação:** Desenvolvimento desacoplado em camadas (Frontend React 19 + Vite 8 e Backend Python FastAPI com repositório SQL POO).
4. **Testes e Verificação:** Suíte automatizada com **53 testes unitários e de integração** (`backend/tests/`):
   - [`test_prim_service.py`](backend/tests/test_prim_service.py): **18 testes** do Algoritmo de Prim, restrições físicas de vão máximo, coordenadas inválidas (`NaN`/`Inf`), ilhas topológicas e performance.
   - [`test_security_auth.py`](backend/tests/test_security_auth.py): **9 testes** de `bcrypt`, JWT `HS256`, expiração, *Rate Limiting* (HTTP 429), revogação por `jti` no logout e OTP.
   - [`test_governanca_backend.py`](backend/tests/test_governanca_backend.py): **8 testes** de isolamento *multi-tenant*, RBAC, especialização CREA, *Soft Delete* (`RESTRICT`) e imutabilidade histórica.
   - [`test_workspace_fluxo_completo.py`](backend/tests/test_workspace_fluxo_completo.py): **7 testes** integrados do fluxo completo do workspace e registro com vínculo.
   - [`test_database_sql_integracao.py`](backend/tests/test_database_sql_integracao.py): **6 testes** de POO (`DatabaseManagerBase`), transações ACID com rollback, persistência SQL real, catálogo 3FN e concorrência multithread.
   - [`test_seguranca_auditoria_rbac.py`](backend/tests/test_seguranca_auditoria_rbac.py): **5 testes** de RBAC de logs, visão global `SuperAdmin`, mascaramento LGPD de CPF, filtros UTC e ticket efêmero SSE.
5. **Implantação e Evolução Contínua:** Build otimizado de produção (`vite build`) e scripts SQL versionados (`database/`).

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

### 3.2 Jornada do Usuário e Telas da Aplicação
1. **Autenticação (`/login`) e Cadastro (`/cadastro`):** Acesso corporativo com validação instantânea de CPF (Módulo 11), CREA, telefone e força de senha, preenchimento de demonstração em 1 clique, seletor multi-aba isolado (`QuickPersonaSwitcher`) e rascunho automático não sensível em `localStorage`.
2. **Dashboard Executivo (`/dashboard`):** Visão consolidada da empresa (ou global para `SuperAdmin`), distribuição de projetos por status, ranking de CAPEX e status ao vivo do banco SQL.
3. **Gestão de Portfólio (`/projetos`):** Cards de KPIs, verificação de e-mail por código OTP de 6 dígitos, tabela semântica de projetos com busca instantânea, ordenação multi-coluna, personalização de colunas, criação/renomeação de projetos, alteração controlada de status e exportação técnica em **JSON**, **GeoJSON**, **CSV/BOM** e **Relatório Técnico (PDF/impressão)** via [`ProjectReportModal`](src/components/ProjectReportModal.jsx).
4. **Planejamento Espacial (`/workspace`):** Busca de endereço/CEP (ViaCEP + Nominatim), inserção/edição de Postes (`P`), CTOs (`C`), CEOs (`E`) e OLTs (`O`) no mapa escuro (Google Maps ou fallback automático **Leaflet + OpenStreetMap/Carto**), seleção em área (`L`), inspeção de enlaces (`D`), seleção de nó raiz do Prim, restauração *Soft Delete* e gaveta flutuante **Logs Ao Vivo** ([`LiveAuditDrawer`](src/components/LiveAuditDrawer.jsx)).
5. **Otimização Topológica (`Calcular Malha Otimizada`):** Execução do **Algoritmo de Prim** com opção de ajuste viário (**Snap ON**) e alerta automático de ilhas topológicas (`grafo_conexo: false`).
6. **Governança, Catálogos 3FN & Auditoria Ao Vivo (`/governanca`):** Consulta e cadastro de modelos em `Tipo_Cabo` / `Tipo_Equipamento`, painel de requisições HTTP e trilha de auditoria em tempo real (SSE com fallback `since_id`), filtros por empresa, funcionário, método HTTP, status, período (BRT/UTC), saúde SQL (`vw_resumo_projetos_corporativos`) e **Inspetor Didático JWT**.
7. **Central de Ajuda (`/ajuda`):** Manual operacional com tabela de atalhos do GIS, matriz de permissões RBAC e regras de governança histórica.

### 3.3 Leis da Psicologia Cognitiva Aplicadas
- **Lei de Fitts:** Botões de ação primária (`Entrar na Plataforma`, `Enviar Cadastro`, `Calcular Malha Otimizada`) possuem altura mínima de `48px` (`min-h-12`) e largura total na barra lateral, reduzindo o tempo de aquisição do alvo.
- **Lei de Hick:** A barra de ferramentas flutuante do GIS limita-se às ferramentas essenciais separadas por divisores visuais e associadas a teclas de atalho de 1 letra (`V`, `L`, `P`, `C`, `E`, `O`, `D`, `S`).
- **Leis da Gestalt (Proximidade, Similaridade e Região Comum):** Agrupamento semântico de campos com `<fieldset>` e `<legend>`, cartões delimitados por bordas sutis e código de cores consistente para ativos (`Poste` em índigo, `CTO` em verde-esmeralda, `CEO` em âmbar, `OLT` em magenta).

### 3.4 As 7 Heurísticas de Usabilidade de Nielsen no InfraRoute
1. **Visibilidade do Status do Sistema:** Indicadores em tempo real (`Carregando projetos...`, `Calculando...`, `Buscando…`, badge `Traçado Viário (Snap ON)`, contador de ativos/trechos e status do stream SSE).
2. **Correspondência entre o Sistema e o Mundo Real:** Uso do vocabulário técnico autêntico da engenharia de telecomunicações (`OSP`, `FTTH`, `CTO`, `CEO`, `OLT`, `Vão máximo`, `AS-80 12 FO`, `CREA`) com tags `<abbr title="...">` explicativas.
3. **Controle e Liberdade do Usuário:** Suporte à tecla `<kbd>Esc</kbd>` para cancelar ferramentas ou seleções, botão `Limpar` no cadastro, *Soft Delete* com restauração de ativos e alternância livre entre `Snap ON` e `Snap OFF`.
4. **Consistência e Padrões:** Paleta semântica padronizada via Design Tokens CSS (`--cor-primaria`, `--cor-escuro`, `--cor-perigo`), tipografia `Inter` e componentes de erro reutilizáveis (`<CampoErro />`).
5. **Prevenção de Erros:** Validação em tempo real de CPF (dígitos verificadores), telefone, CREA e força de senha; desabilitação de botões durante submissões (`disabled={isSubmitting}`); trava de imutabilidade em projetos `Concluído` ou `Cancelado`.
6. **Reconhecimento em vez de Memorização:** Dica contextual dinâmica (`ToolHint`) abaixo da barra de ferramentas explicando exatamente como usar a ferramenta ativa e seus atalhos (`<kbd>`).
7. **Flexibilidade e Eficiência de Uso:** Atalhos de teclado completos no mapa GIS (`V`, `L`, `P`, `C`, `E`, `O`, `D`, `S`, `Esc`, `Del`) para usuários avançados e preenchimento rápido de perfis de demonstração com sessão isolada por aba.

---

## 4. Arquitetura de Software e ADRs (Aula 04)

### 4.1 Arquitetura em Camadas (`UI ≠ Lógica ≠ Dados`)
O projeto separa estritamente a interface gráfica, as regras de negócio/serviços e a camada de persistência tanto no **Frontend** quanto no **Backend**:

```text
+-----------------------------------------------------------------------------+
| CAMADA DE APRESENTAÇÃO (UI — React 19 + Vite 8 + Tailwind CSS + Leaflet/GM) |
| - src/pages/ (Login, Cadastro, Dashboard, Projetos, Workspace, Governanca,  |
|               Ajuda)                                                        |
| - src/components/ (CampoErro, LeafletMapCanvas, LiveAuditDrawer,            |
|                    ProjectReportModal, QuickPersonaSwitcher, ToastProvider) |
| - src/styles/ (tokens.css)                                                  |
+--------------------------------------+--------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| CAMADA DE SERVIÇOS E LÓGICA DE CLIENTE (Frontend Services, POO ES6 & Utils) |
| - src/api/client.js (Cliente HTTP + Injeção Bearer JWT + Tratamento 401)    |
| - src/utils/sessionVault.js (TabSessionManager POO — Sessão isolada p/ aba) |
| - src/utils/auditStreamClient.js (AuditStreamClient POO — SSE + fallback)   |
| - src/services/geocodingService.js (Fila Nominatim OSM 1 req/s + ViaCEP)    |
| - src/utils/ (validators.js, storage.js, dateTime.js, projectExport.js)     |
+--------------------------------------+--------------------------------------+
                                       | REST JSON + SSE (/api/*)
                                       v
+-----------------------------------------------------------------------------+
| CAMADA DE CONTROLE E DOMÍNIO (Backend FastAPI Controllers & Services)       |
| - backend/main.py (Middlewares OWASP, Telemetria HTTP e Handlers globais)   |
| - backend/controllers/ (auth_controller, projetos_controller, topologia)    |
| - backend/services/prim_service.py (Grafo + Algoritmo de Prim + Valhalla)   |
| - backend/services/governanca_service.py (Multi-Tenant + RBAC + CREA)       |
| - backend/services/security_service.py (bcrypt + JWT HS256 + Rate Limit/SSE)|
+--------------------------------------+--------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| CAMADA DE PERSISTÊNCIA SQL POO (PostgreSQL/PostGIS + Fallback SQLite ACID)  |
| - backend/database_manager.py (DatabaseManagerBase -> Postgres / SQLite)    |
| - backend/repositories/sql_repository.py (InfraRouteSQLRepository 3FN)      |
| - backend/services/workspace_store.py & database/schema_postgis.sql + seed  |
+-----------------------------------------------------------------------------+
```

### 4.2 Registro de Decisões de Arquitetura (ADRs)

#### ADR-001: Adoção de React 19 + Vite 8 + Design Tokens CSS + Fallback Leaflet/OSM no Frontend
- **Data:** 2026-03-10 *(atualizado para React 19 + Leaflet)* | **Status:** Aceito
- **Contexto:** O sistema exige uma interface reativa de baixa latência para manipular dezenas de marcadores e polilinhas sem exigir obrigatoriamente uma chave paga do Google Maps em ambientes locais/acadêmicos.
- **Alternativas Consideradas:** (1) MPA tradicional renderizada no servidor; (2) SPA com React + Vite + Tailwind CSS + variáveis CSS nativas (`:root`), com suporte opcional ao Google Maps JS API e *fallback* automático para **Leaflet + OpenStreetMap/Carto**.
- **Decisão:** Adotar React 19 + Vite 8 com separação modular em [`src/`](src/) e componente [`LeafletMapCanvas.jsx`](src/components/LeafletMapCanvas.jsx).
- **Consequências:** Positivas: funcionamento imediato sem billing externo, estado reativo fluido no mapa GIS e reutilização de componentes. Negativas: necessidade de gerenciar títulos dinâmicos (`document.title`) e rotas protegidas no cliente.

#### ADR-002: Algoritmo de Prim sobre Grafo Bidirecional com Snap Viário em Lote
- **Data:** 2026-03-24 | **Status:** Aceito
- **Contexto:** Conectar todos os ativos ópticos com o menor custo de cabo possível configura o problema clássico da **Árvore Geradora Mínima (AGM)**, sujeito à restrição física de vão máximo de cada modelo de cabo e ao traçado real das ruas urbanas.
- **Alternativas Consideradas:** (1) Algoritmo de Kruskal sem restrição viária; (2) Algoritmo de Prim sobre Lista de Adjacência Bidirecional com distância geodésica de Haversine (`Snap OFF`) ou roteamento viário OpenStreetMap/Valhalla em lote (`Snap ON`).
- **Decisão:** Implementar o **Algoritmo de Prim** em [`backend/services/prim_service.py`](backend/services/prim_service.py) operando sobre listas de adjacência bidirecionais e consultando o motor Valhalla em lote para contornar quarteirões.
- **Consequências:** Positivas: complexidade ótima para grafos conexos, detecção explícita de ilhas topológicas (`grafo_conexo: false`) e cálculo preciso de economia percentual de material. Negativas: latência adicional de rede quando o roteamento viário externo (`Snap ON`) não está em cache.

#### ADR-003: Autenticação Stateless com JWT (HS256), Senhas Salgadas (`bcrypt`), Token Denylist e Ticket SSE
- **Data:** 2026-04-02 | **Status:** Aceito
- **Contexto:** A API RESTful precisa autenticar engenheiros e auditores de múltiplas empresas (*multi-tenant*), proteger credenciais contra força bruta, permitir revogação imediata no logout e autenticar streams SSE sem expor o JWT na URL.
- **Alternativas Consideradas:** (1) Sessões stateful em memória no servidor; (2) Tokens JWT assinados com `HMAC-SHA256` (`jti`, `sub`, `exp`, `iat`), hash `bcrypt`, *Rate Limiting* por janela deslizante, *Denylist* para revogação e tickets efêmeros (`POST /api/auth/auditoria/stream-ticket`) para SSE.
- **Decisão:** Adotar JWT `HS256` + `bcrypt` + *Rate Limiting* (máximo de 5 falhas por janela) + tickets SSE em [`backend/services/security_service.py`](backend/services/security_service.py), aliado a higienização de dados sensíveis e isolamento por aba em [`src/utils/sessionVault.js`](src/utils/sessionVault.js).
- **Consequências:** Positivas: escalabilidade stateless, verificação proativa de expiração no cliente e proteção contra exposição de JWT em query strings. Negativas: necessidade de manter a *Denylist* sincronizada em caso de múltiplos workers.

#### ADR-004: Modelagem Relacional em 3FN, POO DB-API, Soft Delete e Imutabilidade Histórica
- **Data:** 2026-04-15 | **Status:** Aceito
- **Contexto:** Projetos de engenharia concluídos possuem valor legal/regulatório e não podem sofrer alterações acidentais de traçado ou exclusão física de ativos que quebrem o histórico de auditoria.
- **Alternativas Consideradas:** (1) Exclusão física (`DELETE CASCADE`) de pontos e projetos; (2) Modelagem em **3ª Forma Normal (3FN)** com *Soft Delete* (`Status_Ponto = 'Removido'`), trava de estado para projetos `Concluído`/`Cancelado` e acesso polimórfico POO ao PostgreSQL/PostGIS com *fallback* local SQLite ACID.
- **Decisão:** Implementar validação estrita em [`backend/services/governanca_service.py`](backend/services/governanca_service.py) e persistência via [`DatabaseManagerBase`](backend/database_manager.py) / [`InfraRouteSQLRepository`](backend/repositories/sql_repository.py).
- **Consequências:** Positivas: rastreabilidade completa de auditoria, execução local imediata sem servidor externo e integridade referencial preservada. Negativas: consultas de ativos operacionais devem filtrar `status_ponto == 'Ativo'`.

---

## 5. Estrutura do Repositório e Governança Git (Aula 05)

### 5.1 Estrutura de Pastas Padronizada

```text
infra-route/
├── backend/                                    # API Backend em Python (FastAPI)
│   ├── controllers/                            # Controladores REST (auth, projetos, topologia)
│   │   ├── auth_controller.py
│   │   ├── projetos_controller.py
│   │   └── topologia_controller.py
│   ├── models/                                 # Contratos e validações Pydantic (schemas.py)
│   ├── repositories/                           # Repositório SQL sobre DatabaseManagerBase (sql_repository.py)
│   ├── services/                               # Regras de negócio (prim, governanca, security, store, exceptions)
│   ├── tests/                                  # Suíte com 53 testes automatizados (unittest)
│   │   ├── test_database_sql_integracao.py
│   │   ├── test_governanca_backend.py
│   │   ├── test_prim_service.py
│   │   ├── test_security_auth.py
│   │   ├── test_seguranca_auditoria_rbac.py
│   │   └── test_workspace_fluxo_completo.py
│   ├── database.py                             # Conexão SQLAlchemy / PostGIS
│   ├── database_manager.py                     # Camada POO DB-API (PostgresDatabaseManager / SQLiteDatabaseManager)
│   ├── main.py                                 # Ponto de entrada FastAPI + middlewares OWASP + telemetria
│   └── requirements.txt                        # Dependências Python
├── database/                                   # Scripts de Banco de Dados Relacional / Geoespacial
│   ├── schema_postgis.sql                      # DDL PostgreSQL + PostGIS (3FN, SRID 4326, Views, Triggers, Procedures)
│   └── seed.sql                                # Carga inicial de catálogos, empresas, usuários e projetos
├── docs/                                       # Documentação Técnica e Acadêmica
│   ├── Documentacao_Arquitetura_de_Banco_de_Dados.pdf
│   ├── Documentacao_Modelagem_Conceitual.pdf
│   ├── Documentacao_Modelagem_Fisica.pdf
│   ├── Documentacao_Modelagem_Logica.pdf
│   └── Entrega_04_Documento_Padrao_InfraRoute.md
├── public/                                     # Ativos estáticos públicos
├── src/                                        # Aplicação Frontend (React 19 + Vite 8)
│   ├── api/                                    # Cliente HTTP e interceptação JWT (client.js)
│   ├── components/                             # Componentes reutilizáveis (CampoErro, LeafletMapCanvas,
│   │                                           # LiveAuditDrawer, ProjectReportModal, QuickPersonaSwitcher, ToastProvider)
│   ├── lib/                                    # Re-export da camada de API (api.js)
│   ├── pages/                                  # Páginas da SPA (Ajuda, Cadastro, Dashboard, Governanca,
│   │                                           # Login, Projetos, Workspace)
│   ├── services/                               # Geocodificação OSM Nominatim + ViaCEP (geocodingService.js)
│   ├── styles/                                 # Design Tokens CSS (:root) e reset (tokens.css)
│   ├── utils/                                  # auditStreamClient.js, dateTime.js, projectExport.js,
│   │                                           # sessionVault.js, storage.js, validators.js
│   ├── App.jsx                                 # Roteamento SPA e guardas de autenticação JWT
│   ├── index.css                               # Folha de estilo global e diretivas Tailwind
│   └── main.jsx                                # Inicialização da árvore React
├── .dockerignore                               # Exclusões do contexto de build Docker
├── .env.example                                # Modelo de variáveis de ambiente
├── .gitignore                                  # Regras de exclusão (node_modules, .env, .venv, .cache, dist)
├── docker-compose.yml                          # Orquestração PostgreSQL/PostGIS/pgRouting + Backend + Frontend
├── Dockerfile.backend                          # Imagem Python 3.12 + FastAPI + libpq-dev
├── Dockerfile.frontend                         # Imagem Node 22 + Vite (proxy configurável p/ rede Docker)
├── index.html                                  # Documento HTML5 raiz com metadados SEO e Google Fonts
├── LICENSE                                     # Licença MIT do projeto
├── package.json                                # Manifesto NPM e scripts de dev/test/build
├── postcss.config.js                           # Configuração PostCSS
├── README.md                                   # Documentação principal do repositório
├── tailwind.config.js                          # Configuração do Tailwind CSS
└── vite.config.js                              # Configuração do bundler Vite e proxy reverso (/api, /health)
```

### 5.2 Fluxo de Branches e Conventional Commits
- **Branches:**
  - `main`: Código estável homologado e pronto para produção.
  - `develop`: Branch de integração contínua das entregas da Sprint.
  - `feature/<escopo>` / `feat/<escopo>`: Novas funcionalidades (ex.: `feat/auth-criptografia`, `feat/mst-metricas-polylines`).
  - `fix/<escopo>`: Correções de defeitos (ex.: `fix/validacao-cpf-cadastro`).
  - `docs/<escopo>`: Atualizações de documentação e ADRs.
- **Padrão de Mensagens (Conventional Commits):**
  - `feat:` nova funcionalidade para o usuário.
  - `fix:` correção de bug em produção ou desenvolvimento.
  - `docs:` alterações exclusivas em documentação (`README.md`, `docs/`).
  - `style:` ajustes de formatação e tokens CSS sem alteração de regra de negócio.
  - `refactor:` refatoração de código mantendo comportamento externo.
  - `test:` adição ou atualização de testes automatizados.

---

## 6. Conformidade com Boas Práticas Web, Segurança e Governança (Aulas 06 a 15)

- **HTML5 Semântico, SEO e Acessibilidade (Aulas 06, 07, 08 e 09):**
  - Metadados `<title>` dinâmicos por rota e `<meta name="description">` concisa em [`index.html`](index.html).
  - Hierarquia estrita de títulos (`<h1>` único por página → `<h2>` → `<h3>`, sem pular níveis) e ausência de `<br>` para espaçamento visual.
  - Elementos semânticos textuais: `<abbr title="...">` para siglas técnicas (`OSP`, `FTTH`, `GIS`, `AGM`, `CREA`, `CPF`), `<kbd>` para atalhos de teclado, `<small>` para avisos secundários e `<address>` nos rodapés (`<footer>`).
  - Listas estruturadas (`<ul>`/`<ol>` + `<li>`) em menus `<nav>`, breadcrumbs, paginação e gerenciador de camadas.
  - Tabela semântica completa (`<table>`, `<caption>`, `<thead>`, `<tbody>`, `<tfoot>`, `<th scope="col">`, `<th scope="row">`) em [`CurrentProjectsSection.jsx`](src/pages/Projetos/components/CurrentProjectsSection.jsx) envolvida por `.tabela-wrap` (`overflow-x: auto`).
  - Formulários acessíveis com `<fieldset>`, `<legend>`, `<label htmlFor="...">` explícito em 100% dos campos e botões com rótulos descritivos (`Entrar na Plataforma`, `Enviar Cadastro`, `Limpar`).
- **CSS Moderno, Design Tokens e Layout Responsivo Mobile-First (Aulas 10 e 11):**
  - Variáveis CSS globais (`:root`) em [`src/styles/tokens.css`](src/styles/tokens.css), `box-sizing: border-box` universal, foco acessível `:focus-visible` e ausência de estilos inline no JSX.
  - Layout **Mobile-First** utilizando Flexbox e CSS Grid (`flex-col lg:flex-row`, `grid-cols-1 sm:grid-cols-2`).
- **JavaScript Moderno, Web Storage Seguro e Autenticação JWT (Aulas 12, 13, 14 e 15):**
  - Gerenciador de armazenamento [`src/utils/storage.js`](src/utils/storage.js) com verificação `typeof Storage !== "undefined"`, chaves padronizadas com namespace (`infraroute:auth:session`, `infraroute:form:cadastro`, `infraroute:config:workspace`), remoção seletiva e bloqueio automático da gravação de dados sensíveis (`senha`, `cpf`).
  - Isolamento de sessão por aba via classe ES6 [`TabSessionManager`](src/utils/sessionVault.js) e cliente de streaming em tempo real [`AuditStreamClient`](src/utils/auditStreamClient.js).
- **Segurança Backend, OWASP, LGPD e RBAC:**
  - Cabeçalhos OWASP (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` em `/api/auth`).
  - Anti-Spoofing JWT nos controladores (impedindo divergência de `id_usuario_autor`), mascaramento LGPD de CPF (`mascarar_cpf_lgpd`), padronização temporal em **UTC** no backend com exibição no fuso **BRT (`America/Sao_Paulo`)** em [`src/utils/dateTime.js`](src/utils/dateTime.js) e matriz RBAC em 4 papéis (`SuperAdmin`, `Administrador`, `Projetista`, `Visualizador`).

---

## 7. Como Executar o Projeto Localmente

### 7.1 Pré-requisitos
- **Node.js 20.19+** (ou **22.12+**) e **NPM**;
- **Python 3.10+** (ou gerenciador **`uv`**);
- *(Opcional)* **PostgreSQL + PostGIS** — caso não utilize um servidor PostgreSQL externo, o projeto inicializa automaticamente o banco local **SQLite ACID** em `.cache/infraroute.db`.
- *(Opcional)* **Chave da Google Maps JavaScript API** — caso não seja informada, a aplicação utiliza automaticamente **Leaflet + OpenStreetMap/Carto** sem custos.

> **Nota para Windows PowerShell:** Caso a política de execução (`ExecutionPolicy`) bloqueie o comando `npm`, utilize `npm.cmd` (ex.: `npm.cmd install`, `npm.cmd run dev`, `npm.cmd run build`).

### 7.2 Configuração de Variáveis de Ambiente (`.env`)
Copie `.env.example` para `.env` na raiz do projeto:

```powershell
Copy-Item .env.example .env
```

Principais variáveis disponíveis em [`.env.example`](.env.example):

| Variável | Padrão Local Recomendado | Descrição |
| :--- | :--- | :--- |
| `VITE_GOOGLE_MAPS_API_KEY` | *(vazio ou sua chave)* | Chave da Google Maps JS API. Se vazia, ativa o fallback gratuito **Leaflet + OSM**. |
| `VITE_API_BASE_URL` | `/api` | Prefixo base das requisições REST no frontend (encaminhado pelo proxy do Vite). |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Alvo do proxy `/api` e `/health` do Vite (`http://backend:8000` dentro do Docker Compose). |
| `APP_ENV` | `development` | Ambiente de execução (`development` exibe código OTP de teste no console/resposta; `production` oculta). |
| `JWT_SECRET_KEY` | *(string secreta forte)* | Segredo HMAC-SHA256 (`HS256`) para assinatura dos tokens JWT. |
| `JWT_EXPIRATION_SECONDS` | `28800` | Validade do token JWT em segundos (padrão: 8 horas). |
| `BCRYPT_ROUNDS` | `12` | Fator de custo do hash `bcrypt`. |
| `AUTH_MAX_ATTEMPTS` / `AUTH_LOCKOUT_SECONDS` | `5` / `900` | Limite de falhas de login e janela de bloqueio (Rate Limiting). |
| `OTP_EXPIRATION_SECONDS` | `600` | Validade do código OTP de 6 dígitos em segundos. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,...` | Origens autorizadas pelo middleware CORS. |
| `DB_ENGINE` | `sqlite` | Motor SQL ativo (`sqlite` para fallback local imediato ou `postgresql` para PostgreSQL + PostGIS). |
| `SQLITE_DB_PATH` | `.cache/infraroute.db` | Caminho do arquivo SQLite quando `DB_ENGINE=sqlite`. |
| `DATABASE_URL` | `postgresql+psycopg2://postgres:postgres@localhost:5432/infraroute` | URL de conexão quando `DB_ENGINE=postgresql`. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `infraroute` / `postgres` / `postgres` | Credenciais do container `db` no `docker-compose.yml`. |

### 7.3 Preparar Ambiente Python e Instalar Dependências

**Opção A — Usando `venv` padrão do Python:**
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

**Opção B — Usando `uv` (recomendado se `python` não estiver no `PATH`):**
```powershell
uv venv .venv --python 3.12
uv pip install --python .\.venv\Scripts\python.exe -r backend/requirements.txt
```

Instalar dependências do Frontend (na raiz do projeto):
```powershell
npm.cmd install
```

### 7.4 Executar a Suíte de Testes Automatizados (53 testes)
```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```
*(Ou, se `python` estiver no `PATH`: `npm.cmd run test:backend`.)*

### 7.5 Iniciar o Backend (FastAPI + Uvicorn na porta `8000`)
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- **API Base / Health Check:** `http://127.0.0.1:8000/health`
- **Saúde SQL (autenticado):** `http://127.0.0.1:8000/api/health/db`
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

### 7.6 Iniciar o Frontend (React + Vite na porta `5173`)
Em outro terminal na raiz do projeto:
```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```
Acesse **`http://127.0.0.1:5173`** no navegador. O Vite encaminha automaticamente `/api` e `/health` para `http://127.0.0.1:8000` (configurado em [`vite.config.js`](vite.config.js)).

### 7.7 Execução com Docker Compose (PostgreSQL + PostGIS + pgRouting)
Para subir toda a stack containerizada utilizando o banco oficial **PostgreSQL + PostGIS + pgRouting** ([`docker-compose.yml`](docker-compose.yml)) com schema e dados iniciais aplicados automaticamente:

```powershell
docker compose up --build
```
- **Serviços iniciados:** `db` (`pgrouting/pgrouting:16-3.5-3.8` na porta `5432`), `backend` (`FastAPI` na porta `8000` conectado via `DB_ENGINE=postgresql`) e `frontend` (`Vite` na porta `5173` com proxy apontando para `http://backend:8000`).
- **Comandos úteis:**
  - `docker compose down` — encerra os containers preservando o volume `pgdata`.
  - `docker compose down -v` — encerra e recria o banco do zero na próxima subida.

### 7.8 Scripts NPM Disponíveis (`package.json`) e Build de Produção
| Script | Comando | Finalidade |
| :--- | :--- | :--- |
| `dev` | `npm.cmd run dev` | Inicia o servidor de desenvolvimento Vite (Frontend). |
| `dev:backend` | `npm.cmd run dev:backend` | Inicia o backend FastAPI/Uvicorn via `python` do `PATH`. |
| `test:backend` | `npm.cmd run test:backend` | Executa a suíte `unittest` em `backend/tests`. |
| `build` | `npm.cmd run build` | Gera o bundle de produção otimizado em `dist/`. |
| `preview` | `npm.cmd run preview` | Serve localmente o build gerado em `dist/`. |

### 7.9 Credenciais e Perfis de Demonstração (senha padrão: `123456`)
- **SecOps / Auditor Global (`SuperAdmin` — Plataforma / Logs Multi-Empresa):** `secops@infraroute.com.br`
- **Engenheiro Admin (`Administrador` — InfraTelecom S.A., Empresa 1):** `engenheiro@empresa.com.br`
- **Eng. Marina Alves (`Projetista` — InfraTelecom S.A., Empresa 1):** `projetista@empresa.com.br`
- **Analista Auditor (`Visualizador` — InfraTelecom S.A., Empresa 1, Somente Leitura):** `auditor@empresa.com.br`
- **Gestor ConectaSul (`Administrador` — ConectaSul Ltda., Empresa 2, Isolamento Multi-Tenant):** `gestor@conectasul.com.br`
- **Sessão Isolada por Aba + Logs Ao Vivo:** Cada aba mantém sua sessão JWT isolada ao alternar o perfil no seletor rápido (`QuickPersonaSwitcher`), permitindo operar o mapa em uma aba e acompanhar `Log_Auditoria` chegando em tempo real (`/governanca` ou gaveta **Logs Ao Vivo**) em outra.

---

## 8. Rotas da API REST

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Verifica a disponibilidade básica da API FastAPI. |
| `GET` | `/api/health/db` | Verifica a conexão SQL ativa e retorna a contagem real das tabelas e `vw_resumo_projetos_corporativos`. |
| `POST` | `/api/auth/login` | Autentica colaborador (`bcrypt` + Rate Limiting) e emite `access_token` JWT (`HS256`). |
| `POST` | `/api/auth/register` | Cadastra novo engenheiro (`bcrypt`), gera código OTP de 6 dígitos e retorna sessão JWT. |
| `GET` | `/api/auth/me` | Valida o token `Authorization: Bearer <token>` e retorna os dados da sessão ativa. |
| `POST` | `/api/auth/logout` | Revoga imediatamente o token JWT atual no servidor (*Token Denylist* por `jti`). |
| `POST` | `/api/auth/verificar-email` | Valida o código OTP de 6 dígitos e confirma o e-mail corporativo do engenheiro. |
| `POST` | `/api/auth/reenviar-codigo` | Gera e envia um novo código OTP de 6 dígitos para verificação de e-mail. |
| `GET` | `/api/auth/opcoes-filtro-auditoria` | Retorna empresas e funcionários visíveis para filtros do Painel de Logs (RBAC + Multi-Tenant). |
| `POST` | `/api/auth/auditoria/stream-ticket` | Emite ticket efêmero para conexão SSE evitando expor o JWT na URL. |
| `GET` | `/api/auth/auditoria` | Lista a trilha de auditoria e telemetria HTTP com filtros por empresa, usuário, período UTC, método e status. |
| `GET` | `/api/auth/auditoria/stream` | Stream Server-Sent Events (SSE) em tempo real para o Painel de Requisições e Auditoria. |
| `GET` | `/api/catalogos` | Lista os catálogos em 3FN (`Tipo_Equipamento` e `Tipo_Cabo`). |
| `POST` | `/api/catalogos/cabos` | Cadastra um novo modelo de cabo óptico na tabela normalizada `Tipo_Cabo` (`Administrador`). |
| `GET` | `/api/projetos` | Lista os projetos da empresa ativa com `metragem_total` e `custo_estimado` memoizados. |
| `POST` | `/api/projetos` | Cria novo projeto validando Triângulo Multi-Tenant, CREA e RBAC. |
| `PATCH` | `/api/projetos/{id_projeto}` | Renomeia um projeto ativo respeitando Multi-Tenant, RBAC e trava de imutabilidade. |
| `PATCH` | `/api/projetos/{id_projeto}/status` | Atualiza o status do projeto (`Em Planejamento`, `Em Execução`, `Concluído`, `Cancelado`). |
| `GET` | `/api/projetos/{id_projeto}` | Retorna o projeto detalhado, seus `pontos` (`Ponto_Rede`) e `trechos` (`Trecho_Rede`). |
| `POST` | `/api/projetos/{id_projeto}/pontos` | Registra um novo `Ponto_Rede` (`Poste`, `CTO`, `CEO`, `OLT`) no projeto. |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}` | Atualiza coordenadas geográficas, descrição, status físico ou tipo de equipamento de um ponto. |
| `POST` | `/api/projetos/{id_projeto}/calcular-mst` | Executa o **Algoritmo de Prim** sobre os pontos armazenados do projeto e atualiza a memoização. |
| `POST` | `/api/projetos/{id_projeto}/mst` | Executa o **Algoritmo de Prim** com suporte a `catalogo_cabos` dinâmico e `ajustar_malha_viaria` (`Snap ON/OFF`). |
| `PATCH` | `/api/projetos/{id_projeto}/pontos/{id_ponto}/soft-delete` | Inativa/remove logicamente um ponto (`Status_Ponto`), respeitando a trava `RESTRICT`. |

---

## 9. Banco de Dados, Documentação, Equipe e Licença

### 9.1 Banco de Dados Oficial (PostgreSQL + PostGIS) e Fallback Local (SQLite)
O backend utiliza a arquitetura POO `DatabaseManagerBase` ([`backend/database_manager.py`](backend/database_manager.py)) conectada ao repositório SQL [`backend/repositories/sql_repository.py`](backend/repositories/sql_repository.py):
- **Banco Oficial — PostgreSQL + PostGIS (`DB_ENGINE=postgresql` no `.env`):** Aplique o schema espacial e os dados iniciais em seu servidor PostgreSQL:
  ```powershell
  psql -U postgres -d infraroute -f database/schema_postgis.sql
  psql -U postgres -d infraroute -f database/seed.sql
  ```
- **Fallback Local Imediato (`DB_ENGINE=sqlite` no `.env`):** Quando não houver daemon PostgreSQL ativo na máquina, cria e persiste automaticamente todas as tabelas em `.cache/infraroute.db` com chaves estrangeiras (`PRAGMA foreign_keys = ON`) e restrições `CHECK` ativas.

### 9.2 Documentação Técnica e da 4ª Entrega
- Relatório consolidado: [`docs/Entrega_04_Documento_Padrao_InfraRoute.md`](docs/Entrega_04_Documento_Padrao_InfraRoute.md)
- Documentos de modelagem em [`docs/`](docs/): Arquitetura de Banco de Dados, Modelagem Conceitual, Modelagem Lógica e Modelagem Física.

### 9.3 Integrantes do Projeto Integrador (PUC)
- Equipe de Engenharia de Software e Telecomunicações — Projeto Integrador **InfraRoute** (PUC Campinas).

### 9.4 Licença
Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](LICENSE) para mais informações.
