const OFFICIAL_ARTWORK_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_YEAR = 60 * 60 * 24 * 365;

// Next analiza este export estáticamente: debe ser un literal, no una constante.
export const revalidate = 604800;

function parseSpeciesId(value: string): number | null {
  const match = value.match(/^(\d+)\.png$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id >= 1 && id <= 2000 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string; id: string }> },
) {
  const { variant, id: rawId } = await params;
  const id = parseSpeciesId(rawId);
  if ((variant !== "normal" && variant !== "shiny") || id == null) {
    return new Response("Not found", { status: 404 });
  }

  const source = variant === "shiny"
    ? `${OFFICIAL_ARTWORK_BASE}/shiny/${id}.png`
    : `${OFFICIAL_ARTWORK_BASE}/${id}.png`;

  const upstream = await fetch(source, {
    headers: { "User-Agent": "pokemon-rpg-art-cache/1.0" },
    next: { revalidate: ONE_WEEK },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Artwork unavailable", { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": `public, max-age=${ONE_WEEK}, stale-while-revalidate=${ONE_YEAR}`,
      ...(upstream.headers.get("etag")
        ? { ETag: upstream.headers.get("etag") as string }
        : {}),
    },
  });
}
