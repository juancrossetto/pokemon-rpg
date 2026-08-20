"use client";

import { useState } from "react";

export type ShareCardLabels = {
  share: string;
  preparing: string;
  shared: string;
  downloaded: string;
};

export type ShareCardData = {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent?: string;
  stats?: { label: string; value: string }[];
};

async function renderShareCard(card: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");

  const accent = card.accent ?? "#5ef0ff";
  const background = context.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, "#090b12");
  background.addColorStop(0.55, "#111827");
  background.addColorStop(1, "#07090f");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);

  const glow = context.createRadialGradient(930, 120, 0, 930, 120, 480);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, "transparent");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1200, 630);

  context.strokeStyle = `${accent}99`;
  context.lineWidth = 3;
  context.strokeRect(26, 26, 1148, 578);

  context.fillStyle = accent;
  context.font = "700 28px Inter, Arial, sans-serif";
  context.letterSpacing = "7px";
  context.fillText("POKÉMON RPG", 76, 92);
  context.fillStyle = "rgba(255,255,255,.58)";
  context.font = "700 22px Inter, Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText(card.eyebrow.toUpperCase(), 76, 166);
  context.fillStyle = "#ffffff";
  context.font = "800 62px Orbitron, Inter, Arial, sans-serif";
  context.letterSpacing = "0px";
  context.fillText(card.title.slice(0, 28), 76, 246, 1048);
  context.fillStyle = "rgba(255,255,255,.72)";
  context.font = "500 29px Inter, Arial, sans-serif";
  context.fillText(card.subtitle.slice(0, 70), 76, 302, 1048);

  const stats = card.stats?.slice(0, 4) ?? [];
  const gap = 18;
  const available = 1048 - gap * Math.max(0, stats.length - 1);
  const statWidth = stats.length > 0 ? available / stats.length : 0;
  stats.forEach((stat, index) => {
    const x = 76 + index * (statWidth + gap);
    context.fillStyle = "rgba(255,255,255,.07)";
    context.beginPath();
    context.roundRect(x, 374, statWidth, 132, 20);
    context.fill();
    context.fillStyle = accent;
    context.font = "800 34px Orbitron, Inter, Arial, sans-serif";
    context.fillText(stat.value.slice(0, 14), x + 22, 428, statWidth - 44);
    context.fillStyle = "rgba(255,255,255,.58)";
    context.font = "700 17px Inter, Arial, sans-serif";
    context.letterSpacing = "2px";
    context.fillText(stat.label.toUpperCase().slice(0, 20), x + 22, 472, statWidth - 44);
  });

  context.fillStyle = "rgba(255,255,255,.38)";
  context.font = "500 18px Inter, Arial, sans-serif";
  context.letterSpacing = "1px";
  context.fillText(window.location.host, 76, 564);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png");
  });
}

export function ShareCardButton({ card, labels, fileName, className = "" }: {
  card: ShareCardData;
  labels: ShareCardLabels;
  fileName: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "preparing" | "shared" | "downloaded">("idle");
  const label = status === "preparing" ? labels.preparing : status === "shared" ? labels.shared : status === "downloaded" ? labels.downloaded : labels.share;

  async function share() {
    if (status === "preparing") return;
    setStatus("preparing");
    try {
      const blob = await renderShareCard(card);
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: card.title, text: card.subtitle, url: window.location.href, files: [file] });
        setStatus("shared");
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus("downloaded");
      }
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError" ? "idle" : "idle");
    }
  }

  return (
    <button type="button" onClick={share} disabled={status === "preparing"} aria-label={label} title={label} className={`share-card-button ${className}`}>
      <span className="material-symbols-outlined text-[18px]!" aria-hidden>{status === "shared" || status === "downloaded" ? "check" : "ios_share"}</span>
      <span className="share-card-button__label">{label}</span>
    </button>
  );
}
