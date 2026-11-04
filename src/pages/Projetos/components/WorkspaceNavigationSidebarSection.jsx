import { useNavigate } from "react-router-dom";
import { getSession, logoutSession } from "../../../lib/api";
import { Default } from "./icons/Default";
import default24 from "../assets/default-24.svg";
import default25 from "../assets/default-25.svg";
import default26 from "../assets/default-26.svg";
import default27 from "../assets/default-27.svg";
import symbol from "../assets/symbol.svg";

const navigationItems = [
  {
    label: "Dashboard",
    icon: default24,
    alt: "Ícone de painel Dashboard",
    iconClassName: "absolute w-[91.97%] h-[91.97%] top-[8.03%] left-[8.03%]",
    active: false,
  },
  {
    label: "Projetos",
    active: true,
  },
  {
    label: "Ajuda",
    icon: default25,
    alt: "Ícone de central de ajuda",
    iconClassName: "absolute w-[96.14%] h-[96.14%] top-[3.86%] left-[3.86%]",
    active: false,
  },
  {
    label: "Configurações",
    icon: default26,
    alt: "Ícone de configurações",
    iconClassName: "absolute w-[87.80%] h-[87.80%] top-[12.20%] left-[12.20%]",
    active: false,
  },
];

const renderNavigationIcon = (item) => {
  if (item.label === "Projetos") {
    return (
      <Default
        className="!relative !w-5 !h-5"
        color={item.active ? "#1D4ED8" : "#CBD5E1"}
      />
    );
  }

  return (
    <span className="relative w-[19px] h-[19px]" aria-hidden="true">
      <img className={item.iconClassName} alt={item.alt} src={item.icon} />
    </span>
  );
};

export const WorkspaceNavigationSidebarSection = () => {
  const navigate = useNavigate();
  const session = getSession();
  const userInitials = (session?.nome || "IR")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "IR";

  const handleNavigation = (label) => {
    if (label === "Projetos") navigate("/projetos");
  };

  const handleLogout = async () => {
    await logoutSession();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className="relative flex w-full flex-col items-start justify-between self-stretch bg-slate-900 px-4 pt-8 pb-6 lg:w-[260px]"
      aria-label="Navegação do workspace"
    >
      <div className="relative flex w-full flex-[0_0_auto] flex-col items-start gap-10 self-stretch">
        <header className="relative flex w-full flex-[0_0_auto] flex-col items-start gap-3 self-stretch px-3 py-0">
          <div className="relative inline-flex flex-[0_0_auto] items-center gap-2.5">
            <div className="relative flex h-[26px] w-[26px] items-center justify-center">
              <img
                className="relative h-[22px] w-[22px]"
                alt="Logotipo da plataforma InfraRoute"
                src={symbol}
              />
            </div>
            <span className="relative mt-[-1.00px] w-fit whitespace-nowrap text-[25px] font-bold leading-[normal] tracking-[-0.20px] text-slate-50">
              InfraRoute
            </span>
          </div>
          <div className="relative inline-flex flex-[0_0_auto] items-start overflow-hidden rounded border border-solid border-slate-600 px-2 py-[5px]">
            <span className="relative mt-[-1.00px] w-fit whitespace-nowrap text-[10px] font-semibold leading-[normal] tracking-[0] text-slate-300">
              <abbr title="Business-to-Business">B2B</abbr> Enterprise
            </span>
          </div>
        </header>
        <nav
          className="relative flex w-full flex-[0_0_auto] flex-col items-start gap-2 self-stretch"
          aria-label="Menu principal do workspace"
        >
          <p className="relative mt-[-1.00px] h-6 self-stretch text-[10px] font-semibold leading-[normal] tracking-[0.14px] text-slate-300">
            WORKSPACE
          </p>
          <ul className="m-0 flex w-full list-none flex-col items-start gap-2 p-0">
            {navigationItems.map((item) => (
              <li key={item.label} className="w-full">
                <button
                  type="button"
                  onClick={() => handleNavigation(item.label)}
                  aria-current={item.active ? "page" : undefined}
                  className={
                    item.active
                      ? "relative flex h-12 w-full appearance-none items-center gap-3 self-stretch overflow-hidden rounded-lg border-0 bg-blue-100 px-3 py-0 text-left"
                      : "relative flex h-12 w-full appearance-none items-center gap-3 self-stretch overflow-hidden rounded-lg border-0 bg-slate-900 px-3 py-0 text-left hover:bg-slate-800"
                  }
                >
                  {item.active && (
                    <span
                      className="absolute top-3 left-0 h-6 w-[3px] rounded-sm bg-blue-600"
                      aria-hidden="true"
                    />
                  )}
                  {renderNavigationIcon(item)}
                  <span
                    className={
                      item.active
                        ? "relative w-fit text-[13px] font-semibold leading-[normal] tracking-[0] text-blue-700"
                        : item.label === "Projetos"
                          ? "relative w-fit text-[13px] font-semibold leading-[normal] tracking-[0] text-slate-300"
                          : "relative w-fit text-[13px] font-normal leading-[normal] tracking-[0] text-slate-300"
                    }
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="relative mt-6 flex w-full flex-[0_0_auto] flex-col items-start gap-6 self-stretch lg:mt-0">
        <section
          className="relative flex w-full flex-[0_0_auto] flex-col items-start gap-2 self-stretch p-3"
          aria-labelledby="demo-environment-title"
        >
          <h2
            id="demo-environment-title"
            className="relative mt-[-1.00px] w-fit whitespace-nowrap text-[10px] font-semibold leading-[normal] tracking-[0.11px] text-slate-300"
          >
            AMBIENTE DE DEMONSTRAÇÃO
          </h2>
          <p className="relative self-stretch text-xs font-normal leading-[19px] tracking-[0] text-slate-300">
            Planejamento <abbr title="Outside Plant (Planta Externa)">OSP</abbr> e expansão de redes ópticas.
          </p>
        </section>
        <section
          className="relative flex w-full flex-[0_0_auto] flex-col items-start gap-3.5 self-stretch border-t border-solid border-slate-600 px-2 pt-6 pb-0"
          aria-label="Perfil do usuário"
        >
          <div className="relative flex w-full flex-[0_0_auto] items-center gap-2.5 self-stretch">
            <div
              className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[18px] bg-slate-600"
              aria-hidden="true"
            >
              <span className="relative w-fit text-xs font-semibold leading-[normal] tracking-[0] text-slate-50">
                {userInitials}
              </span>
            </div>
            <div className="relative flex flex-1 grow flex-col items-start gap-1">
              <strong className="relative mt-[-1.00px] w-fit text-[13px] font-semibold leading-[normal] tracking-[0] text-slate-50">
                {session.nome}
              </strong>
              <span className="relative w-fit whitespace-nowrap text-[11px] font-normal leading-[normal] tracking-[0] text-slate-300">
                {session.nivel_acesso}
              </span>
            </div>
          </div>
          <div className="relative inline-flex flex-[0_0_auto] items-center gap-1.5">
            <span className="relative h-[15px] w-[15px]" aria-hidden="true">
              <img
                className="absolute top-[2.68%] left-[2.62%] h-[97.32%] w-[97.38%]"
                alt="Selo de registro profissional CREA"
                src={default27}
              />
            </span>
            <span className="relative w-fit whitespace-nowrap text-[11px] font-normal leading-[normal] tracking-[0] text-slate-300">
              {session.crea ? (
                <>
                  <abbr title="Conselho Regional de Engenharia e Agronomia">CREA</abbr> {session.crea}
                </>
              ) : (
                "Sem CREA cadastrado"
              )}
            </span>
          </div>
          <button
            type="button"
            className="text-xs text-slate-300 hover:text-white"
            onClick={handleLogout}
          >
            Sair
          </button>
        </section>
      </div>
    </aside>
  );
};
