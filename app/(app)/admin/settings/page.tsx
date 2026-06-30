import { requireSuperAdmin } from "@/lib/auth";
import { getRobloxSettingsView } from "@/lib/settings";
import SettingsForm from "@/components/settings-form";
import PageHero from "@/components/page-hero";

export default async function SettingsPage() {
  await requireSuperAdmin();
  const settings = await getRobloxSettingsView();

  return (
    <div className="space-y-6 fade-up">
      <PageHero title="Settings" subtitle="Organization integrations. These apply to every admin." />
      <SettingsForm settings={settings} />
    </div>
  );
}
