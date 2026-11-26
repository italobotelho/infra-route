import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSession } from "../../lib/api";

const SHORTCUTS = [
  { key: "V", action: "Selecionar, inspecionar ou arrastar ativos no mapa" },
  { key: "L", action: "Lasso em área (clique em dois cantos opostos)" },
  { key: "P", action: "Inserir Poste de passagem (R$ 0,00)" },
  { key: "C", action: "Inserir Caixa de Terminação Óptica — CTO (R$ 380,00)" },
  { key: "E", action: "Inserir Caixa de Emenda Óptica — CEO (R$ 520,00)" },
  { key: "O", action: "Inserir Switch / OLT Central Huawei (R$ 2.450,00)" },
  { key: "D", action: "Inspecionar enlace óptico entre dois nós" },
  { key: "S", action: "Alternar Snap Viário (ruas reais OSM vs geodésico)" },
  { key: "Delete", action: "Remover logicamente (Soft Delete) os ativos selecionados" },
  { key: "Esc", action: "Limpar seleção e retornar para a ferramenta Selecionar" },
];

const RBAC_ROLES = [
  {
    role: "SuperAdmin",
    summary:
      "Visão global multi-empresa para auditoria, saúde SQL e telemetria HTTP; acesso somente leitura em projetos para preservar governança.",
  },
  {
    role: "Administrador",
    summary:
      "Cria e edita projetos e topologia, altera status do ciclo de vida, gerencia ativos, consulta logs da própria empresa e cadastra cabos no catálogo 3FN.",
  },
  {
    role: "Projetista",
    summary:
      "CREA obrigatório. Cria e edita projetos da empresa, posiciona ativos e calcula a Árvore Geradora Mínima (Prim), sem acesso a logs de auditoria (LGPD).",
  },
  {
    role: "Visualizador",
    summary:
      "Acesso somente leitura para auditoria em Dashboard, Projetos, Governança e Workspace GIS (mutações bloqueadas via HTTP 403).",
  },
];

const FAQ_ITEMS = [
  {
    question: "Como funciona o Snap Viário (S) no cálculo da Árvore Geradora Mínima?",
    answer:
      "Quando o Snap Viário está ativado, as arestas candidatas entre postes e caixas seguem o traçado real das ruas (OSM) antes do algoritmo de Prim selecionar a árvore de menor custo. Quando desativado, usa distância geodésica direta.",
  },
  {
    question: "Como restaurar um poste ou caixa removida por engano?",
    answer:
      "No Workspace GIS, ative a camada 'Histórico Removidos (Soft Delete)' no Gerenciador de Camadas da barra lateral, clique no marcador tracejado no mapa e selecione 'Restaurar Ativo na Rede'.",
  },
  {
    question: "Por que não consigo renomear ou editar um projeto Concluído ou Cancelado?",
    answer:
      "Por imutabilidade histórica de auditoria, projetos Concluídos ou Cancelados são congelados automaticamente contra alterações de nome, inserções de ativos ou recálculos de CAPEX.",
  },
  {
    question: "Como usar a busca rápida entre telas e projetos?",
    answer:
      "Pressione Ctrl+K (ou Cmd+K no macOS) em qualquer tela administrativa, ou clique em 'Busca rápida...' na barra lateral para saltar para outra rota ou abrir um projeto direto no GIS.",
  },
];

export default function Ajuda() {
  const session = getSession();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    document.title = "Central de Ajuda & Guia de Engenharia | InfraRoute";
  }, []);

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter((item) =>
      `${item.key} ${item.action}`.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const filteredFaq = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter((item) =>
      `${item.question} ${item.answer}`.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  return (
    <main className="flex flex-1 flex-col gap-6 self-stretch p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5">
        <nav aria-label="Breadcrumb">
          <ol className="m-0 inline-flex list-none items-center gap-2 p-0 text-xs text-slate-600">
            <li>
              <Link to="/dashboard" className="font-medium text-slate-600 hover:text-blue-700 hover:underline">
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-slate-900">
              Central de Ajuda
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Manual Técnico Operacional <abbr title="Outside Plant (Planta Externa)">OSP</abbr> /{" "}
              <abbr title="Fiber to the Home">FTTH</abbr>
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Central de Ajuda & Boas Práticas
            </h1>
          </div>

          <label
            htmlFor="help-search"
            className="flex h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 sm:w-72"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.8-3.8" />
            </svg>
            <span className="sr-only">Buscar atalhos ou dúvidas</span>
            <input
              id="help-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar atalho, Snap, Soft Delete..."
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none"
            />
          </label>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section
          aria-labelledby="shortcuts-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 id="shortcuts-heading" className="text-base font-bold text-slate-900">
            Atalhos de Teclado do Workspace <abbr title="Sistema de Informações Geográficas">GIS</abbr>
          </h2>
          <div className="tabela-wrap mt-3 rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">Lista de atalhos de teclado da tela Workspace</caption>
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">Tecla</th>
                  <th scope="col" className="px-3 py-2">Função no Mapa</th>
                </tr>
              </thead>
              <tbody>
                {filteredShortcuts.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-5 text-center text-slate-500">
                      Nenhum atalho encontrado para "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredShortcuts.map((item) => (
                    <tr key={item.key} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                          {item.key}
                        </kbd>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{item.action}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="rbac-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="rbac-heading" className="text-base font-bold text-slate-900">
              Matriz de Permissões <abbr title="Role-Based Access Control">RBAC</abbr> &{" "}
              <abbr title="Conselho Regional de Engenharia e Agronomia">CREA</abbr>
            </h2>
            <dl className="m-0 mt-3 space-y-2.5 p-0 text-xs leading-5 text-slate-700">
              {RBAC_ROLES.map((item) => {
                const isCurrent = session?.nivel_acesso === item.role;
                return (
                  <div
                    key={item.role}
                    className={`rounded-xl border p-3 ${
                      isCurrent
                        ? "border-blue-300 bg-blue-50/70 text-slate-900"
                        : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <dt className="flex flex-wrap items-center gap-2 font-bold">
                      <span>{item.role}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Seu perfil atual
                        </span>
                      )}
                    </dt>
                    <dd className="m-0 mt-1 text-slate-600">{item.summary}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-[11px] text-slate-500">
              Rotas protegidas por perfil: <code>/dashboard</code>, <code>/projetos</code>,{" "}
              <code>/governanca</code> e <code>/workspace</code>.
            </p>
          </section>

          <section
            aria-labelledby="lifecycle-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="lifecycle-heading" className="text-base font-bold text-slate-900">
              Governança Histórica & Soft Delete
            </h2>
            <ul className="mt-3 space-y-2.5 text-xs leading-5 text-slate-700">
              <li>
                <strong>Imutabilidade Histórica:</strong> projetos marcados como{" "}
                <code>Concluído</code> ou <code>Cancelado</code> ficam congelados contra
                renomeações, inserções ou recálculos de custo.
              </li>
              <li>
                <strong>Exclusão Lógica (Soft Delete):</strong> pontos removidos passam para{" "}
                <code>Removido</code> na tabela associativa <code>Contem</code>, preservando o
                histórico no banco e permitindo restauração na camada <em>Histórico Removidos</em>{" "}
                do mapa.
              </li>
            </ul>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="faq-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="faq-heading" className="text-base font-bold text-slate-900">
          Perguntas Frequentes (FAQ)
        </h2>
        <div className="mt-3 space-y-2">
          {filteredFaq.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nenhum tópico de dúvida encontrado para "{searchQuery}".
            </p>
          ) : (
            filteredFaq.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 open:border-blue-200 open:bg-blue-50/30"
              >
                <summary className="cursor-pointer list-none text-xs font-semibold text-slate-900 marker:hidden">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="text-blue-600 transition group-open:rotate-90">
                      ▸
                    </span>
                    <span>{faq.question}</span>
                  </span>
                </summary>
                <p className="m-0 mt-2 pl-4 text-xs leading-5 text-slate-700">{faq.answer}</p>
              </details>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
