import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
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
      <Sidebar role={profile.role} />
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        <Header profile={profile} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
