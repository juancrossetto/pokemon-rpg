#!/usr/bin/env python3
"""
Tema de evolución (~7.3 s) sintetizado, alineado a las fases del popup:

    0.00–1.60  intro    pad menor + campana: "algo está pasando"
    1.60–4.80  morph    ostinato que acelera y sube de registro (la tensión
                        clásica mientras la silueta alterna)
    4.80–5.25  flash    swell de ruido + acorde sostenido
    5.25–7.30  reveal   resolución mayor, fanfarria

Sale WAV mono 22050 Hz; `main` lo convierte a m4a con afconvert (macOS) para
que pese como el resto del BGM. Determinístico: mismo archivo en cada corrida.
"""

from __future__ import annotations

import math
import os
import random
import struct
import subprocess
import wave

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "public", "audio", "battle")
SR = 22050
DURATION = 7.3

# La = 440. Semitonos desde A4.
def note(semitones_from_a4: float, octave_shift: int = 0) -> float:
    return 440.0 * (2 ** ((semitones_from_a4 + 12 * octave_shift) / 12.0))


# Grados que uso, en semitonos desde A4.
A, B, C, D, E, F, G = 0, 2, 3, 5, 7, 8, 10
HIGH_C, HIGH_D, HIGH_E, HIGH_G = 15, 17, 19, 22


def adsr(i: int, n: int, a: float, d: float, s: float, r: float) -> float:
    """Envolvente por muestra. a/d/r en fracción de la nota, s en ganancia."""
    t = i / max(1, n)
    if t < a:
        return t / a
    if t < a + d:
        return 1.0 - (1.0 - s) * ((t - a) / d)
    if t > 1.0 - r:
        return s * max(0.0, (1.0 - t) / r)
    return s


def osc(shape: str, phase: float) -> float:
    if shape == "sine":
        return math.sin(phase)
    if shape == "square":
        return 1.0 if math.sin(phase) >= 0 else -1.0
    if shape == "saw":
        return 2.0 * ((phase / (2 * math.pi)) % 1.0) - 1.0
    # triangle
    return 2.0 * abs(2.0 * ((phase / (2 * math.pi)) % 1.0) - 1.0) - 1.0


def tone(
    freq: float,
    dur: float,
    amp: float = 0.3,
    shape: str = "sine",
    a: float = 0.02,
    d: float = 0.15,
    s: float = 0.7,
    r: float = 0.35,
    detune: float = 0.0,
    vibrato: float = 0.0,
) -> list[float]:
    n = int(SR * dur)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        f = freq
        if vibrato:
            f *= 1.0 + vibrato * math.sin(2 * math.pi * 5.5 * t)
        v = osc(shape, 2 * math.pi * f * t)
        if detune:
            v = 0.6 * v + 0.4 * osc(shape, 2 * math.pi * f * (1 + detune) * t)
        out[i] = v * amp * adsr(i, n, a, d, s, r)
    return out


def bell(freq: float, dur: float, amp: float = 0.24) -> list[float]:
    """Campana: fundamental + parciales inarmónicos que decaen rápido."""
    n = int(SR * dur)
    out = [0.0] * n
    partials = ((1.0, 1.0), (2.76, 0.5), (5.4, 0.28), (8.9, 0.14))
    for i in range(n):
        t = i / SR
        v = 0.0
        for mult, weight in partials:
            v += weight * math.sin(2 * math.pi * freq * mult * t) * math.exp(-3.2 * mult * t)
        out[i] = v * amp * min(1.0, i / (SR * 0.004))
    return out


def swell(rng: random.Random, dur: float, amp: float = 0.3) -> list[float]:
    """Ruido que crece: el "shhh" antes del flash."""
    n = int(SR * dur)
    out = [0.0] * n
    prev = 0.0
    for i in range(n):
        t = i / n
        white = rng.uniform(-1, 1)
        prev = prev + 0.35 * (white - prev)
        out[i] = prev * amp * (t**2.2)
    return out


def crash(rng: random.Random, dur: float, amp: float = 0.34) -> list[float]:
    n = int(SR * dur)
    out = [0.0] * n
    prev = 0.0
    for i in range(n):
        white = rng.uniform(-1, 1)
        prev = prev + 0.75 * (white - prev)
        out[i] = prev * amp * math.exp(-4.5 * (i / SR))
    return out


def place(track: list[float], at: float, samples: list[float]) -> None:
    start = int(at * SR)
    for i, s in enumerate(samples):
        j = start + i
        if 0 <= j < len(track):
            track[j] += s


def build() -> list[float]:
    rng = random.Random(20260806)
    track = [0.0] * int(SR * DURATION)

    # ---- Intro (0.00–1.60): pad menor + dos campanas.
    for f, amp in ((note(A, -2), 0.15), (note(C, -1), 0.1), (note(E, -1), 0.09)):
        place(track, 0.0, tone(f, 1.9, amp, "tri", a=0.25, d=0.2, s=0.75, r=0.35))
    place(track, 0.15, bell(note(E, 1), 1.1, 0.2))
    place(track, 0.85, bell(note(A, 1), 1.0, 0.17))

    # ---- Morph (1.60–4.80): ostinato que acelera y sube.
    # Cada bloque divide más el pulso: 8vos → 16vos → 32vos. Es lo que
    # traduce la aceleración de la silueta alternando en pantalla.
    blocks = (
        (1.60, 0.200, 8, (A, C, E, C), -1, 0.20),
        (3.20, 0.150, 6, (A, D, F, D), 0, 0.23),
        (4.10, 0.100, 5, (B, E, G, E), 0, 0.26),
        (4.60, 0.062, 4, (C, F, A, F), 1, 0.28),
    )
    for start, step, count, degrees, octv, amp in blocks:
        for i in range(count):
            deg = degrees[i % len(degrees)]
            place(
                track,
                start + i * step,
                tone(
                    note(deg, octv),
                    step * 1.45,
                    amp,
                    "square",
                    a=0.01,
                    d=0.3,
                    s=0.45,
                    r=0.4,
                    detune=0.004,
                ),
            )
        # Bajo pulsando debajo, una nota por bloque.
        place(track, start, tone(note(A, -2), step * count, 0.16, "tri", a=0.03, r=0.3))

    # ---- Flash (4.80–5.25): swell + platillo + acorde sostenido.
    place(track, 4.42, swell(rng, 0.46, 0.26))
    place(track, 4.86, crash(rng, 0.9, 0.3))
    for f, amp in ((note(C, 0), 0.16), (note(E, 0), 0.14), (note(G, 0), 0.13)):
        place(track, 4.86, tone(f, 0.9, amp, "saw", a=0.005, d=0.3, s=0.5, r=0.5, detune=0.005))

    # ---- Reveal (5.25–7.30): fanfarria mayor, resuelve en Do.
    fanfare = (
        (5.28, HIGH_C, 0.26, 0.30, "square"),
        (5.52, HIGH_E, 0.26, 0.30, "square"),
        (5.76, HIGH_G, 0.34, 0.30, "square"),
        (6.08, HIGH_E, 0.20, 0.26, "tri"),
        (6.26, HIGH_G, 0.24, 0.28, "square"),
        (6.50, HIGH_C + 12, 1.10, 0.32, "square"),
    )
    for at, deg, dur, amp, shape in fanfare:
        place(track, at, tone(note(deg), dur, amp, shape, a=0.008, d=0.22, s=0.72, r=0.35, detune=0.003))
    # Colchón mayor sosteniendo la resolución + campana final.
    for f, amp in ((note(C, -1), 0.15), (note(E, -1), 0.12), (note(G, -1), 0.11), (note(C, 0), 0.1)):
        place(track, 6.46, tone(f, 0.95, amp, "tri", a=0.02, d=0.3, s=0.72, r=0.45))
    place(track, 6.52, bell(note(HIGH_C), 0.85, 0.2))

    # Normalizo con un poco de aire para que el m4a no clipee.
    peak = max((abs(x) for x in track), default=1.0) or 1.0
    if peak > 0.9:
        track = [x * (0.9 / peak) for x in track]
    # Fade final para cortar limpio.
    tail = int(SR * 0.25)
    for i in range(tail):
        track[len(track) - tail + i] *= 1.0 - i / tail
    return track


def write_wav(path: str, samples: list[float]) -> None:
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples
        )
        w.writeframes(frames)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    wav_path = os.path.join(OUT_DIR, "evolution.wav")
    m4a_path = os.path.join(OUT_DIR, "evolution.m4a")
    write_wav(wav_path, build())
    print(f"wav {os.path.getsize(wav_path) // 1024} KB")
    try:
        subprocess.run(
            # aac@44100: el encoder de afconvert rechaza 22050 con '!dat'.
            ["afconvert", "-f", "m4af", "-d", "aac@44100", "-b", "80000", wav_path, m4a_path],
            check=True,
            capture_output=True,
        )
        os.remove(wav_path)
        print(f"m4a {os.path.getsize(m4a_path) // 1024} KB")
    except (FileNotFoundError, subprocess.CalledProcessError) as err:
        print(f"afconvert no disponible ({err}); queda el WAV")


if __name__ == "__main__":
    main()
