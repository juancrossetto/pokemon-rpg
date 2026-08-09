import { beforeEach, describe, expect, it } from "vitest";
import { __resetScrollLockForTests, lockBodyScroll } from "@/lib/scroll-lock";

/** jsdom no viene en el entorno de vitest de este repo: alcanza con un stub. */
function stubBody(initial = "") {
  const body = { style: { overflow: initial } };
  (globalThis as { document?: unknown }).document = { body };
  return body;
}

describe("scroll-lock", () => {
  beforeEach(() => {
    __resetScrollLockForTests();
  });

  it("locks on the first holder and restores on the last", () => {
    const body = stubBody();
    const release = lockBodyScroll();
    expect(body.style.overflow).toBe("hidden");
    release();
    expect(body.style.overflow).toBe("");
  });

  it("keeps the lock while a second overlay is still open", () => {
    const body = stubBody();
    const releaseSheet = lockBodyScroll();
    const releasePanel = lockBodyScroll();

    // El panel de arriba se cierra: el sheet sigue abierto, no se suelta.
    releasePanel();
    expect(body.style.overflow).toBe("hidden");

    releaseSheet();
    expect(body.style.overflow).toBe("");
  });

  it("does not strand the lock when overlays close out of order", () => {
    const body = stubBody();
    // Este era el bug: el de abajo cerraba primero y el de arriba, al soltar,
    // reponía el "hidden" que había capturado — scroll muerto sin nada abierto.
    const releaseFirst = lockBodyScroll();
    const releaseSecond = lockBodyScroll();

    releaseFirst();
    expect(body.style.overflow).toBe("hidden");

    releaseSecond();
    expect(body.style.overflow).toBe("");
  });

  it("ignores a double release so the count cannot go negative", () => {
    const body = stubBody();
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();

    releaseA();
    releaseA();
    // B sigue vivo: dos llamadas de A no pueden dejar el fondo scrolleando.
    expect(body.style.overflow).toBe("hidden");

    releaseB();
    expect(body.style.overflow).toBe("");
  });

  it("restores whatever the body had before the first lock", () => {
    const body = stubBody("clip");
    const release = lockBodyScroll();
    expect(body.style.overflow).toBe("hidden");
    release();
    expect(body.style.overflow).toBe("clip");
  });
});
