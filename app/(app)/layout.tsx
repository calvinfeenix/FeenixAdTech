import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import CardGlow from "@/components/card-glow";
import { requireApproved } from "@/lib/auth";

/**
 * Shell for all authenticated app pages. Server Component: it resolves the
 * signed-in profile once (enforcing sign-in + approval) and feeds role/profile
 * to the client chrome. Admin-only pages additionally call `requireAdmin()`.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApproved();

  return (
    <div className="flex h-full">
      <CardGlow />
      <Sidebar role={profile.role} isSuperAdmin={profile.is_super_admin} />
      <div className="flex-1 lg:ml-[240px] relative h-screen overflow-y-auto">
        <Header profile={profile} />
        <main className="px-4 sm:px-6 pt-20 pb-8">{children}</main>
      </div>
    </div>
  );
}
