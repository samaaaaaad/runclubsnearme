import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // In sandboxed contexts (e.g. preview iframes), cookie access can be restricted.
  // Let client-side auth guards handle redirects using supabase.auth.getUser().
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/discover/:path*"],
};
