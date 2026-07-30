"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { TrainerAppearance } from "@/lib/trainer-appearance";
import { hasAny3dModel } from "@/lib/trainer-appearance";

const TrainerScene3D = dynamic(
  () => import("@/components/profile/trainer-scene-3d").then((m) => m.TrainerScene3D),
  { ssr: false, loading: () => <SceneSkeleton /> },
);

export type ProfileSceneProps = {
  username: string;
  trainerSpriteUrl: string | null;
  companionSpriteUrl: string | null;
  companionName: string | null;
  accent: string;
  appearance?: TrainerAppearance | null;
  sceneLabel: string;
};

function SceneSkeleton() {
  return (
    <div className="flex h-full w-full items-end justify-center gap-6 pb-6" aria-hidden>
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

  return <TrainerScene2D {...props} reducedMotion={reducedMotion} />;
}

function TrainerScene2D({
  username,
  trainerSpriteUrl,
  companionSpriteUrl,
  accent,
  sceneLabel,
  reducedMotion,
}: ProfileSceneProps & { reducedMotion: boolean }) {
  const bob = reducedMotion ? "" : "tp-scene-bob";

  return (
    <div
      className="relative flex h-[240px] w-full items-end justify-center sm:h-[280px] lg:h-[320px]"
      role="img"
      aria-label={sceneLabel}
    >
      {companionSpriteUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.1]"
          style={{
            maskImage: "radial-gradient(ellipse at center, #000 28%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, #000 28%, transparent 70%)",
          }}
        >
          <Image
            src={companionSpriteUrl}
            alt=""
            width={280}
            height={280}
            unoptimized
            className="h-[200px] w-[200px] object-contain sm:h-[240px] sm:w-[240px]"
          />
        </div>
      )}

      <div
        aria-hidden
        className="absolute bottom-3 left-1/2 h-5 w-[70%] max-w-xs -translate-x-1/2 rounded-[100%] bg-black/55"
        style={{ boxShadow: `0 0 36px ${accent}40` }}
      />
      <div
        aria-hidden
        className="absolute bottom-4 left-1/2 h-2.5 w-[55%] max-w-[14rem] -translate-x-1/2 rounded-[100%]"
        style={{
          background: `radial-gradient(ellipse, ${accent}55 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-1 flex items-end justify-center gap-0 pb-5 sm:gap-2">
        {companionSpriteUrl ? (
          <div className={`relative ${bob}`} style={{ animationDelay: "0.4s" }}>
            <Image
              src={companionSpriteUrl}
              alt=""
              width={180}
              height={180}
              unoptimized
              className="relative z-2 h-[148px] w-[148px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] [image-rendering:pixelated] sm:h-[176px] sm:w-[176px]"
            />
          </div>
        ) : null}

        <div className={`relative ${bob}`}>
          {trainerSpriteUrl ? (
            <Image
              src={trainerSpriteUrl}
              alt={username}
              width={160}
              height={200}
              unoptimized
              className="relative z-1 h-[168px] w-[132px] object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.6)] [image-rendering:pixelated] sm:h-[200px] sm:w-[152px]"
            />
          ) : (
            <div className="flex h-[148px] w-[100px] items-end justify-center rounded-xl bg-white/5 sm:h-[176px]">
              <span className="material-symbols-outlined mb-6 text-[48px]! text-white/40">
                person
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
