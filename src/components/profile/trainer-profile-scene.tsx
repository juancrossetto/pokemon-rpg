"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { TrainerAppearance } from "@/lib/trainer-appearance";
import { hasAny3dModel } from "@/lib/trainer-appearance";
import { avatarStageSoftFeet } from "@/lib/avatars";

const TrainerScene3D = dynamic(
  () => import("@/components/profile/trainer-scene-3d").then((m) => m.TrainerScene3D),
  { ssr: false, loading: () => <SceneSkeleton /> },
);

export type ProfileSceneProps = {
  username: string;
  trainerSpriteUrl: string | null;
  /** Para soft-feet en stage art incompleto (ej. `nb`). */
  avatarId?: string | null;
  companionSpriteUrl: string | null;
  companionName: string | null;
  accent: string;
  appearance?: TrainerAppearance | null;
  sceneLabel: string;
};

function SceneSkeleton() {
  return (
    <div className="flex h-full w-full items-end justify-center gap-6 pb-4" aria-hidden>
      <span className="h-36 w-28 animate-pulse rounded-2xl bg-white/5" />
      <span className="h-28 w-28 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

/**
 * Escena del hero: 3D si hay GLB; si no, stage 2D (entrenador + compañero).
 */
export function TrainerProfileScene(props: ProfileSceneProps) {
  const [webglOk, setWebglOk] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const want3d = hasAny3dModel(props.appearance) && webglOk && !reducedMotion;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebglOk(
        Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
      );
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (want3d && props.appearance) {
    return (
      <div
        className="relative h-[220px] w-full sm:h-[260px] lg:h-[320px]"
        role="img"
        aria-label={props.sceneLabel}
      >
        <Suspense fallback={<SceneSkeleton />}>
          <TrainerScene3D
            appearance={props.appearance}
            trainerSpriteUrl={props.trainerSpriteUrl}
            companionSpriteUrl={props.companionSpriteUrl}
            accent={props.accent}
            onError={() => setWebglOk(false)}
          />
        </Suspense>
      </div>
    );
  }

  return <TrainerScene2D {...props} />;
}

function TrainerScene2D({
  username,
  trainerSpriteUrl,
  avatarId,
  companionSpriteUrl,
  accent,
  sceneLabel,
}: ProfileSceneProps) {
  const softFeet = avatarStageSoftFeet(avatarId);
  /*
    Escena tipo Pokémon GO: entrenador y compañero parados sobre la misma línea
    de piso, solapados, cada uno con su sombra.

    Dos decisiones que arreglan lo que se veía mal antes:

    1. Se dimensiona con `max-h` + `max-w` sobre la propia imagen, no con
       `h-full w-auto` dentro de una caja con `object-contain`. Con lo anterior,
       cualquier arte que no fuera un retrato vertical (hay avatares cuadrados y
       uno apaisado de 400×240) se enviaba a una caja alta y angosta y quedaba
       en franja, chiquito y flotando. Con los dos máximos sobre el `<img>`, la
       imagen se achica sola respetando su relación de aspecto y nunca queda
       letterboxeada.

    2. El arte del entrenador llega ya recortado al bounding box opaco
       (`/avatars/stage/`), así que su borde inferior son los pies y apoyan en
       la línea de piso. El render HOME del compañero sí trae aire propio, y por
       eso se le da un poco más de altura y un desplazamiento hacia abajo.

    3. El escenario **no tiene altura fija**. Con una altura fija y el grupo
       anclado abajo, cualquier arte que tocara antes su límite de ancho que el
       de alto —el apaisado, sin ir más lejos— quedaba a media altura y dejaba
       la mitad superior de la card vacía: se veía "muy abajo". Ahora la altura
       la marcan las figuras y el `min-h` solo evita que la card colapse cuando
       el arte es muy chico.
  */
  return (
    <div
      className="relative mx-auto flex w-full max-w-lg items-end justify-center pb-3"
      role="img"
      aria-label={sceneLabel}
    >
      {/* Luz de piso: ancla la escena y separa las figuras del fondo. */}
      <div
        aria-hidden
        className="tp-scene__floor absolute inset-x-0 bottom-0 h-24"
        style={{
          background: `radial-gradient(60% 100% at 50% 100%, ${accent}22 0%, transparent 72%)`,
        }}
      />

      <div className="flex min-h-[150px] items-end justify-center sm:min-h-[180px] lg:min-h-[205px]">
        {companionSpriteUrl ? (
          <figure className="tp-scene__figure tp-scene__figure--companion relative z-[2] -mr-8 flex shrink-0 items-end sm:-mr-10">
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 mx-auto h-3 w-[70%] rounded-[100%] bg-black/55 blur-[3px]"
            />
            {/* Nudge mínimo para el aire que traen los renders HOME por debajo
                del Pokémon. Con más, el compañero se hunde por debajo de la
                línea de piso del entrenador y se pierde el suelo compartido. */}
            <Image
              src={companionSpriteUrl}
              alt=""
              width={320}
              height={320}
              unoptimized
              className="relative max-h-[170px] w-auto max-w-[11rem] translate-y-[2%] object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.5)] sm:max-h-[210px] sm:max-w-[14rem] lg:max-h-[250px] lg:max-w-[17rem]"
            />
          </figure>
        ) : null}

        <figure className="tp-scene__figure tp-scene__figure--trainer relative z-[2] flex shrink-0 items-end">
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 mx-auto h-2.5 w-[62%] rounded-[100%] bg-black/55 blur-[3px]"
          />
          {trainerSpriteUrl ? (
            <Image
              src={trainerSpriteUrl}
              alt={username}
              width={280}
              height={420}
              unoptimized
              priority
              className={`relative max-h-[178px] w-auto max-w-[12rem] object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.5)] sm:max-h-[220px] sm:max-w-[15rem] lg:max-h-[262px] lg:max-w-[19rem]${softFeet ? " trainer-stage--soft-feet" : ""}`}
            />
          ) : (
            <span className="flex h-[170px] w-[5.5rem] items-end justify-center rounded-xl bg-white/5 sm:h-[210px] lg:h-[250px]">
              <span className="material-symbols-outlined mb-4 text-[44px]! text-white/40">
                person
              </span>
            </span>
          )}
        </figure>
      </div>
    </div>
  );
}
