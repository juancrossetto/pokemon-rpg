import { beforeEach, describe, expect, it } from "vitest";
import { __resetScrollLockForTests, lockBodyScroll } from "@/lib/scroll-lock";

/** jsdom no viene en el entorno de vitest de este repo: alcanza con un stub. */
function stubDocument(bodyOverflow = "") {
  const body = { style: { overflow: bodyOverflow } };
  const attributes = new Map<string, string>();
  const documentElement = {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    hasAttribute: (name: string) => attributes.has(name),
  };
  (globalThis as { document?: unknown }).document = {
    body,
    documentElement,
    querySelector: () => null,
  };
  return { body, documentElement };
}

describe("scroll-lock", () => {
  beforeEach(() => {
    __resetScrollLockForTests();
  });

  it("locks on the first holder and restores on the last", () => {
    const { body } = stubDocument();
    const release = lockBodyScroll();
    expect(body.style.overflow).toBe("hidden");
    release();
    expect(body.style.overflow).toBe("");
  });

  it("keeps the lock while a second overlay is still open", () => {
    const { body, documentElement } = stubDocument();
    const releaseSheet = lockBodyScroll();
    const releasePanel = lockBodyScroll();
    expect(documentElement.hasAttribute("data-overlay-open")).toBe(true);

    // El panel de arriba se cierra: el sheet sigue abierto, no se suelta.
    releasePanel();
    expect(body.style.overflow).toBe("hidden");

    releaseSheet();
    expect(body.style.overflow).toBe("");
    expect(documentElement.hasAttribute("data-overlay-open")).toBe(false);
  });

  it("does not strand the lock when overlays close out of order", () => {
    const { body } = stubDocument();
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
    const { body } = stubDocument();
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
    const { body } = stubDocument("clip");
    const release = lockBodyScroll();
    expect(body.style.overflow).toBe("hidden");
    release();
    expect(body.style.overflow).toBe("clip");
  });
});
