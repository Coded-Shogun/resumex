import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, supabaseConfig } from "@/lib/supabase/config";

// Refreshes the Supabase session cookie on /admin requests and bounces
// signed-out visitors to the login page. The admin allowlist itself is
// checked server-side in the pages and actions (lib/resume.ts).
export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  if (!config || request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
