export function PokeballIcon({ className = "", pulseButton = false }: { className?: string; pulseButton?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <path d="M 50,50 m -45,0 a 45,45 0 1,0 90,0" fill="#f0f0f0" stroke="#131313" strokeWidth="2" />
      <path d="M 50,50 m -45,0 a 45,45 0 1,1 90,0" fill="#ee1515" stroke="#131313" strokeWidth="2" />
      <rect x="5" y="47" width="90" height="6" rx="1" fill="#131313" />
      <circle cx="50" cy="50" r="12" fill="#131313" />
      <circle cx="50" cy="50" r="6" fill="#ffffff" className={pulseButton ? "pokeball-pulse-button" : undefined} />
    </svg>
  );
}
