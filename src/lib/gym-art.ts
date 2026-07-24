// Arte oficial (Bulbagarden Archives) hosteado localmente en public/gyms/.
// Las medallas se nombran por tipo de gimnasio (coincide con Gym.type); los
// retratos de líder no tienen una clave limpia derivable del nombre ("Lt.
// Surge" no es un slug trivial), así que van por mapa explícito.
const LEADER_SLUGS: Record<string, string> = {
  Brock: "brock",
  Misty: "misty",
  "Lt. Surge": "lt-surge",
  Erika: "erika",
  Koga: "koga",
  Sabrina: "sabrina",
  Blaine: "blaine",
  Giovanni: "giovanni",
};

export function gymBadgeImageUrl(type: string): string {
  return `/gyms/badges/${type}.png`;
}

export function gymLeaderImageUrl(leaderName: string): string | null {
  const slug = LEADER_SLUGS[leaderName];
  return slug ? `/gyms/leaders/${slug}.png` : null;
}
