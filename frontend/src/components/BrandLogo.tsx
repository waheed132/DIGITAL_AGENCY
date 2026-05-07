/**
 * SVG-first brand mark (crisp at any size). PNG from /public as fallback for
 * older engines or if the SVG fails to decode.
 */
export function BrandLogo({
  className = 'h-full w-full object-contain object-center',
  decorative = true,
}: {
  className?: string
  /** When true, hide from assistive tech (use beside visible "V Agency" label). */
  decorative?: boolean
}) {
  return (
    <picture className="flex h-full w-full items-center justify-center">
      <source srcSet="/flowpilot-mark.svg" type="image/svg+xml" />
      <img
        src="/logo_png.png"
        alt={decorative ? '' : 'V Agency'}
        className={className}
        loading="eager"
        decoding="async"
        {...(decorative ? { 'aria-hidden': true as const } : {})}
      />
    </picture>
  )
}
