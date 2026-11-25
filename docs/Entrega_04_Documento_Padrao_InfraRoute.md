# Documento Padrão — Projeto Integrador (4ª Entrega)

**Curso:** Ciência de Dados e Inteligência Artificial  
**Disciplinas Integradas:**  
- **PI: Programação Web** (Cód. 2181161) — Prof. Fernando Luiz de Almeida Silveira  
- **Bancos de Dados Relacionais** (Cód. 12514) — Prof. Felipe Cavalaro  

**Projeto:** **InfraRoute** — Plataforma SaaS *Multi-Tenant* para Planejamento Geoespacial e Otimização de Redes Ópticas (OSP / FTTH)  
**Campinas, 2º Semestre de 2026**

---

## 1. Ideação do Projeto, Setor da Sociedade e ODS

### 1.1 Problema Real e Público-Alvo
Provedores regionais de internet (**ISPs**) e equipes de engenharia de telecomunicações frequentemente elaboram projetos de planta externa (**OSP — Outside Plant**) usando planilhas manuais e desenhos estáticos, gerando:
- Superdimensionamento de cabos ópticos (15% a 30% de desperdício de material por ciclos redundantes);
- Erros de orçamento (**CAPEX**) ao desconsiderar limites de vão livre mecânico e o traçado real das vias urbanas;
- Risco jurídico/regulatório pela falta de rastreabilidade de engenheiros habilitados (**CREA**) e isolamento entre empresas (*multi-tenant*).

**Público-Alvo:** Engenheiros de Telecomunicações (com registro CREA), Projetistas OSP/FTTH e Gestores de CAPEX em ISPs.

### 1.2 Setor da Sociedade e Objetivos de Desenvolvimento Sustentável (ODS/ONU)
- **Setor da Sociedade:** **2º Setor (Privado)** como foco principal (ISPs e escritórios de engenharia), com interface regulatória direta com o **1º Setor (Público)** na ocupação ordenada de postes urbanos.
- **ODS Atendidas:**
  - **ODS 8 (Trabalho Decente e Crescimento Econômico):** Automação topológica eleva a produtividade técnica.
  - **ODS 9 (Indústria, Inovação e Infraestrutura):** Viabiliza financeiramente a expansão da banda larga óptica para áreas periféricas.
  - **ODS 11 (Cidades e Comunidades Sustentáveis):** Reduz poluição visual e cabeamento redundante em postes urbanos.
  - **ODS 12 (Consumo e Produção Responsáveis):** Poda ciclos redundantes via **Árvore Geradora Mínima (Algoritmo de Prim)**, economizando polímeros, sílica e metais.

---

## 2. Protótipo da Solução e UI/UX

- **Telas Implementadas (Fluxo Completo):**
  1. **Cadastro de Engenheiros (`/cadastro`):** Validação em tempo real de CPF (Módulo 11), Telefone, CREA, E-mail, toggle Mostrar/Ocultar senha, barra visual de força em 4 níveis e rascunho não-sensível em `localStorage`.
  2. **Login Corporativo (`/login`):** Autenticação `bcrypt` + JWT `HS256`, isolamento de sessão por aba (`TabSessionManager` POO ES6) e preenchimento rápido dos **4 Perfis RBAC/Multi-Tenant**.
  3. **Dashboard Executivo (`/dashboard`):** Indicadores consolidados, distribuição por status, ranking de CAPEX e status ao vivo do banco SQL.
  4. **Gestão de Portfólio (`/projetos`):** Cards de KPIs, filtros por status, seleção em lote, tabela semântica (`<table>`, `<caption>`, `<thead>`, `<tbody>`, `<tfoot>`, `scope="col|row"`), busca, ordenação multi-coluna, personalização de colunas, criação/renomeação de projeto, alteração de status, verificação OTP de 6 dígitos e modal de **Memorial Descritivo / BOM / GeoJSON / CSV / PDF**.
  5. **Governança, Catálogos 3FN & Auditoria Ao Vivo (`/governanca`):** Consulta e cadastro em `Tipo_Cabo`/`Tipo_Equipamento`, console em tempo real (`AuditStreamClient` via SSE + fallback `since_id`), saúde SQL (`vw_resumo_projetos_corporativos`) e **Inspetor Didático JWT**.
  6. **Workspace GIS Interativo (`/workspace`):** Mapa escuro (Google Maps API com *fallback* OpenStreetMap/Leaflet), ferramentas (`V`, `L`, `P`, `C`, `E`, `O`, `D`), inspector editável de `Ponto_Rede`, seletor de nó raiz (Prim), restauração *Soft Delete*, troca rápida de projeto/status/perfil e gaveta flutuante **Logs Ao Vivo**.
  7. **Central de Ajuda (`/ajuda`):** Guia operacional de atalhos, matriz RBAC e governança histórica.

---

## 3. Planejamento e Gestão Ágil (Scrumban)

- **Metodologia:** **Scrumban** (Sprints iterativas de 2 semanas + quadro Kanban contínuo: `A Fazer` → `Em Andamento (WIP <= 3)` → `Em Revisão / Testes` → `Concluído`).
- **Organização Git/GitHub:** Branches temáticas (`feat/auth-criptografia`, `feat/mst-metricas-polylines`, `feat/bugfix-melhorias`, `feat/boas-praticas-prog-web`) integradas na `main` com commits semânticos (*Conventional Commits*).

---

## 4. Levantamento de Requisitos

### 4.1 Requisitos Funcionais (RF)
- **RF01:** Cadastrar engenheiros com validação de CPF, CREA único, força de senha e emissão de OTP de 6 dígitos.
- **RF02:** Autenticar usuários com hash `bcrypt` e emitir token JWT (`HS256`) com revogação por `jti` no logout.
- **RF03:** Criar, listar, renomear (`PATCH /api/projetos/{id}`) e alterar status de projetos respeitando isolamento *multi-tenant*.
- **RF04:** Inserir, mover e remover logicamente (*Soft Delete*) ativos `Ponto_Rede` no mapa GIS.
- **RF05:** Calcular a Árvore Geradora Mínima Constrita (**Algoritmo de Prim**) com suporte a *Snap Viário* e atualização memoizada O(1) de `Metragem_Total` e `Custo_Estimado`.

### 4.2 Requisitos Não Funcionais (RNF) e Regras de Negócio
- **RNF01 (Segurança):** Senhas exclusivamente em `bcrypt`, JWT assinado em servidor, headers OWASP (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`), `.env` isolado no `.gitignore` e bloqueio de gravação de dados sensíveis (`senha`, `cpf`) no Web Storage.
- **RNF02 (Semântica e Acessibilidade):** HTML5 semântico (`<h1>` único por página, `<fieldset>/<legend>`, `<label htmlFor>`, `<abbr>`, `<kbd>`, `<address>`), CSS externo com tokens `:root`, foco visível (`:focus-visible`) e layout Mobile-First.
- **RN01 (Governança):** Projetos `Concluído` ou `Cancelado` são imutáveis; exclusão de `Ponto_Rede` com trechos ativos exige recálculo topológico (`ON DELETE RESTRICT`); todo projeto exige vínculo válido `Empresa <-> Engenheiro (CREA) <-> Projeto`.

---

## 5. Modelagem e Implementação do Banco de Dados (3FN + POO)

- **Modelagem Documentada:** Ver PDFs em [`docs/`](.) (`Documentacao_Modelagem_Conceitual.pdf`, `Documentacao_Modelagem_Logica.pdf`, `Documentacao_Modelagem_Fisica.pdf`, `Documentacao_Arquitetura_de_Banco_de_Dados.pdf`).
- **11 Tabelas Relacionais em 3FN:** `Empresa`, `Usuario`, `Engenheiro` (especialização 1:1 `(p, d)`), `Vincula` (`M:N` RBAC), `Tipo_Equipamento` (3FN), `Tipo_Cabo` (3FN), `Projeto`, `Ponto_Rede`, `Contem` (`M:N` com *Soft Delete*), `Trecho_Rede` (arestas com `CHECK (Origem_ID <> Destino_ID)` e `ON DELETE RESTRICT`) e `Log_Auditoria`.
- **Scripts SQL Oficiais (PostgreSQL + PostGIS):**
  - [`database/schema_postgis.sql`](../database/schema_postgis.sql) e [`database/seed.sql`](../database/seed.sql) com extensões `postgis` e `pgrouting`, 6 `ENUM`s, 11 tabelas em 3FN (`Log_Auditoria` incluída), índices espaciais `GIST` e `B-Tree`, 3 views (`vw_*`), 2 functions PL/pgSQL (`fn_*`), 3 triggers (`trg_*`), 2 procedures transacionais (`sp_*`) e referência DCL (`CREATE ROLE`/`GRANT`/`REVOKE`).
- **Camada de Acesso a Dados em Python POO (`DatabaseManagerBase`):** [`backend/database_manager.py`](../backend/database_manager.py) e [`backend/repositories/sql_repository.py`](../backend/repositories/sql_repository.py) implementam classe abstrata `ABC`, encapsulamento (`_conn`, `_cursor`), gerenciador de contexto transacional (`__enter__`/`__exit__`) e subclasses polimórficas `PostgresDatabaseManager` (`psycopg2` + `RealDictCursor` para PostgreSQL + PostGIS) e `SQLiteDatabaseManager` (`sqlite3` ACID com `PRAGMA foreign_keys = ON` como *fallback* local sem servidor externo).

---

## 6. Arquitetura da Solução e Integração das 3 Camadas

1. **Apresentação (Frontend React 19 + Vite + Tailwind + Leaflet/Google Maps):** [`src/pages/`](../src/pages/), [`src/components/`](../src/components/), [`src/styles/tokens.css`](../src/styles/tokens.css).
2. **Serviços e Comunicação HTTP (Frontend):** [`src/api/client.js`](../src/api/client.js), [`src/services/geocodingService.js`](../src/services/geocodingService.js), [`src/utils/storage.js`](../src/utils/storage.js), [`src/utils/validators.js`](../src/utils/validators.js).
3. **API e Regras de Negócio (Backend FastAPI):** [`backend/controllers/`](../backend/controllers/), [`backend/services/`](../backend/services/), [`backend/models/schemas.py`](../backend/models/schemas.py).
4. **Persistência SQL (Backend Repository):** [`backend/repositories/sql_repository.py`](../backend/repositories/sql_repository.py) conectado ao banco relacional configurado no `.env`, verificável ao vivo em `GET /api/health/db`.

---

## 7. Testes Realizados e Qualidade

- **Suíte Automatizada (`backend/tests/` — 47 testes):**
  - `test_prim_service.py`: 18 testes de robustez do Algoritmo de Prim, restrições físicas, `NaN/Inf`, ilhas topológicas e performance com 100 nós.
  - `test_governanca_backend.py`: 8 testes de isolamento *multi-tenant*, RBAC, especialização CREA, *Soft Delete* (`RESTRICT`) e imutabilidade histórica.
  - `test_security_auth.py`: 9 testes de `bcrypt`, JWT `HS256`, expiração, *Rate Limiting* (HTTP 429), revogação `jti` no logout e OTP.
  - `test_workspace_fluxo_completo.py`: 7 testes integrados de fluxo completo do workspace e registro com vínculo.
  - `test_database_sql_integracao.py`: 5 testes de POO (`DatabaseManagerBase`), transações ACID com rollback, persistência SQL real, edição completa de ponto + restauração *Soft Delete*, catálogo 3FN, isolamento de auditoria entre empresas e stream `since_id`.
- **POO no Front-End (ES6) e Back-End (Python):** Classes ES6 encapsuladas `TabSessionManager` ([`src/utils/sessionVault.js`](../src/utils/sessionVault.js)) para isolamento de sessão por aba e `AuditStreamClient` ([`src/utils/auditStreamClient.js`](../src/utils/auditStreamClient.js)) para streaming em tempo real, integradas às classes Python `DatabaseManagerBase` / `InfraRouteSQLRepository`.
- **Build de Produção Frontend:** `vite build` validando compilação de CSS, JSX, Leaflet e bundles otimizados.

---

## 8. Implantação e Instruções de Execução Local

1. Copiar `.env.example` para `.env` na raiz (já configurado para uso local imediato com SQLite ACID e Leaflet/OSM gratuito).
2. Backend:
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
3. Frontend:
   ```powershell
   npm.cmd run dev -- --host 127.0.0.1 --port 5173
   ```
4. Verificação de Saúde SQL: `http://127.0.0.1:8000/api/health/db` e Swagger UI em `http://127.0.0.1:8000/docs`.

---

## 9. Manutenções / Evoluções Futuras e Considerações Finais

- **Evoluções Pós-MVP:** Exportação de projeto em GeoJSON/KML/DXF, cálculo de balanço de potência óptica (*Optical Link Budget* GPON/XGS-PON) e execução direta de roteamento espacial pgRouting no servidor PostGIS em nuvem.
- **Considerações Finais:** O InfraRoute integra rigor de modelagem relacional (3FN, POO DB-API, PostgreSQL + PostGIS com *fallback* local SQLite ACID), algoritmos clássicos de grafos (Prim) e boas práticas modernas de desenvolvimento Web seguro e acessível.

---

## 10. Pendências, Ajustes Finais e Roteiro para Apresentação Final (03/12 e 04/12)

### 10.1 O que já está finalizado
- [x] Front-end completo (`/cadastro`, `/login`, `/projetos`, `/workspace`) com HTML5 semântico, tokens CSS, Mobile-First, Web Storage seguro e mapa GIS interativo funcional mesmo sem chave paga do Google Maps (fallback Leaflet/OSM).
- [x] Back-end FastAPI em camadas (`controllers`, `services`, `models`, `repositories`) com autenticação `bcrypt` + JWT `HS256`, revogação no logout, *Rate Limiting*, OTP e Algoritmo de Prim com *Snap Viário*.
- [x] Banco de dados relacional SQL conectado e ativo por padrão via `InfraRouteSQLRepository` (`DatabaseManagerBase`), com script completo em PostgreSQL + PostGIS ([`database/schema_postgis.sql`](../database/schema_postgis.sql) + [`database/seed.sql`](../database/seed.sql)) e fallback local SQLite ACID.
- [x] Suíte de testes automatizados cobrindo segurança, governança, grafos e persistência SQL.

### 10.2 Pendências e Ajustes Administrativos para a Banca
1. **Documentos Acadêmicos Institucionais (Preenchimento pelo Grupo):**
   - Preencher os nomes completos e RAs dos integrantes no arquivo `.docx` oficial do **Documento Padrão da Disciplina** (usando o conteúdo técnico deste documento como base);
   - Anexar a **Declaração de Participação do Parceiro Externo** assinada eletronicamente, o **Relatório de Extensão** e a **Ficha de Registro de Atividades (45h)** no Canvas.
2. **Captura de Evidências (Prints) no Documento Final:**
   - Inserir capturas de tela da aplicação rodando localmente (`/login`, `/projetos`, `/workspace` com traçado viário da AGM) e do terminal executando a suíte de testes unitários e `GET /api/health/db`.
3. **Roteiro de Demonstração na Apresentação Final (8 min ± 2 min — 2 Abas Lado a Lado):**
   - **Minutos 0–2:** Problema real, ODS (8, 9, 11, 12) e arquitetura 3 camadas + modelagem 3FN (PostgreSQL + PostGIS / SQLite ACID).
   - **Minutos 2–5 (Aba 1 — `Projetista` ou `Admin`):** Login → Cadastro/Renomeação em `/projetos` → Abertura no Mapa GIS (`/workspace`), inserção e edição de ativos (`P`, `C`, `E`, `O`), cálculo de `Calcular Malha Otimizada` (`Snap ON` vs `Snap OFF`), *Soft Delete* com restauração e exportação de **Memorial / BOM / GeoJSON**.
   - **Minutos 5–7 (Aba 2 — `Auditor Visualizador` ou `Admin` em `/governanca`):** Demonstração em tempo real dos logs chegando (`PONTO_CRIADO`, `MST_CALCULADA`, `ACESSO_NEGADO_RBAC` 403), troca para `Gestor ConectaSul` (Empresa 2) comprovando isolamento *Multi-Tenant*, **Inspetor JWT** (Aula 15) e `GET /api/health/db`.
   - **Minutos 7–8:** Conclusão, métricas de economia de material e evolução futura.
