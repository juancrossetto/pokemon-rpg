/** "thunder-shock" → "Thunder Shock"; "growl" → "Growl". */
export function formatMoveName(name: string): string {
  return name
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
