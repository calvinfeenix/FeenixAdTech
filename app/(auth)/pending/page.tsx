import { redirect } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import SignOutButton from "@/components/sign-out-button";

/**
 * Holding screen for signed-in users who are not yet approved. Approved users
 * are bounced to the dashboard; signed-out visitors to login.
 */
export default async function PendingPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.status === "approved") redirect("/dashboard");

  const rejected = profile.status === "rejected";

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl text-center">
      <div
        className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
          rejected ? "bg-danger/15" : "bg-amber-500/15"
        }`}
      >
        {rejected ? (
          <XCircle size={28} className="text-danger" />
        ) : (
          <Clock size={28} className="text-amber-400" />
        )}
      </div>

      <h2 className="text-xl font-display font-semibold text-foreground mt-4">
        {rejected ? "Access not granted" : "Awaiting approval"}
      </h2>
      <p className="text-sm text-muted mt-2">
        {rejected
          ? "Your account request was declined. Contact a Feenix administrator if you believe this is a mistake."
          : `Thanks, ${profile.full_name || profile.username}. Your account is pending review by a Feenix administrator. You'll get access as soon as it's approved.`}
      </p>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
