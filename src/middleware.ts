// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const config = {
  matcher: ["/admin/:path*"], // protect all admin routes
};

export default async function middleware(req: NextRequest) {
  const url = new URL(req.url);

  // getToken works in Edge when you're using session: 'jwt'
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  // Require sign-in
  if (!token) {
    url.pathname = "/login";
    url.searchParams.set("reason", "signin_required");
    return NextResponse.redirect(url);
  }

  // Require ADMIN
  if ((token as any).role !== "ADMIN") {
    url.pathname = "/403";
    url.searchParams.set("reason", "admin_only");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
