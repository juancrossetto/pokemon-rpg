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
      {/* Velo más marcado detrás del panel: el arte sigue, el form gana contraste. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,transparent_0%,rgba(6,4,10,0.35)_55%,rgba(6,4,10,0.72)_100%)]" />
      <div className="absolute inset-0 bg-linear-to-b from-background/20 via-transparent to-background/45" />
      <AuthAtmosphere />
    </div>
  );
}
