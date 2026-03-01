import { NextResponse, type NextRequest } from "next/server";

/**
 * Minimal middleware — no Supabase cookie operations here.
 *
 * Why: Google OAuth sessions include provider_token + provider_refresh_token,
 * making the Supabase session cookie 5-8KB. Running getUser() in Edge Runtime
 * (which reads those cookies) causes "431 Request Header Fields Too Large".
 *
 * Auth is fully handled server-side in app/(app)/layout.tsx (getUser + admin
 * role check) and app/login/page.tsx. Session refresh happens in each server
 * component's createClient() call, which is sufficient for this app.
 */
export async function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
