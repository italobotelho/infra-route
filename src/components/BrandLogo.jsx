const SIZE_CLASSES = {
  xs: "h-7 w-7 rounded-lg",
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
};

/**
 * Logotipo oficial da plataforma InfraRoute.
 */
export function BrandLogo({
  size = "md",
  decorative = false,
  className = "",
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return (
    <img
      src="/infraroute-logo.png"
      alt={decorative ? "" : "Logotipo da plataforma InfraRoute"}
      className={`shrink-0 object-cover shadow-sm ring-1 ring-white/15 ${sizeClass} ${className}`.trim()}
    />
  );
}
