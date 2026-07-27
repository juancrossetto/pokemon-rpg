import { signOut } from "@/auth";

/** Cierra sesión cuando el JWT apunta a un usuario que ya no existe en la DB. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") ?? "/login";
  return signOut({ redirectTo: callbackUrl });
}
