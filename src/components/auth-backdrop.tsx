import Image from "next/image";
import { AuthAtmosphere } from "@/components/auth-atmosphere";

/**
 * Wallpaper solo para login/register.
 * PNG original con alpha + atmósfera (lluvia / destellos).
 */
export function AuthBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image
        src="/auth/mewtwo-creation.png"
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-cover object-center"
        style={{ imageRendering: "auto" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/25" />
      <AuthAtmosphere />
    </div>
  );
}
