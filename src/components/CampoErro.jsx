/**
 * Componente reutilizável para exibição acessível de alertas e erros de validação
 * em formulários (Aulas 05, 09 e 10 — uso de `role="alert"`).
 */
export function CampoErro({ id, children }) {
  return children ? (
    <p id={id} className="text-xs leading-5 text-red-600" role="alert">
      {children}
    </p>
  ) : null;
}

export default CampoErro;

