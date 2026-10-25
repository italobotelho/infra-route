import "./projectstailwindcss.css";
import { CurrentProjectsSection } from "./CurrentProjectsSection";
import { WorkspaceNavigationSidebarSection } from "./WorkspaceNavigationSidebarSection";

export const CanvasProjects = () => {
  return (
    <div
      className="flex min-h-screen items-start bg-gray-50 text-gray-900"
      data-infraroute-02-sem-nticos-mode="modo-claro"
    >
      <WorkspaceNavigationSidebarSection />
      <CurrentProjectsSection />
    </div>
  );
};

export default CanvasProjects;
