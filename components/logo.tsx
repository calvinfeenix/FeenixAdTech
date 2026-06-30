/* Feenix AdTech brand mark + wordmark.
   The mark is a crisp vector (public/feenix-mark.svg); the wordmark is set in a
   rounded display face to match the "feenix" logotype. */

/** The pixel-square brand mark — the compact glyph. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/feenix-mark.svg"
      alt="Feenix"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

/** Full "feenix AdTech" lockup: the brand mark + the official wordmark SVG. */
export function Wordmark({ size = 24, mark = true }: { size?: number; mark?: boolean }) {
  return (
    <div className="flex items-center" style={{ gap: size * 0.4 }}>
      {mark && <Logo size={Math.round(size * 1.35)} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/LogoVectorDashboard.svg" alt="feenix AdTech" style={{ height: size * 0.72 }} className="w-auto" />
    </div>
  );
}
