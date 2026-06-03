/* Real Feenix brand assets (downloaded from feenixgroup.com — owned by Feenix).
   SVGs are white-filled, so they sit on the dark UI without modification. */

/** The "F" icon mark — used as the compact brand glyph. */
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

/** The full "feenix" wordmark. */
export function Wordmark({ height = 26 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/feenix-logo.svg"
      alt="Feenix"
      style={{ height }}
      className="w-auto object-contain"
    />
  );
}
