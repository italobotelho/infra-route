import { useEffect } from "react";
import { WorkspaceNavigationSidebarSection } from "../Projetos/components/WorkspaceNavigationSidebarSection";

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

export default function Ajuda() {
  useEffect(() => {
    document.title = "Central de Ajuda & Guia de Engenharia | InfraRoute";
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-start bg-gray-50 text-gray-900 lg:flex-row">
      <WorkspaceNavigationSidebarSection />
      <main className="flex flex-1 flex-col gap-6 self-stretch p-4 sm:p-6 lg:p-8">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Manual Técnico Operacional OSP / FTTH
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Central de Ajuda & Boas Práticas
          </h1>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section
            aria-labelledby="shortcuts-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="shortcuts-heading" className="text-base font-bold text-slate-900">
              Atalhos de Teclado do Workspace GIS
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
                  {SHORTCUTS.map((item) => (
                    <tr key={item.key} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                          {item.key}
                        </kbd>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{item.action}</td>
                    </tr>
                  ))}
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
                Matriz de Permissões RBAC & CREA
              </h2>
              <ul className="mt-3 space-y-2.5 text-xs leading-5 text-slate-700">
                <li>
                  <strong>Administrador:</strong> cria/edita projetos e topologia, altera status, gerencia ativos e cadastra novos modelos no catálogo 3FN.
                </li>
                <li>
                  <strong>Projetista (CREA obrigatório):</strong> cria e edita seus projetos, posiciona ativos e calcula Árvore Geradora Mínima (Prim).
                </li>
                <li>
                  <strong>Visualizador:</strong> acesso somente leitura para auditoria em `/dashboard`, `/projetos`, `/governanca` e `/workspace` (bloqueado em mutações via HTTP 403).
                </li>
              </ul>
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
                  <strong>Imutabilidade Histórica:</strong> projetos marcados como <code>Concluído</code> ou <code>Cancelado</code> ficam congelados contra renomeações, inserções ou recálculos de custo.
                </li>
                <li>
                  <strong>Exclusão Lógica (Soft Delete):</strong> pontos removidos passam para <code>Removido</code> na tabela associativa <code>Contem</code>, preservando o histórico no banco e permitindo restauração na camada <em>Histórico Removidos</em> do mapa.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
