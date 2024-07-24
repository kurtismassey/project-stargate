import { NextResponse } from "next/server";
import { getAuthenticatedAppForUser } from "@/firebase/serverApp";

export async function middleware(request) {
  if (request.nextUrl.pathname === "/auth-service-worker.js") {
    return;
  }

  const { currentUser, loading } = await getAuthenticatedAppForUser();

  if (loading) {
    return NextResponse.next();
  }

  const publicRoutes = ["/"];

  if (!currentUser && !publicRoutes.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (currentUser && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
