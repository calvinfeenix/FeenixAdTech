import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (formerly "middleware" — renamed in Next.js 16). Refreshes the Supabase
 * session on every request so Server Components always see a valid token, and
 * performs coarse-grained route gating:
 *   - unauthenticated users are sent to /login
 *   - authenticated users hitting an auth page are sent to /dashboard
 *
 * Fine-grained checks (approval status, admin role) live in the page guards
 * (lib/auth.ts) and in RLS — proxy can't query the DB cheaply on the edge.
 */
const PUBLIC_PATHS = ["/login", "/signup", "/pending"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets, the ingest API, and image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
