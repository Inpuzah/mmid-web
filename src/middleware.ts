import { auth } from "@/auth";

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");

  // Block unauthenticated users outright
  if (isAdminRoute && !req.auth) {
    return Response.redirect(new URL(`/login?reason=signin_required`, origin));
  }

  // Only ADMIN allowed (maintainers not allowed)
  if (isAdminRoute) {
    const role = (req.auth?.user as any)?.role;
    if (role !== "ADMIN") {
      return Response.redirect(new URL(`/403?reason=admin_only`, origin));
    }
  }

  // allow everything else
  return;
});

export const config = {
  matcher: ["/admin/:path*"], // add other protected prefixes here if needed
};
