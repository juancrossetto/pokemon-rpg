#!/usr/bin/env python3
"""Genera SFX cortos de batalla en WAV mono 16 kHz (~200 KB total)."""

from __future__ import annotations

import math
import os
import random
import struct
import wave
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "public", "audio", "battle", "sfx")
SR = 16000

KINDS = [
    "electric",
    "fire",
    "water",
    "ice",
    "grass",
    "rock",
    "ground",
    "wind",
    "psychic",
    "ghost",
    "poison",
    "steel",
    "dragon",
    "fairy",
    "dark",
    "bug",
    "contact",
    "hit",
    "damage",
    "energy",
    "crit",
    "superEffective",
    "miss",
    "faint",
    "status",
    "ball",
    "sendOut",
    "badge",
    "levelUp",
    "evolve",
    "heal",
    "restorePp",
    "victory",
    "defeat",
]


def clamp(x: float) -> float:
    return max(-1.0, min(1.0, x))


def write_wav(path: str, samples: list[float]) -> None:
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(clamp(s) * 32767)) for s in samples)
        w.writeframes(frames)


def env(i: int, n: int, a: float = 0.01, r: float = 0.12) -> float:
    t = i / n
    attack = min(1.0, t / a) if a > 0 else 1.0
    release = min(1.0, (1.0 - t) / r) if r > 0 else 1.0
    return attack * release


def tone_burst(
    freq: float,
    dur: float,
    amp: float = 0.45,
    wave: str = "sine",
    slide: float | None = None,
    a: float = 0.01,
    r: float = 0.15,
) -> list[float]:
    n = int(SR * dur)
    out: list[float] = []
    for i in range(n):
        t = i / SR
        f = freq if slide is None else freq + (slide - freq) * (i / max(1, n - 1))
        phase = 2 * math.pi * f * t
        if wave == "sine":
            s = math.sin(phase)
        elif wave == "square":
            s = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave == "saw":
            s = 2.0 * ((f * t) % 1.0) - 1.0
        else:
            s = 2.0 * abs(2.0 * ((f * t) % 1.0) - 1.0) - 1.0
        out.append(s * amp * env(i, n, a, r))
    return out


def noise_burst(
    rng: random.Random,
    dur: float,
    amp: float = 0.35,
    a: float = 0.005,
    r: float = 0.2,
    tint: float = 1.0,
) -> list[float]:
    n = int(SR * dur)
    out: list[float] = []
    prev = 0.0
    for i in range(n):
        white = rng.uniform(-1, 1)
        prev = prev + tint * (white - prev)
        out.append(prev * amp * env(i, n, a, r))
    return out


def mix(*tracks: tuple[float, list[float]]) -> list[float]:
    total = 0
    for off, samp in tracks:
        total = max(total, int(off * SR) + len(samp))
    out = [0.0] * total
    for off, samp in tracks:
        start = int(off * SR)
        for i, s in enumerate(samp):
            out[start + i] += s
    peak = max((abs(x) for x in out), default=1.0) or 1.0
    if peak > 0.95:
        out = [x * (0.95 / peak) for x in out]
    return out


def make(kind: str) -> list[float]:
    # crc32 y no hash(): el hash de strings de Python es aleatorio por proceso
    # (PYTHONHASHSEED), así que regenerar cambiaba el ruido de todos los WAV.
    rng = random.Random(zlib.crc32(kind.encode()))
    table = {
        "electric": lambda: mix(
            (0.0, noise_burst(rng, 0.05, 0.5, tint=0.9)),
            (0.0, tone_burst(980, 0.05, 0.35, "square")),
            (0.04, tone_burst(1500, 0.06, 0.3, "square")),
            (0.09, tone_burst(720, 0.12, 0.25, "saw", slide=180)),
            (0.08, noise_burst(rng, 0.08, 0.25, tint=0.7)),
        ),
        "fire": lambda: mix(
            (0.0, noise_burst(rng, 0.22, 0.4, r=0.35, tint=0.25)),
            (0.0, tone_burst(220, 0.18, 0.22, "saw", slide=110)),
            (0.05, tone_burst(340, 0.14, 0.18, "saw", slide=160)),
            (0.1, noise_burst(rng, 0.12, 0.22, tint=0.35)),
        ),
        "water": lambda: mix(
            (0.0, noise_burst(rng, 0.18, 0.28, tint=0.55)),
            (0.0, tone_burst(520, 0.12, 0.28, "sine", slide=260)),
            (0.06, tone_burst(380, 0.14, 0.22, "tri", slide=180)),
            (0.1, tone_burst(640, 0.08, 0.12, "sine")),
        ),
        "ice": lambda: mix(
            (0.0, tone_burst(1280, 0.08, 0.28, "tri", slide=780)),
            (0.03, tone_burst(980, 0.1, 0.22, "sine", slide=640)),
            (0.04, noise_burst(rng, 0.1, 0.18, tint=0.85)),
            (0.08, tone_burst(1560, 0.05, 0.12, "sine")),
        ),
        "grass": lambda: mix(
            (0.0, noise_burst(rng, 0.1, 0.2, tint=0.6)),
            (0.0, tone_burst(420, 0.1, 0.25, "tri", slide=620)),
            (0.05, tone_burst(560, 0.1, 0.2, "sine")),
            (0.09, tone_burst(720, 0.07, 0.12, "sine")),
        ),
        "rock": lambda: mix(
            (0.0, noise_burst(rng, 0.14, 0.4, tint=0.15)),
            (0.0, tone_burst(120, 0.12, 0.35, "square", slide=60)),
            (0.05, noise_burst(rng, 0.1, 0.28, tint=0.25)),
            (0.08, tone_burst(90, 0.1, 0.2, "square")),
        ),
        "ground": lambda: mix(
            (0.0, noise_burst(rng, 0.18, 0.45, tint=0.12)),
            (0.0, tone_burst(90, 0.16, 0.35, "square", slide=40)),
            (0.06, tone_burst(60, 0.14, 0.25, "square")),
        ),
        "wind": lambda: mix(
            (0.0, noise_burst(rng, 0.2, 0.32, tint=0.75)),
            (0.0, tone_burst(420, 0.12, 0.18, "sine", slide=720)),
            (0.05, tone_burst(580, 0.12, 0.15, "tri", slide=860)),
        ),
        "psychic": lambda: mix(
            (0.0, tone_burst(520, 0.14, 0.28, "sine", slide=900)),
            (0.04, tone_burst(860, 0.1, 0.2, "tri", slide=640)),
            (0.08, tone_burst(1100, 0.1, 0.16, "sine")),
            (0.1, tone_burst(760, 0.08, 0.12, "sine")),
        ),
        "ghost": lambda: mix(
            (0.0, tone_burst(240, 0.2, 0.28, "tri", slide=110)),
            (0.03, noise_burst(rng, 0.14, 0.2, tint=0.7)),
            (0.08, tone_burst(160, 0.16, 0.2, "sine", slide=80)),
        ),
        "poison": lambda: mix(
            (0.0, tone_burst(280, 0.14, 0.28, "saw", slide=170)),
            (0.04, tone_burst(180, 0.16, 0.22, "tri", slide=120)),
            (0.06, noise_burst(rng, 0.1, 0.16, tint=0.65)),
        ),
        "steel": lambda: mix(
            (0.0, tone_burst(820, 0.05, 0.3, "square")),
            (0.02, tone_burst(1100, 0.07, 0.25, "square", slide=700)),
            (0.03, noise_burst(rng, 0.06, 0.22, tint=0.8)),
            (0.07, tone_burst(640, 0.06, 0.12, "sine")),
        ),
        "dragon": lambda: mix(
            (0.0, tone_burst(160, 0.14, 0.32, "saw", slide=420)),
            (0.06, tone_burst(300, 0.14, 0.28, "saw", slide=820)),
            (0.08, noise_burst(rng, 0.1, 0.18, tint=0.5)),
        ),
        "fairy": lambda: mix(
            (0.0, tone_burst(920, 0.08, 0.22, "sine")),
            (0.04, tone_burst(1160, 0.09, 0.2, "tri")),
            (0.08, tone_burst(1380, 0.1, 0.18, "sine")),
            (0.1, tone_burst(1640, 0.08, 0.12, "sine")),
        ),
        "dark": lambda: mix(
            (0.0, tone_burst(200, 0.14, 0.3, "square", slide=70)),
            (0.02, noise_burst(rng, 0.14, 0.25, tint=0.55)),
            (0.07, tone_burst(120, 0.12, 0.22, "tri", slide=60)),
        ),
        "bug": lambda: mix(
            (0.0, tone_burst(640, 0.05, 0.2, "square")),
            (0.04, tone_burst(720, 0.05, 0.2, "square")),
            (0.08, tone_burst(560, 0.06, 0.2, "square")),
            (0.05, noise_burst(rng, 0.08, 0.12, tint=0.7)),
        ),
        "contact": lambda: mix(
            (0.0, noise_burst(rng, 0.08, 0.4, tint=0.2)),
            (0.0, tone_burst(130, 0.09, 0.35, "square", slide=55)),
            (0.03, noise_burst(rng, 0.05, 0.2, tint=0.5)),
        ),
        "hit": lambda: mix(
            (0.0, noise_burst(rng, 0.08, 0.35, tint=0.25)),
            (0.0, tone_burst(180, 0.08, 0.28, "square", slide=90)),
        ),
        "damage": lambda: mix(
            (0.0, noise_burst(rng, 0.09, 0.42, tint=0.18)),
            (0.0, tone_burst(95, 0.1, 0.3, "square", slide=45)),
            (0.03, noise_burst(rng, 0.05, 0.18, tint=0.45)),
        ),
        "energy": lambda: mix(
            (0.0, tone_burst(320, 0.12, 0.28, "sine", slide=620)),
            (0.06, tone_burst(580, 0.1, 0.22, "tri")),
            (0.04, noise_burst(rng, 0.1, 0.14, tint=0.55)),
        ),
        "crit": lambda: mix(
            (0.0, tone_burst(380, 0.07, 0.3, "square")),
            (0.05, tone_burst(520, 0.09, 0.28, "square")),
            (0.02, noise_burst(rng, 0.08, 0.18, tint=0.6)),
        ),
        "superEffective": lambda: mix(
            (0.0, tone_burst(280, 0.09, 0.3, "saw")),
            (0.06, tone_burst(450, 0.11, 0.28, "saw")),
            (0.03, noise_burst(rng, 0.1, 0.2, tint=0.55)),
        ),
        "miss": lambda: mix((0.0, tone_burst(160, 0.14, 0.2, "tri", slide=55))),
        "faint": lambda: mix(
            (0.0, tone_burst(240, 0.22, 0.28, "sine", slide=55)),
            (0.05, noise_burst(rng, 0.16, 0.18, tint=0.25)),
        ),
        "status": lambda: mix((0.0, tone_burst(320, 0.16, 0.22, "tri", slide=210))),
        "ball": lambda: mix(
            (0.0, tone_burst(500, 0.07, 0.22, "sine")),
            (0.08, tone_burst(640, 0.09, 0.22, "sine")),
        ),
        # Salida del Pokémon: click de apertura, chorro de energía que sube y
        # tres destellos mientras la silueta toma color. Dura ~0.63 s, que es
        # lo que tarda la apertura + la materialización en pantalla.
        "sendOut": lambda: mix(
            (0.0, tone_burst(880, 0.05, 0.2, "square", a=0.002, r=0.5)),
            (0.02, noise_burst(rng, 0.26, 0.15, a=0.02, r=0.5, tint=0.5)),
            (0.03, tone_burst(320, 0.3, 0.24, "tri", slide=1180, a=0.02, r=0.35)),
            (0.30, tone_burst(1046.5, 0.1, 0.17, "sine")),
            (0.38, tone_burst(1318.5, 0.12, 0.15, "sine")),
            (0.47, tone_burst(1568.0, 0.16, 0.13, "tri")),
        ),
        "badge": lambda: mix(
            (0.0, tone_burst(523, 0.1, 0.22, "sine")),
            (0.1, tone_burst(659, 0.1, 0.22, "sine")),
            (0.2, tone_burst(784, 0.16, 0.25, "sine")),
        ),
        "levelUp": lambda: mix(
            (0.0, tone_burst(392, 0.09, 0.2, "sine")),
            (0.08, tone_burst(523, 0.1, 0.22, "sine")),
            (0.17, tone_burst(659, 0.11, 0.22, "sine")),
            (0.28, tone_burst(784, 0.18, 0.25, "tri")),
        ),
        "evolve": lambda: mix(
            (0.0, tone_burst(220, 0.18, 0.2, "sine", slide=440)),
            (0.16, tone_burst(440, 0.14, 0.22, "tri", slide=660)),
            (0.3, tone_burst(660, 0.12, 0.22, "sine")),
            (0.42, tone_burst(880, 0.2, 0.25, "tri")),
        ),
        "heal": lambda: mix(
            (0.0, tone_burst(440, 0.08, 0.2, "sine")),
            (0.06, tone_burst(554, 0.09, 0.2, "sine")),
            (0.13, tone_burst(659, 0.12, 0.22, "tri")),
        ),
        "restorePp": lambda: mix(
            (0.0, tone_burst(540, 0.07, 0.18, "tri")),
            (0.07, tone_burst(640, 0.08, 0.2, "sine")),
            (0.15, tone_burst(760, 0.1, 0.2, "tri")),
        ),
        "victory": lambda: mix(
            (0.0, tone_burst(523.25, 0.12, 0.28, "sine")),
            (0.1, tone_burst(659.25, 0.12, 0.28, "sine")),
            (0.2, tone_burst(783.99, 0.14, 0.3, "tri")),
            (0.34, tone_burst(1046.5, 0.35, 0.32, "sine")),
            (0.38, noise_burst(rng, 0.08, 0.12, tint=0.6)),
            (0.55, tone_burst(1318.5, 0.2, 0.22, "tri")),
            (0.72, tone_burst(1568.0, 0.45, 0.18, "sine", slide=1200)),
        ),
        "defeat": lambda: mix(
            (0.0, tone_burst(392.0, 0.35, 0.28, "sine", slide=280)),
            (0.25, tone_burst(349.23, 0.35, 0.26, "sine", slide=220)),
            (0.5, tone_burst(293.66, 0.45, 0.24, "tri", slide=180)),
            (0.55, noise_burst(rng, 0.12, 0.1, tint=0.25)),
            (0.85, tone_burst(220.0, 0.55, 0.22, "sine", slide=140)),
        ),
    }
    fn = table.get(kind)
    if not fn:
        raise ValueError(kind)
    return fn()


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for kind in KINDS:
        path = os.path.join(OUT_DIR, f"{kind}.wav")
        write_wav(path, make(kind))
        total += os.path.getsize(path)
        print(f"{kind:16} {os.path.getsize(path):5} B")
    print(f"files: {len(KINDS)}")
    print(f"total_kb: {round(total / 1024, 1)}")


if __name__ == "__main__":
    main()
