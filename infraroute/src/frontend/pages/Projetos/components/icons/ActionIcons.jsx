// PLACEHOLDER — os ícones de ação originais (Icon, Icon1…Icon8, IconComponentNode)
// não foram enviados. Todos usam o mesmo botão "⋯" até serem substituídos.
const ActionIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="#CBD5E1" />
    <circle cx="10" cy="16" r="1.6" fill="#64748B" />
    <circle cx="16" cy="16" r="1.6" fill="#64748B" />
    <circle cx="22" cy="16" r="1.6" fill="#64748B" />
  </svg>
);

export const Icon = ActionIcon;
export const Icon1 = ActionIcon;
export const Icon2 = ActionIcon;
export const Icon3 = ActionIcon;
export const Icon4 = ActionIcon;
export const Icon5 = ActionIcon;
export const Icon6 = ActionIcon;
export const Icon7 = ActionIcon;
export const Icon8 = ActionIcon;
export const IconComponentNode = ActionIcon;
