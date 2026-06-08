"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, KeyRound, Plug, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { saveRobloxSettings, testRobloxConnection } from "@/app/(app)/admin/settings/actions";
import type { AppSettings } from "@/lib/types";

export default function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const res = await saveRobloxSettings(new FormData(e.currentTarget));
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    toast("Settings saved", "success");
    router.refresh();
  }

  async function onTest() {
    setTesting(true);
    const res = await testRobloxConnection();
    setTesting(false);
    if (res.error) return toast(res.error, "error");
    toast(res.message || "Connection OK", "success");
  }

  return (
    <form onSubmit={onSave} className="max-w-2xl space-y-5">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Roblox Open Cloud</h2>
        </div>
        <p className="text-xs text-muted mb-4">
          One shared Roblox account publishes every creative. Generate an API key at{" "}
          <a
            href="https://create.roblox.com/dashboard/credentials"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            create.roblox.com → Credentials
          </a>{" "}
          with <span className="text-muted-strong">asset read &amp; write</span> permission.
        </p>

        <label className="block">
          <span className="text-sm font-medium text-muted-strong">API key</span>
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={
              settings.keyConfigured
                ? `Configured ••••${settings.keyLast4} — leave blank to keep`
                : "Paste your sb / Open Cloud API key"
            }
            className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
          {settings.keyConfigured && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 size={12} /> A key is currently saved
            </span>
          )}
        </label>

        <label className="block mt-4">
          <span className="text-sm font-medium text-muted-strong">Creator user ID</span>
          <input
            name="creatorUserId"
            type="number"
            defaultValue={settings.creatorUserId ?? ""}
            placeholder="e.g. 1234567"
            className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
          <span className="text-xs text-muted mt-1 block">
            The numeric Roblox user ID that owns the uploaded assets (must be ID-verified).
          </span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save settings
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !settings.keyConfigured}
          title={settings.keyConfigured ? "Test the saved key" : "Save a key first"}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 text-muted-strong hover:text-foreground hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
          Test connection
        </button>
      </div>
    </form>
  );
}
