"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Loader2 } from "lucide-react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await loginAction(new FormData(e.currentTarget));
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="bg-[#0b0c11] border border-white/10 rounded-2xl p-8 shadow-2xl">
      <h2 className="text-xl font-display font-semibold text-foreground">Welcome back</h2>
      <p className="text-sm text-muted mt-1">Sign in to your Feenix AdTech account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Username or email" name="identifier" type="text" autoComplete="username" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-full py-2.5 transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          Sign in
        </button>
      </form>

      <p className="text-sm text-muted mt-6 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Request access
        </Link>
      </p>
      <p className="text-sm text-center mt-1">
        <Link href="/login" className="text-accent hover:underline">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-muted-strong">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none transition-colors"
      />
    </label>
  );
}
