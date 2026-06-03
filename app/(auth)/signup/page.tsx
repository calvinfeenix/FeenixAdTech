"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Loader2 } from "lucide-react";
import { signupAction } from "../actions";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signupAction(new FormData(e.currentTarget));
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/pending");
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
      <h2 className="text-xl font-display font-semibold text-foreground">Request access</h2>
      <p className="text-sm text-muted mt-1">
        Create an account. An admin will review and approve it before you can sign in.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Full name" name="full_name" type="text" autoComplete="name" required={false} />
        <Field label="Username" name="username" type="text" autoComplete="username" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" />

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
          {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
          Create account
        </button>
      </form>

      <p className="text-sm text-muted mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
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
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-muted-strong">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none transition-colors"
      />
      {hint && <span className="text-xs text-muted mt-1 block">{hint}</span>}
    </label>
  );
}
