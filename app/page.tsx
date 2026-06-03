import { redirect } from "next/navigation";

// The middleware handles auth gating; the landing route just forwards into the app.
export default function Home() {
  redirect("/dashboard");
}
