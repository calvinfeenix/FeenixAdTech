import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import UsersManager from "@/components/users-manager";
import PageHero from "@/components/page-hero";
import type { Profile } from "@/lib/types";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  // Admins can read all profiles (RLS profiles_select).
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const users = (data ?? []) as Profile[];

  return (
    <div className="space-y-6 fade-up">
      <PageHero title="Users & Access" subtitle="Approve sign-up requests and manage admin privileges." />
      <UsersManager users={users} currentUserId={me.id} isSuperAdmin={me.is_super_admin} />
    </div>
  );
}
