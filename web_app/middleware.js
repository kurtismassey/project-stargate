import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppForUser } from "@/firebase/serverApp";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request) {
  const { firebaseServerApp, currentUser } = await getAuthenticatedAppForUser();

  if (!currentUser && PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next({});
  }

  if (!currentUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (currentUser && PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({});
}

export const config = {
  matcher: ["/", "/((?!_next|.*\\.).*)"],
};
