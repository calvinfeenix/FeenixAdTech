import { Wordmark } from "@/components/logo";

/** Centered, brand-lit shell for login / signup / pending screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flame-gradient flex flex-col items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center gap-2 mb-8">
        <Wordmark height={40} />
        <p className="text-muted text-xs tracking-[0.32em] uppercase">AdTech</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="text-muted text-xs mt-8">Ad delivery for Roblox experiences</p>
    </div>
  );
}
