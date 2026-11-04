import { CurrentProjectsSection } from "./components/CurrentProjectsSection";
import { WorkspaceNavigationSidebarSection } from "./components/WorkspaceNavigationSidebarSection";

export const CanvasProjects = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-start bg-gray-50 text-gray-900 lg:flex-row"
      data-infraroute-02-sem-nticos-mode="modo-claro"
    >
      <WorkspaceNavigationSidebarSection />
      <CurrentProjectsSection />
    </div>
  );
};

export default CanvasProjects;
