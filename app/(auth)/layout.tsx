/** Centered, brand-lit shell for login / signup / pending screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      {/* Blurred Roblox-games backdrop (slow drift) + dark wash */}
      <div className="absolute inset-0 bg-cover bg-center bg-drift" style={{ backgroundImage: "url(/login-bg.png)" }} />
      <div className="absolute inset-0 bg-background/60" />

      <div className="relative mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/feenix-full.png" alt="Feenix AdTech" className="h-[156px] w-auto" />
      </div>
      <div className="relative w-full max-w-md">{children}</div>
      <p className="relative text-muted-strong/70 text-xs mt-8 text-center leading-relaxed">
        Ad delivery for Roblox experiences.
        <br /> Powered by Feenix.
      </p>
    </div>
  );
}
