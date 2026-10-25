import { useMemo, useState } from "react";
import collaborators from "./collaborators.svg";
import collaborators2 from "./collaborators-2.svg";
import collaborators3 from "./collaborators-3.svg";
import collaborators4 from "./collaborators-4.svg";
import collaborators5 from "./collaborators-5.svg";
import collaborators6 from "./collaborators-6.svg";
import collaborators7 from "./collaborators-7.svg";
import collaborators8 from "./collaborators-8.svg";
import collaborators9 from "./collaborators-9.svg";
import collaborators10 from "./collaborators-10.svg";
import xdefault from "./default.svg";
import default2 from "./default-2.svg";
import default3 from "./default-3.svg";
import default4 from "./default-4.svg";
import default5 from "./default-5.svg";
import default6 from "./default-6.svg";
import default7 from "./default-7.svg";
import default8 from "./default-8.svg";
import default9 from "./default-9.svg";
import default10 from "./default-10.svg";
import default11 from "./default-11.svg";
import default12 from "./default-12.svg";
import default13 from "./default-13.svg";
import default14 from "./default-14.svg";
import default15 from "./default-15.svg";
import default16 from "./default-16.svg";
import default17 from "./default-17.svg";
import default18 from "./default-18.svg";
import default19 from "./default-19.svg";
import default20 from "./default-20.svg";
import default21 from "./default-21.svg";
import default22 from "./default-22.svg";
import default23 from "./default-23.svg";
import default28 from "./default-28.svg";
import { Icon } from "./Icon";
import { Icon1 } from "./Icon1";
import { Icon2 } from "./Icon2";
import { Icon3 } from "./Icon3";
import { Icon4 } from "./Icon4";
import { Icon5 } from "./Icon5";
import { Icon6 } from "./Icon6";
import { Icon7 } from "./Icon7";
import { Icon8 } from "./Icon8";
import { IconComponentNode } from "./IconComponentNode";
import image from "./image.svg";
import objective from "./objective.svg";
import objective2 from "./objective-2.svg";
import objective3 from "./objective-3.svg";
import objective4 from "./objective-4.svg";
import objective5 from "./objective-5.svg";
import objective6 from "./objective-6.svg";
import objective7 from "./objective-7.svg";
import objective8 from "./objective-8.svg";
import objective9 from "./objective-9.svg";
import objective10 from "./objective-10.svg";
import owner from "./owner.svg";
import owner2 from "./owner-2.svg";
import owner3 from "./owner-3.svg";
import owner4 from "./owner-4.svg";
import owner5 from "./owner-5.svg";
import owner6 from "./owner-6.svg";
import owner7 from "./owner-7.svg";
import owner8 from "./owner-8.svg";
import owner9 from "./owner-9.svg";
import owner10 from "./owner-10.svg";
import status from "./status.svg";
import status2 from "./status-2.svg";
import status3 from "./status-3.svg";
import status4 from "./status-4.svg";
import status5 from "./status-5.svg";
import status6 from "./status-6.svg";
import status7 from "./status-7.svg";
import status8 from "./status-8.svg";
import status9 from "./status-9.svg";
import status10 from "./status-10.svg";

const projects = [
  {
    name: "Projeto Campinas",
    code: "OSP-0268 · Campinas / SP",
    status: status,
    owner: owner,
    collaborators: collaborators,
    objective: objective,
    folder: default4,
    start: "26/10/26",
    end: "12/11/26",
    action: Icon,
  },
  {
    name: "Projeto Valinhos",
    code: "OSP-0267 · Valinhos / SP",
    status: status2,
    owner: owner2,
    collaborators: collaborators2,
    objective: objective2,
    folder: default6,
    start: "20/10/26",
    end: "18/11/26",
    action: IconComponentNode,
  },
  {
    name: "Bairro da Capela",
    code: "OSP-0266 · Vinhedo / SP",
    status: status3,
    owner: owner3,
    collaborators: collaborators3,
    objective: objective3,
    folder: default8,
    start: "05/10/26",
    end: "30/11/26",
    action: Icon1,
  },
  {
    name: "Parque Portugal",
    code: "OSP-0265 · Valinhos / SP",
    status: status4,
    owner: owner4,
    collaborators: collaborators4,
    objective: objective4,
    folder: default10,
    start: "01/10/26",
    end: "28/10/26",
    action: Icon2,
  },
  {
    name: "Anel Sorocaba",
    code: "OSP-0264 · Sorocaba / SP",
    status: status5,
    owner: owner5,
    collaborators: collaborators5,
    objective: objective5,
    folder: default12,
    start: "22/10/26",
    end: "25/11/26",
    action: Icon3,
  },
  {
    name: "Rede Vinhedo",
    code: "OSP-0263 · Vinhedo / SP",
    status: status6,
    owner: owner6,
    collaborators: collaborators6,
    objective: objective6,
    folder: default14,
    start: "19/10/26",
    end: "09/11/26",
    action: Icon4,
  },
  {
    name: "Parque Logístico Sul",
    code: "OSP-0262 · Curitiba / PR",
    status: status7,
    owner: owner7,
    collaborators: collaborators7,
    objective: objective7,
    folder: default16,
    start: "08/10/26",
    end: "06/11/26",
    action: Icon5,
  },
  {
    name: "Residencial Aurora",
    code: "OSP-0261 · Londrina / PR",
    status: status8,
    owner: owner8,
    collaborators: collaborators8,
    objective: objective8,
    folder: default18,
    start: "23/10/26",
    end: "16/12/26",
    action: Icon6,
  },
  {
    name: "Campus Pinheiros",
    code: "OSP-0260 · São Paulo / SP",
    status: status9,
    owner: owner9,
    collaborators: collaborators9,
    objective: objective9,
    folder: default20,
    start: "15/10/26",
    end: "27/11/26",
    action: Icon7,
  },
  {
    name: "Expansão Jundiaí",
    code: "OSP-0259 · Jundiaí / SP",
    status: status10,
    owner: owner10,
    collaborators: collaborators10,
    objective: objective10,
    folder: default22,
    start: "12/10/26",
    end: "20/11/26",
    action: Icon8,
  },
];

const calendarIcons = [
  default5,
  default7,
  default9,
  default11,
  default13,
  default15,
  default17,
  default19,
  default21,
  default23,
];

const headerColumns = [
  { label: "Nome", className: "min-w-[172px]" },
  { label: "Status", className: "min-w-[120px]" },
  { label: "Proprietário/Empresa", className: "min-w-36" },
  { label: "Colaboradores", className: "min-w-[104px]" },
  { label: "Tipo de Projeto\n(Objetivo)", className: "min-w-36" },
  { label: "Data de Início /\nPrazo Final", className: "min-w-[156px]" },
  { label: "Ações", className: "min-w-9" },
];

export const CurrentProjectsSection = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      `${project.name} ${project.code}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const allSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every((project) => selected.includes(project.code));

  const toggleProject = (code) => {
    setSelected((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((current) =>
        current.filter(
          (code) => !filteredProjects.some((project) => project.code === code),
        ),
      );
      return;
    }

    setSelected((current) => [
      ...new Set([
        ...current,
        ...filteredProjects.map((project) => project.code),
      ]),
    ]);
  };

  const refreshProjects = () => {
    setQuery("");
    setSelected([]);
    setPage(1);
  };

  return (
    <main className="flex flex-col items-start gap-6 p-8 relative flex-1 self-stretch grow">
      <header className="flex flex-col min-h-20 items-start gap-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="flex items-center justify-between relative self-stretch w-full flex-[0_0_auto]">
          <nav
            aria-label="Breadcrumb"
            className="inline-flex items-center gap-2 relative flex-[0_0_auto]"
          >
            <span className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
              Workspace
            </span>
            <span className="relative w-3 h-3" aria-hidden="true">
              <img
                className="absolute w-[69.58%] h-[82.08%] top-[17.92%] left-[30.42%]"
                alt=""
                src={xdefault}
              />
            </span>
            <span className="relative w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-slate-900 text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
              Projetos
            </span>
          </nav>
          <p className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
            Gestão de expansão OSP / FTTH
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[12px_24px] relative self-stretch w-full flex-[0_0_auto]">
          <h1 className="relative flex-1 [font-family:'Inter-Bold',Helvetica] font-bold text-slate-900 text-[32px] tracking-[-0.26px] leading-10">
            Projetos atuais
          </h1>
          <div className="inline-flex items-center gap-3 relative flex-[0_0_auto]">
            <label className="flex w-[210px] h-11 items-center gap-3 px-4 py-0 relative bg-white rounded-lg border border-solid border-slate-300">
              <img
                className="relative w-[19.7px] h-[19.7px]"
                alt=""
                src={default28}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar projetos..."
                aria-label="Buscar projetos"
                className="relative min-w-0 flex-1 bg-transparent outline-none [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-xs tracking-[0] leading-5 placeholder:text-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={refreshProjects}
              className="inline-flex h-12 items-center justify-center gap-2.5 px-6 py-3 relative flex-[0_0_auto] bg-white rounded-lg border border-solid border-slate-300"
            >
              <span className="text-blue-700 relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm text-center tracking-[0] leading-6 whitespace-nowrap">
                Refresh ↻
              </span>
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2.5 px-6 py-3 relative flex-[0_0_auto] bg-white rounded-lg border border-solid border-slate-300"
            >
              <span className="text-blue-700 relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm text-center tracking-[0] leading-6 whitespace-nowrap">
                Customize ⚙
              </span>
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2.5 px-6 py-3 relative flex-[0_0_auto] bg-blue-600 rounded-lg"
            >
              <span className="text-white relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm text-center tracking-[0] leading-6 whitespace-nowrap">
                New project +
              </span>
            </button>
          </div>
        </div>
      </header>
      <section className="flex flex-col items-start gap-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto] overflow-x-auto">
          <div className="flex flex-col min-w-[1016px] items-start relative self-stretch w-full flex-[0_0_auto] bg-white rounded-lg overflow-hidden border border-solid border-slate-200">
            <div
              role="row"
              className="flex h-[52px] items-center gap-3 px-4 py-0 relative self-stretch w-full bg-slate-50 border-b [border-bottom-style:solid] border-slate-200"
            >
              <div className="flex min-w-6 items-center gap-2 relative flex-1 grow">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos os projetos"
                  className="relative w-4 h-4 rounded border border-solid border-slate-300 accent-blue-600"
                />
              </div>
              {headerColumns.map((column) => (
                <div
                  key={column.label}
                  className={`flex items-center gap-2 relative flex-1 grow ${column.className}`}
                >
                  <span className="leading-[15px] whitespace-pre-line relative flex-1 mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-600 text-[10px] tracking-[0]">
                    {column.label}
                  </span>
                  {column.label === "Nome" && (
                    <span className="relative w-3 h-3" aria-hidden="true">
                      <img
                        className="absolute w-[86.25%] h-[86.25%] top-[13.75%] left-[13.75%]"
                        alt=""
                        src={image}
                      />
                    </span>
                  )}
                </div>
              ))}
            </div>
            {filteredProjects.map((project, index) => {
              const ActionIcon = project.action;
              const calendarIcon = calendarIcons[index];

              return (
                <div
                  role="row"
                  key={project.code}
                  className="flex h-14 items-center gap-3 px-4 py-0 relative self-stretch w-full bg-white border-b [border-bottom-style:solid] border-slate-200"
                >
                  <div className="flex min-w-6 items-center gap-2 relative flex-1 grow">
                    <input
                      type="checkbox"
                      onChange={() => toggleProject(project.code)}
                      aria-label={`Selecionar ${project.name}`}
                      className="relative w-4 h-4 rounded border border-solid border-slate-300 accent-blue-600"
                    />
                  </div>
                  <div className="flex min-w-[172px] items-center gap-2 relative flex-1 grow">
                    <div className="relative w-[18px] h-[18px]">
                      <img
                        className="absolute w-[96.39%] h-[92.22%] top-[7.78%] left-[3.61%]"
                        alt=""
                        src={project.folder}
                      />
                    </div>
                    <div className="flex flex-col items-start gap-1 relative flex-1 grow min-w-0">
                      <span className="relative self-stretch mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-900 text-xs tracking-[0] leading-4 truncate">
                        {project.name}
                      </span>
                      <span className="relative self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-[10px] tracking-[0] leading-[14px] truncate">
                        {project.code}
                      </span>
                    </div>
                  </div>
                  <img
                    className="min-w-[120px] relative flex-1 grow"
                    alt=""
                    src={project.status}
                  />
                  <img
                    className="relative flex-1 min-w-36 grow h-7"
                    alt=""
                    src={project.owner}
                  />
                  <img
                    className="h-7 min-w-[104px] relative flex-1 grow"
                    alt=""
                    src={project.collaborators}
                  />
                  <img
                    className="relative flex-1 min-w-36 grow h-[22px]"
                    alt=""
                    src={project.objective}
                  />
                  <div className="flex min-w-[156px] items-center gap-2 relative flex-1 grow">
                    <div className="relative w-[15px] h-[15px]">
                      <img
                        className="absolute w-[93.17%] h-[97.34%] top-[2.66%] left-[6.83%]"
                        alt=""
                        src={calendarIcon}
                      />
                    </div>
                    <div className="inline-flex flex-col items-start gap-1 relative flex-[0_0_auto]">
                      <span className="relative w-fit mt-[-1.00px] [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-[11px] tracking-[0] leading-[14px] whitespace-nowrap">
                        {project.start}
                      </span>
                      <span className="relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-slate-900 text-[11px] tracking-[0] leading-[14px] whitespace-nowrap">
                        {project.end}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-9 items-center gap-2 relative flex-1 grow">
                    <button
                      type="button"
                      aria-label={`Ações de ${project.name}`}
                      className="p-0 bg-transparent border-0"
                    >
                      <ActionIcon className="!relative !w-8 !h-8" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex h-14 items-center justify-between px-4 py-0 relative self-stretch w-full bg-white rounded-lg overflow-hidden border border-solid border-slate-200 shadow-[0px_4px_16px_#0f172a0d]">
          <p className="relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-xs tracking-[0] leading-[normal]">
            Exibindo 1-10 de 48 projetos
          </p>
          <nav
            aria-label="Paginação"
            className="inline-flex items-center gap-1 relative flex-[0_0_auto]"
          >
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Página anterior"
              className="relative w-3.5 h-3.5 bg-transparent border-0 p-0"
            >
              <img
                className="absolute w-[71.09%] h-[81.07%] top-[18.93%] left-[28.91%]"
                alt=""
                src={default2}
              />
            </button>
            <button
              type="button"
              onClick={() => setPage(1)}
              className="inline-flex min-w-8 h-8 items-center justify-center px-2.5 py-0 relative flex-[0_0_auto] bg-white rounded-md overflow-hidden"
            >
              <span className="[font-family:'Inter-Medium',Helvetica] font-medium text-slate-600 relative w-fit text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
                Anterior
              </span>
            </button>
            {[1, 2, 3].map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setPage(item)}
                aria-current={page === item ? "page" : undefined}
                className={`inline-flex min-w-8 h-8 items-center justify-center px-2.5 py-0 relative flex-[0_0_auto] rounded-md overflow-hidden ${
                  page === item ? "bg-blue-600" : "bg-white"
                }`}
              >
                <span
                  className={`[font-family:'Inter-SemiBold',Helvetica] font-semibold relative w-fit text-[11px] tracking-[0] leading-[normal] whitespace-nowrap ${
                    page === item ? "text-white" : "text-slate-600"
                  }`}
                >
                  {item}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(3, current + 1))}
              className="inline-flex min-w-8 h-8 items-center justify-center px-2.5 py-0 relative flex-[0_0_auto] bg-white rounded-md overflow-hidden"
            >
              <span className="[font-family:'Inter-Medium',Helvetica] font-medium text-slate-600 relative w-fit text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
                Próximo
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(3, current + 1))}
              aria-label="Próxima página"
              className="relative w-3.5 h-3.5 bg-transparent border-0 p-0"
            >
              <img
                className="absolute w-[68.57%] h-[81.07%] top-[18.93%] left-[31.43%]"
                alt=""
                src={default3}
              />
            </button>
          </nav>
        </div>
      </section>
      <footer className="flex items-center justify-between relative self-stretch w-full flex-[0_0_auto]">
        <p className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
          Dados demonstrativos · Não representam dados reais
        </p>
        <p className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
          InfraRoute / Engenharia de redes
        </p>
      </footer>
    </main>
  );
};
