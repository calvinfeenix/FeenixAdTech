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

/** Full "feenix AdTech" lockup (mark + wordmark). `size` is the wordmark cap size. */
export function Wordmark({ size = 24, mark = true }: { size?: number; mark?: boolean }) {
  return (
    <div className="flex items-center" style={{ gap: size * 0.42 }}>
      {mark && <Logo size={Math.round(size * 1.55)} />}
      <span style={{ fontSize: size }} className="leading-none whitespace-nowrap">
        <span className="font-brand text-foreground">feenix</span>
        <span className="font-sans font-normal text-muted-strong ml-[0.32em]">AdTech</span>
      </span>
    </div>
  );
}
