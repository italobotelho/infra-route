import { Default } from "./Default";
import default24 from "./default-24.svg";
import default25 from "./default-25.svg";
import default26 from "./default-26.svg";
import default27 from "./default-27.svg";
import symbol from "./symbol.svg";

const navigationItems = [
  {
    label: "Dashboard",
    icon: default24,
    alt: "Vector layout",
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
    alt: "Vector circle help",
    iconClassName: "absolute w-[96.14%] h-[96.14%] top-[3.86%] left-[3.86%]",
    active: false,
  },
  {
    label: "Configurações",
    icon: default26,
    alt: "Vector settings",
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
  return (
    <aside
      className="flex flex-col w-[260px] items-start justify-between pt-8 pb-6 px-4 relative self-stretch bg-slate-900"
      aria-label="Navegação do workspace"
    >
      <div className="flex flex-col items-start gap-10 relative self-stretch w-full flex-[0_0_auto]">
        <header className="flex flex-col items-start gap-3 px-3 py-0 relative self-stretch w-full flex-[0_0_auto]">
          <div className="inline-flex items-center gap-2.5 relative flex-[0_0_auto]">
            <div className="flex w-[26px] h-[26px] items-center justify-center relative">
              <img
                className="relative w-[22px] h-[22px]"
                alt="Vector brand symbol"
                src={symbol}
              />
            </div>
            <div className="relative w-fit mt-[-1.00px] [font-family:'Inter-Bold',Helvetica] font-bold text-slate-50 text-[25px] tracking-[-0.20px] leading-[normal] whitespace-nowrap">
              InfraRoute
            </div>
          </div>
          <div className="inline-flex items-start px-2 py-[5px] relative flex-[0_0_auto] rounded overflow-hidden border border-solid border-slate-600">
            <div className="relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-300 text-[10px] tracking-[0] leading-[normal] whitespace-nowrap">
              B2B Enterprise
            </div>
          </div>
        </header>
        <nav
          className="flex flex-col items-start gap-2 relative self-stretch w-full flex-[0_0_auto]"
          aria-label="Workspace"
        >
          <div className="self-stretch h-6 tracking-[0.14px] relative mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-300 text-[10px] leading-[normal]">
            WORKSPACE
          </div>
          {navigationItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-current={item.active ? "page" : undefined}
              className={
                item.active
                  ? "flex h-12 items-center gap-3 px-3 py-0 relative self-stretch w-full bg-blue-100 rounded-lg overflow-hidden text-left appearance-none border-0"
                  : "flex h-12 items-center gap-3 px-3 py-0 relative self-stretch w-full bg-slate-900 rounded-lg overflow-hidden text-left appearance-none border-0"
              }
            >
              {item.active && (
                <span
                  className="absolute top-3 left-0 w-[3px] h-6 bg-blue-600 rounded-sm"
                  aria-hidden="true"
                />
              )}
              {renderNavigationIcon(item)}
              <span
                className={
                  item.active
                    ? "[font-family:'Inter-SemiBold',Helvetica] font-semibold text-blue-700 relative w-fit text-[13px] tracking-[0] leading-[normal]"
                    : item.label === "Projetos"
                      ? "[font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-300 relative w-fit text-[13px] tracking-[0] leading-[normal]"
                      : "[font-family:'Inter-Regular',Helvetica] font-normal text-slate-300 relative w-fit text-[13px] tracking-[0] leading-[normal]"
                }
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
      <div className="flex flex-col items-start gap-6 relative self-stretch w-full flex-[0_0_auto]">
        <section
          className="flex flex-col items-start gap-2 p-3 relative self-stretch w-full flex-[0_0_auto]"
          aria-labelledby="demo-environment-title"
        >
          <h2
            id="demo-environment-title"
            className="w-fit tracking-[0.11px] whitespace-nowrap relative mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-300 text-[10px] leading-[normal]"
          >
            AMBIENTE DE DEMONSTRAÇÃO
          </h2>
          <p className="relative self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-slate-300 text-xs tracking-[0] leading-[19px]">
            Planejamento OSP e expansão de redes ópticas.
          </p>
        </section>
        <section
          className="flex flex-col items-start gap-3.5 pt-6 pb-0 px-2 relative self-stretch w-full flex-[0_0_auto] border-t [border-top-style:solid] border-slate-600"
          aria-label="Perfil do usuário"
        >
          <div className="flex items-center gap-2.5 relative self-stretch w-full flex-[0_0_auto]">
            <div
              className="flex w-9 h-9 items-center justify-center relative bg-slate-600 rounded-[18px] overflow-hidden"
              aria-hidden="true"
            >
              <div className="relative w-fit [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-50 text-xs tracking-[0] leading-[normal]">
                RM
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 relative flex-1 grow">
              <div className="relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-50 text-[13px] tracking-[0] leading-[normal]">
                Eng. Ednaldo pereira
              </div>
              <div className="text-slate-300 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
                Engenheiro de telecom
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 relative flex-[0_0_auto]">
            <span className="relative w-[15px] h-[15px]" aria-hidden="true">
              <img
                className="absolute w-[97.38%] h-[97.32%] top-[2.68%] left-[2.62%]"
                alt="Vector badge check"
                src={default27}
              />
            </span>
            <div className="text-slate-300 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
              CREA-SP 0000000000 · Exemplo
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};
