export interface AvatarOption {
  id: string;
  src: string;
}

// Retratos de entrenador. Los archivos viven en public/avatars/.
// El mockup traía íconos `face`/`face_2`/... como placeholder de estas
// imágenes (los tiles ya venían con overflow-hidden), no como diseño final.
export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "trainer-1", src: "/avatars/trainer-1.png" },
  { id: "trainer-2", src: "/avatars/trainer-2.png" },
  { id: "trainer-3", src: "/avatars/trainer-3.png" },
  { id: "trainer-4", src: "/avatars/trainer-4.png" },
];

export function avatarById(id: string | null | undefined): AvatarOption | null {
  return AVATAR_OPTIONS.find((a) => a.id === id) ?? null;
}
