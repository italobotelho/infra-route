import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, getSession, saveSession } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";
import { formatarDataHoraBr } from "../../utils/dateTime";
import { STORAGE_KEYS, removeStorageItem } from "../../utils/storage";

function StatusBadge({ status }) {
  const styles = {
    PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
    ACEITO: "bg-emerald-100 text-emerald-800 border-emerald-200",
    RECUSADO: "bg-rose-100 text-rose-800 border-rose-200",
    CANCELADO: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] || styles.CANCELADO
      }`}
    >
      {status}
    </span>
  );
}

export default function Equipe() {
  const { showToast } = useToast();
  const [session, setSession] = useState(() => getSession());
  const isAdmin = session?.nivel_acesso === "Administrador";

  const [empresas, setEmpresas] = useState([]);
  const [recebidos, setRecebidos] = useState([]);
  const [enviados, setEnviados] = useState([]);
  const [membros, setMembros] = useState({ membros_empresa: [], participantes_projetos: [] });
  const [projetosEmpresa, setProjetosEmpresa] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário de convite (Admin)
  const [tipoConvite, setTipoConvite] = useState("EMPRESA");
  const [emailConvidado, setEmailConvidado] = useState("");
  const [nivelAcesso, setNivelAcesso] = useState("Projetista");
  const [idProjetoSelecionado, setIdProjetoSelecionado] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarDados = useCallback(async () => {
    const sessaoAtual = getSession();
    setSession(sessaoAtual);
    if (!sessaoAtual) return;

    setLoading(true);
    try {
      const reqs = [
        apiRequest("/colaboracao/empresas"),
        apiRequest("/colaboracao/convites/recebidos"),
        apiRequest("/colaboracao/membros"),
      ];
      if (sessaoAtual.nivel_acesso === "Administrador") {
        reqs.push(apiRequest("/colaboracao/convites/enviados"));
        reqs.push(
          apiRequest(
            `/projetos?id_empresa=${sessaoAtual.id_empresa_padrao}&id_usuario_autor=${sessaoAtual.id_usuario}`,
          ),
        );
      }

      const [emps, recs, mems, envs, projs] = await Promise.all(reqs);
      setEmpresas(Array.isArray(emps) ? emps : []);
      setRecebidos(Array.isArray(recs) ? recs : []);
      setMembros(mems || { membros_empresa: [], participantes_projetos: [] });
      if (sessaoAtual.nivel_acesso === "Administrador") {
        setEnviados(Array.isArray(envs) ? envs : []);
        const listaProjs = (Array.isArray(projs) ? projs : []).filter(
          (p) => p.id_empresa === sessaoAtual.id_empresa_padrao,
        );
        setProjetosEmpresa(listaProjs);
        if (listaProjs.length > 0 && !idProjetoSelecionado) {
          setIdProjetoSelecionado(String(listaProjs[0].id_projeto));
        }
      } else {
        setEnviados([]);
        setProjetosEmpresa([]);
      }
    } catch (err) {
      showToast(err.message || "Erro ao carregar dados de colaboração.", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [idProjetoSelecionado, showToast]);

  useEffect(() => {
    document.title = "Equipe & Convites | InfraRoute — Colaboração Multi-Empresa";
    carregarDados();
  }, [carregarDados]);

  const convitesPendentes = useMemo(
    () => recebidos.filter((c) => c.status === "PENDENTE"),
    [recebidos],
  );

  const handleTrocarEmpresa = async (idEmpresaDestino) => {
    try {
      removeStorageItem(STORAGE_KEYS.UI_ACTIVE_COMPANY_SCOPE);
      const novaSessao = await apiRequest("/colaboracao/trocar-empresa", {
        method: "POST",
        body: JSON.stringify({ id_empresa: Number(idEmpresaDestino) }),
      });
      saveSession(novaSessao);
      showToast(`Empresa ativa alternada para ${novaSessao.razao_social_empresa}.`, {
        type: "success",
      });
      window.location.reload();
    } catch (err) {
      showToast(err.message || "Não foi possível alternar a empresa.", { type: "error" });
    }
  };

  const handleEnviarConvite = async (e) => {
    e.preventDefault();
    if (!emailConvidado.trim()) {
      showToast("Informe o e-mail do usuário cadastrado.", { type: "warning" });
      return;
    }
    if (tipoConvite === "PROJETO" && !idProjetoSelecionado) {
      showToast("Selecione um projeto da empresa ativa.", { type: "warning" });
      return;
    }

    setEnviando(true);
    try {
      await apiRequest("/colaboracao/convites", {
        method: "POST",
        body: JSON.stringify({
          tipo_convite: tipoConvite,
          email_convidado: emailConvidado.trim(),
          nivel_acesso:
            tipoConvite === "PROJETO" && nivelAcesso === "Administrador"
              ? "Projetista"
              : nivelAcesso,
          id_projeto: tipoConvite === "PROJETO" ? Number(idProjetoSelecionado) : null,
          mensagem: mensagem.trim() || null,
        }),
      });
      setEmailConvidado("");
      setMensagem("");
      showToast("Convite enviado com sucesso!", { type: "success" });
      await carregarDados();
    } catch (err) {
      showToast(err.message || "Erro ao enviar convite.", { type: "error" });
    } finally {
      setEnviando(false);
    }
  };

  const handleResponderConvite = async (idConvite, aceitar) => {
    try {
      const res = await apiRequest(`/colaboracao/convites/${idConvite}/responder`, {
        method: "POST",
        body: JSON.stringify({ aceitar }),
      });
      if (res?.sessao) {
        saveSession(res.sessao);
        setSession(res.sessao);
      }
      showToast(
        aceitar
          ? "Convite aceito! Seu acesso foi liberado."
          : "Convite recusado.",
        { type: aceitar ? "success" : "info" },
      );
      window.dispatchEvent(new Event("infraroute:colaboracao-updated"));
      await carregarDados();
    } catch (err) {
      showToast(err.message || "Erro ao responder convite.", { type: "error" });
    }
  };

  const handleCancelarConvite = async (idConvite) => {
    try {
      await apiRequest(`/colaboracao/convites/${idConvite}/cancelar`, {
        method: "POST",
      });
      showToast("Convite cancelado.", { type: "info" });
      await carregarDados();
    } catch (err) {
      showToast(err.message || "Erro ao cancelar convite.", { type: "error" });
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-6 self-stretch p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5">
        <nav aria-label="Breadcrumb">
          <ol className="m-0 inline-flex list-none items-center gap-2 p-0 text-xs text-slate-600">
            <li>
              <Link to="/projetos" className="font-medium text-slate-600 hover:text-blue-700 hover:underline">
                Projetos
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-slate-900">
              Equipe & Convites
            </li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">
              Colaboração Multi-Empresa & Convites
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Empresa ativa: <strong>{session?.razao_social_empresa}</strong> · Perfil:{" "}
              <span className="font-semibold text-blue-700">{session?.nivel_acesso}</span>
            </p>
          </div>
          {convitesPendentes.length > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800">
              {convitesPendentes.length} convite(s) pendente(s) para você
            </span>
          )}
        </div>
      </header>

      {/* Convites Recebidos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="m-0 text-base font-bold text-slate-900">Convites Recebidos</h2>
        <p className="mt-1 text-xs text-slate-600">
          Ao aceitar um convite de grupo/empresa ou projeto, você passa a ter acesso imediato ao recurso.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando convites...</p>
        ) : recebidos.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Você ainda não recebeu convites de colaboração.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {recebidos.map((conv) => (
              <div
                key={conv.id_convite}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${
                  conv.status === "PENDENTE"
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                      {conv.tipo_convite === "PROJETO" ? "PROJETO" : "GRUPO / EMPRESA"}
                    </span>
                    <StatusBadge status={conv.status} />
                    <span className="text-sm font-semibold text-slate-900">
                      {conv.tipo_convite === "PROJETO"
                        ? `${conv.nome_projeto} (${conv.razao_social_empresa})`
                        : conv.razao_social_empresa}
                    </span>
                  </div>
                  <p className="m-0 text-xs text-slate-600">
                    Convidado por <strong>{conv.nome_convidante}</strong> ({conv.email_convidante}) · Papel:{" "}
                    <strong>{conv.nivel_acesso}</strong> · {formatarDataHoraBr(conv.data_criacao)}
                  </p>
                  {conv.mensagem && (
                    <p className="m-0 mt-1 text-xs italic text-slate-700">“{conv.mensagem}”</p>
                  )}
                </div>

                {conv.status === "PENDENTE" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResponderConvite(conv.id_convite, true)}
                      className="cursor-pointer rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Aceitar convite
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResponderConvite(conv.id_convite, false)}
                      className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Recusar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Minhas Empresas Vinculadas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="m-0 text-base font-bold text-slate-900">Empresas Vinculadas à Sua Conta</h2>
        <p className="mt-1 text-xs text-slate-600">
          Um engenheiro pode atuar em múltiplas empresas. Selecione qual empresa deseja manter ativa.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {empresas.map((emp) => (
            <div
              key={emp.id_empresa}
              className={`flex flex-col justify-between gap-3 rounded-xl border p-4 ${
                emp.ativa
                  ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30"
                  : "border-slate-200 bg-slate-50/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm text-slate-900">{emp.razao_social}</strong>
                  {emp.ativa && (
                    <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      ATIVA
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">CNPJ: {emp.cnpj}</p>
                <p className="mt-0.5 text-xs text-slate-700">
                  Papel: <strong>{emp.nivel_acesso}</strong>
                </p>
              </div>
              {!emp.ativa && (
                <button
                  type="button"
                  onClick={() => handleTrocarEmpresa(emp.id_empresa)}
                  className="cursor-pointer rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Alternar para esta empresa
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Formulário de Convite (Apenas Administrador) */}
      {isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 text-base font-bold text-slate-900">
            Convidar Usuário (Grupo ou Projeto)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Como <strong>Administrador</strong> de <strong>{session?.razao_social_empresa}</strong>, você pode convidar engenheiros ou analistas para toda a empresa ou para um projeto específico.
          </p>

          <form onSubmit={handleEnviarConvite} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTipoConvite("EMPRESA")}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold transition ${
                  tipoConvite === "EMPRESA"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Convite para Grupo / Empresa
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoConvite("PROJETO");
                  if (nivelAcesso === "Administrador") setNivelAcesso("Projetista");
                }}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold transition ${
                  tipoConvite === "PROJETO"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Convite para Projeto Específico
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="convite-email" className="text-xs font-semibold text-slate-800">
                E-mail do usuário cadastrado
              </label>
              <input
                id="convite-email"
                type="email"
                required
                placeholder="ex.: projetista@empresa.com.br"
                value={emailConvidado}
                onChange={(e) => setEmailConvidado(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="convite-papel" className="text-xs font-semibold text-slate-800">
                Permissão concedida ao aceitar
              </label>
              <select
                id="convite-papel"
                value={nivelAcesso}
                onChange={(e) => setNivelAcesso(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                {tipoConvite === "EMPRESA" && <option value="Administrador">Administrador</option>}
                <option value="Projetista">Projetista</option>
                <option value="Visualizador">Visualizador (Somente Leitura)</option>
              </select>
            </div>

            {tipoConvite === "PROJETO" && (
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label htmlFor="convite-projeto" className="text-xs font-semibold text-slate-800">
                  Projeto de destino
                </label>
                {projetosEmpresa.length === 0 ? (
                  <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                    Esta empresa ainda não possui projetos. Crie um projeto na aba Projetos antes de enviar um convite específico.
                  </p>
                ) : (
                  <select
                    id="convite-projeto"
                    value={idProjetoSelecionado}
                    onChange={(e) => setIdProjetoSelecionado(e.target.value)}
                    className="h-10 rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  >
                    {projetosEmpresa.map((proj) => (
                      <option key={proj.id_projeto} value={proj.id_projeto}>
                        #{proj.id_projeto} — {proj.nome} ({proj.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label htmlFor="convite-msg" className="text-xs font-semibold text-slate-800">
                Mensagem (opcional)
              </label>
              <input
                id="convite-msg"
                type="text"
                maxLength={300}
                placeholder="Ex.: Convite para colaborar no anel óptico..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={enviando || (tipoConvite === "PROJETO" && projetosEmpresa.length === 0)}
                className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Enviar convite"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Membros e Participantes da Empresa Ativa */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 text-base font-bold text-slate-900">Membros da Empresa Ativa</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Colaborador</th>
                  <th className="py-2 pr-3">CREA</th>
                  <th className="py-2">Papel</th>
                </tr>
              </thead>
              <tbody>
                {membros.membros_empresa.map((m) => (
                  <tr key={m.id_usuario} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{m.nome}</div>
                      <div className="text-slate-500">{m.email}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-slate-700">{m.crea || "—"}</td>
                    <td className="py-2.5 font-semibold text-blue-700">{m.nivel_acesso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 text-base font-bold text-slate-900">Convidados por Projeto</h2>
          {membros.participantes_projetos.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Nenhum colaborador externo vinculado especificamente a projetos desta empresa.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Projeto</th>
                    <th className="py-2 pr-3">Participante</th>
                    <th className="py-2">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {membros.participantes_projetos.map((p) => (
                    <tr key={`${p.id_projeto}-${p.id_usuario}`} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">{p.nome_projeto}</td>
                      <td className="py-2.5 pr-3">
                        <div className="text-slate-900">{p.nome_usuario}</div>
                        <div className="text-slate-500">{p.email_usuario}</div>
                      </td>
                      <td className="py-2.5 font-semibold text-emerald-700">{p.papel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Convites Enviados (Admin) */}
      {isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 text-base font-bold text-slate-900">Convites Enviados pela Empresa</h2>
          {enviados.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">Nenhum convite enviado ainda.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {enviados.map((conv) => (
                <div
                  key={conv.id_convite}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800">{conv.email_convidado}</span>
                      <StatusBadge status={conv.status} />
                      <span className="text-slate-600">
                        {conv.tipo_convite === "PROJETO"
                          ? `Projeto: ${conv.nome_projeto}`
                          : "Grupo / Empresa"}{" "}
                        · {conv.nivel_acesso}
                      </span>
                    </div>
                  </div>
                  {conv.status === "PENDENTE" && (
                    <button
                      type="button"
                      onClick={() => handleCancelarConvite(conv.id_convite)}
                      className="cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancelar convite
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
