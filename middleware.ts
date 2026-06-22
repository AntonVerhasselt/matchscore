import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/app") &&
    request.nextUrl.searchParams.get("checkout") === "success"
  ) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-matchscore-checkout-success", "1");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*"],
};
