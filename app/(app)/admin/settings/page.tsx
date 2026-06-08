import { requireAdmin } from "@/lib/auth";
import { getRobloxSettingsView } from "@/lib/settings";
import SettingsForm from "@/components/settings-form";

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getRobloxSettingsView();

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted text-sm mt-1">
          Organization integrations. These apply to every admin.
        </p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
