/**
 * Blocos de esqueleto (Skeleton) para visibilidade do estado de carregamento.
 */
export function SkeletonBlock({ className = "h-4 w-full" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/70 ${className}`}
    />
  );
}

export function KpiGridSkeleton({ count = 4 }) {
  return (
    <div
      role="status"
      aria-label="Carregando indicadores"
      className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <span className="sr-only">Carregando indicadores...</span>
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="mt-3 h-8 w-32" />
          <SkeletonBlock className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ columns = 6, rows = 4 }) {
  return (
    <>
      <tr className="sr-only" role="status">
        <td colSpan={columns}>Carregando registros...</td>
      </tr>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr
          key={rowIdx}
          aria-hidden="true"
          className="h-14 border-b border-solid border-slate-200 bg-white"
        >
          {Array.from({ length: columns }, (__, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <SkeletonBlock
                className={colIdx === 0 ? "h-4 w-4" : colIdx === 1 ? "h-4 w-40" : "h-4 w-24"}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
