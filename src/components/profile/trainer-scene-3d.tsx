"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import type { Group } from "three";
import type { TrainerAppearance } from "@/lib/trainer-appearance";

/**
 * Escena WebGL del perfil. Solo se monta si hay al menos una URL GLB/GLTF.
 * Los sprites 2D del CDN Showdown no se usan como texturas (CORS).
 */
export function TrainerScene3D({
  appearance,
  accent,
  onError,
}: {
  appearance: TrainerAppearance;
  trainerSpriteUrl: string | null;
  companionSpriteUrl: string | null;
  accent: string;
  onError: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.15, 3.4], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2.5, 4, 2]} intensity={1.05} color={accent} />
      <directionalLight position={[-2, 2, -1]} intensity={0.3} />

      <ErrorBoundary3D onError={onError}>
        {appearance.trainerModelUrl ? (
          <ModelActor
            url={appearance.trainerModelUrl}
            position={[
              appearance.position?.x ?? 0.45,
              appearance.position?.y ?? 0,
              appearance.position?.z ?? 0,
            ]}
            scale={appearance.scale ?? 1}
            bobPhase={0}
          />
        ) : null}
        {appearance.companionModelUrl ? (
          <ModelActor
            url={appearance.companionModelUrl}
            position={[-0.55, 0, 0.2]}
            scale={0.85}
            bobPhase={1.2}
          />
        ) : null}
      </ErrorBoundary3D>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={6} blur={2.2} far={3} />
      <VisibilityPause />
    </Canvas>
  );
}

function ModelActor({
  url,
  position,
  scale,
  bobPhase,
}: {
  url: string;
  position: [number, number, number];
  scale: number;
  bobPhase: number;
}) {
  const ref = useRef<Group>(null);
  const { scene } = useGLTF(url);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.2 + bobPhase) * 0.02;
    ref.current.rotation.y = Math.sin(t * 0.35 + bobPhase) * 0.06;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <primitive object={scene.clone()} />
    </group>
  );
}

function VisibilityPause() {
  const invalidate = useThree((s) => s.invalidate);
  const set = useThree((s) => s.set);

  useEffect(() => {
    function onVis() {
      set({ frameloop: document.hidden ? "never" : "always" });
      if (!document.hidden) invalidate();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [invalidate, set]);

  return null;
}

/** Atrapa fallos de carga de useGLTF y vuelve al fallback 2D. */
import { Component, type ReactNode } from "react";

class ErrorBoundary3D extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
