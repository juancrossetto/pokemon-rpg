import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  const pathname = request.nextUrl.pathname;

  // Pasa el pathname al request de los Server Components (layout / guards).
  // Patrón interno de Next: x-middleware-request-* + override list.
  const override = response.headers.get("x-middleware-override-headers");
  const nextOverride = override ? `${override},x-pathname` : "x-pathname";
  response.headers.set("x-middleware-override-headers", nextOverride);
  response.headers.set("x-middleware-request-x-pathname", pathname);
  response.headers.set("x-pathname", pathname);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
