import { Modal } from "./ui/Modal";

/**
 * Modal de leitura dos Termos de Uso e Governança de Projetos da plataforma InfraRoute.
 */
export function TermsOfUseModal({ open, onClose, onAccept }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      title="Termos de Uso e Governança de Projetos"
      subtitle="InfraRoute Engenharia de Redes · Versão 1.0 (Novembro de 2026)"
      closeLabel="Fechar termos de uso"
    >
      <article className="max-h-[60vh] space-y-4 overflow-y-auto pr-2 text-xs leading-6 text-slate-700">
        <p className="m-0 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-slate-800">
          Leia atentamente as condições abaixo antes de concluir seu cadastro na plataforma{" "}
          <strong>InfraRoute</strong>. Ao aceitar este termo, você concorda com as regras
          técnicas, de segurança e de governança corporativa descritas a seguir.
        </p>

        <section aria-labelledby="termos-sec-1" className="space-y-1.5">
          <h3 id="termos-sec-1" className="text-sm font-bold text-slate-900">
            1. Objeto e Escopo Técnico
          </h3>
          <p className="m-0">
            A plataforma InfraRoute destina-se exclusivamente ao planejamento geoespacial de redes
            ópticas externas (<abbr title="Outside Plant (Planta Externa)">OSP</abbr> /{" "}
            <abbr title="Fiber to the Home">FTTH</abbr>), ao cálculo de otimização topológica via{" "}
            <abbr title="Árvore Geradora Mínima">AGM</abbr> (Algoritmo de Prim) e à geração de
            orçamentos estimados (<abbr title="Bill of Materials">BOM</abbr>) e memoriais descritivos.
          </p>
        </section>

        <section aria-labelledby="termos-sec-2" className="space-y-1.5">
          <h3 id="termos-sec-2" className="text-sm font-bold text-slate-900">
            2. Veracidade Cadastral e Responsabilidade Técnica
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5">
            <li>
              O usuário declara que os dados fornecidos (nome completo, e-mail corporativo,{" "}
              <abbr title="Cadastro de Pessoas Físicas">CPF</abbr> e registro no{" "}
              <abbr title="Conselho Regional de Engenharia e Agronomia">CREA</abbr>) são verdadeiros,
              atuais e pertencem à sua titularidade.
            </li>
            <li>
              Projetos assinados ou alterados por engenheiros vinculados respondem às normas técnicas
              aplicáveis à planta externa e às diretrizes da concessionária ou provedor contratante.
            </li>
          </ul>
        </section>

        <section aria-labelledby="termos-sec-3" className="space-y-1.5">
          <h3 id="termos-sec-3" className="text-sm font-bold text-slate-900">
            3. Isolamento Multi-Tenant e Controle de Acesso (RBAC)
          </h3>
          <p className="m-0">
            Cada organização (<em>tenant</em>) possui escopo isolado de projetos, ativos e registros.
            As permissões de leitura, criação, edição e administração seguem estritamente o perfil{" "}
            <abbr title="Role-Based Access Control">RBAC</abbr> atribuído à conta (
            <strong>Administrador</strong>, <strong>Projetista</strong>,{" "}
            <strong>Visualizador</strong> ou <strong>SuperAdmin</strong>), sendo vedada qualquer
            tentativa de acesso a dados de terceiros.
          </p>
        </section>

        <section aria-labelledby="termos-sec-4" className="space-y-1.5">
          <h3 id="termos-sec-4" className="text-sm font-bold text-slate-900">
            4. Imutabilidade Histórica, Soft Delete e Auditoria
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5">
            <li>
              Projetos encerrados nos status <strong>Concluído</strong> ou{" "}
              <strong>Cancelado</strong> tornam-se imutáveis para preservar o histórico técnico e
              orçamentário para fins de auditoria.
            </li>
            <li>
              A remoção de postes ou caixas ópticas em projetos ativos é executada por exclusão
              lógica (<em>Soft Delete</em>), mantendo registro histórico e possibilidade de
              restauração.
            </li>
            <li>
              Operações autenticadas e tentativas bloqueadas de acesso são registradas em trilha de
              auditoria com carimbo temporal em{" "}
              <time dateTime="2026-11-25">UTC / Horário de Brasília (BRT)</time>.
            </li>
          </ul>
        </section>

        <section aria-labelledby="termos-sec-5" className="space-y-1.5">
          <h3 id="termos-sec-5" className="text-sm font-bold text-slate-900">
            5. Privacidade e Conformidade com a LGPD
          </h3>
          <p className="m-0">
            Em alinhamento à Lei Geral de Proteção de Dados (
            <abbr title="Lei Geral de Proteção de Dados — Lei nº 13.709/2018">LGPD</abbr>), senhas
            são armazenadas exclusivamente sob hash criptográfico seguro (<code>bcrypt</code>), o
            <abbr title="Cadastro de Pessoas Físicas">CPF</abbr> é mascarado em consultas de
            governança e nenhum dado sensível (senha ou CPF) é gravado no Web Storage do navegador
            ou no payload de tokens <abbr title="JSON Web Token">JWT</abbr>.
          </p>
        </section>

        <section aria-labelledby="termos-sec-6" className="space-y-1.5">
          <h3 id="termos-sec-6" className="text-sm font-bold text-slate-900">
            6. Natureza Estimativa de Orçamentos e Traçados Viários
          </h3>
          <p className="m-0">
            As metragens geodésicas ou roteadas pela malha viária e os valores de{" "}
            <abbr title="Capital Expenditure">CAPEX</abbr> constituem estimativas de engenharia de
            pré-projeto. A execução em campo deve ser validada por vistoria técnica e aprovação dos
            órgãos ou concessionárias detentoras dos postes.
          </p>
        </section>

        <section aria-labelledby="termos-sec-7" className="space-y-1.5">
          <h3 id="termos-sec-7" className="text-sm font-bold text-slate-900">
            7. Suporte e Vigência
          </h3>
          <p className="m-0">
            Dúvidas sobre governança, segurança ou solicitação de revisão cadastral podem ser
            encaminhadas para{" "}
            <a
              className="font-medium text-blue-700 hover:underline"
              href="mailto:suporte@infraroute.com.br"
            >
              suporte@infraroute.com.br
            </a>
            . O aceite eletrônico no formulário de cadastro formaliza a ciência e concordância
            integral com estas condições.
          </p>
        </section>
      </article>

      <footer className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Fechar
        </button>
        {onAccept && (
          <button
            type="button"
            onClick={onAccept}
            className="min-h-10 cursor-pointer rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Li e aceito os termos
          </button>
        )}
      </footer>
    </Modal>
  );
}
