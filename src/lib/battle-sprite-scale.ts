/**
 * Altura en metros (PokeAPI) — Gen I + II. Usada para escalar sprites de batalla.
 *
 * Ojo al sumar una generación nueva a la seed: una especie que falte acá cae al
 * default de 1 m, así que los chiquitos (Cyndaquil 0.5, Totodile 0.6) se
 * dibujan más grandes de lo que les toca y parece que el arena tuviera zoom.
 */
export const SPECIES_HEIGHT_M: Readonly<Record<string, number>> = {
  "bulbasaur": 0.7,
  "ivysaur": 1.0,
  "venusaur": 2.0,
  "charmander": 0.6,
  "charmeleon": 1.1,
  "charizard": 1.7,
  "squirtle": 0.5,
  "wartortle": 1.0,
  "blastoise": 1.6,
  "caterpie": 0.3,
  "metapod": 0.7,
  "butterfree": 1.1,
  "weedle": 0.3,
  "kakuna": 0.6,
  "beedrill": 1.0,
  "pidgey": 0.3,
  "pidgeotto": 1.1,
  "pidgeot": 1.5,
  "rattata": 0.3,
  "raticate": 0.7,
  "spearow": 0.3,
  "fearow": 1.2,
  "ekans": 2.0,
  "arbok": 3.5,
  "pikachu": 0.4,
  "raichu": 0.8,
  "sandshrew": 0.6,
  "sandslash": 1.0,
  "nidoran-f": 0.4,
  "nidorina": 0.8,
  "nidoqueen": 1.3,
  "nidoran-m": 0.5,
  "nidorino": 0.9,
  "nidoking": 1.4,
  "clefairy": 0.6,
  "clefable": 1.3,
  "vulpix": 0.6,
  "ninetales": 1.1,
  "jigglypuff": 0.5,
  "wigglytuff": 1.0,
  "zubat": 0.8,
  "golbat": 1.6,
  "oddish": 0.5,
  "gloom": 0.8,
  "vileplume": 1.2,
  "paras": 0.3,
  "parasect": 1.0,
  "venonat": 1.0,
  "venomoth": 1.5,
  "diglett": 0.2,
  "dugtrio": 0.7,
  "meowth": 0.4,
  "persian": 1.0,
  "psyduck": 0.8,
  "golduck": 1.7,
  "mankey": 0.5,
  "primeape": 1.0,
  "growlithe": 0.7,
  "arcanine": 1.9,
  "poliwag": 0.6,
  "poliwhirl": 1.0,
  "poliwrath": 1.3,
  "abra": 0.9,
  "kadabra": 1.3,
  "alakazam": 1.5,
  "machop": 0.8,
  "machoke": 1.5,
  "machamp": 1.6,
  "bellsprout": 0.7,
  "weepinbell": 1.0,
  "victreebel": 1.7,
  "tentacool": 0.9,
  "tentacruel": 1.6,
  "geodude": 0.4,
  "graveler": 1.0,
  "golem": 1.4,
  "ponyta": 1.0,
  "rapidash": 1.7,
  "slowpoke": 1.2,
  "slowbro": 1.6,
  "magnemite": 0.3,
  "magneton": 1.0,
  "farfetchd": 0.8,
  "doduo": 1.4,
  "dodrio": 1.8,
  "seel": 1.1,
  "dewgong": 1.7,
  "grimer": 0.9,
  "muk": 1.2,
  "shellder": 0.3,
  "cloyster": 1.5,
  "gastly": 1.3,
  "haunter": 1.6,
  "gengar": 1.5,
  "onix": 8.8,
  "drowzee": 1.0,
  "hypno": 1.6,
  "krabby": 0.4,
  "kingler": 1.3,
  "voltorb": 0.5,
  "electrode": 1.2,
  "exeggcute": 0.4,
  "exeggutor": 2.0,
  "cubone": 0.4,
  "marowak": 1.0,
  "hitmonlee": 1.5,
  "hitmonchan": 1.4,
  "lickitung": 1.2,
  "koffing": 0.6,
  "weezing": 1.2,
  "rhyhorn": 1.0,
  "rhydon": 1.9,
  "chansey": 1.1,
  "tangela": 1.0,
  "kangaskhan": 2.2,
  "horsea": 0.4,
  "seadra": 1.2,
  "goldeen": 0.6,
  "seaking": 1.3,
  "staryu": 0.8,
  "starmie": 1.1,
  "mr-mime": 1.3,
  "scyther": 1.5,
  "jynx": 1.4,
  "electabuzz": 1.1,
  "magmar": 1.3,
  "pinsir": 1.5,
  "tauros": 1.4,
  "magikarp": 0.9,
  "gyarados": 6.5,
  "lapras": 2.5,
  "ditto": 0.3,
  "eevee": 0.3,
  "vaporeon": 1.0,
  "jolteon": 0.8,
  "flareon": 0.9,
  "porygon": 0.8,
  "omanyte": 0.4,
  "omastar": 1.0,
  "kabuto": 0.5,
  "kabutops": 1.3,
  "aerodactyl": 1.8,
  "snorlax": 2.1,
  "articuno": 1.7,
  "zapdos": 1.6,
  "moltres": 2.0,
  "dratini": 1.8,
  "dragonair": 4.0,
  "dragonite": 2.2,
  "mewtwo": 2.0,
  "mew": 0.4,
  "chikorita": 0.9,
  "bayleef": 1.2,
  "meganium": 1.8,
  "cyndaquil": 0.5,
  "quilava": 0.9,
  "typhlosion": 1.7,
  "totodile": 0.6,
  "croconaw": 1.1,
  "feraligatr": 2.3,
  "sentret": 0.8,
  "furret": 1.8,
  "hoothoot": 0.7,
  "noctowl": 1.6,
  "ledyba": 1.0,
  "ledian": 1.4,
  "spinarak": 0.5,
  "ariados": 1.1,
  "crobat": 1.8,
  "chinchou": 0.5,
  "lanturn": 1.2,
  "pichu": 0.3,
  "cleffa": 0.3,
  "igglybuff": 0.3,
  "togepi": 0.3,
  "togetic": 0.6,
  "natu": 0.2,
  "xatu": 1.5,
  "mareep": 0.6,
  "flaaffy": 0.8,
  "ampharos": 1.4,
  "bellossom": 0.4,
  "marill": 0.4,
  "azumarill": 0.8,
  "sudowoodo": 1.2,
  "politoed": 1.1,
  "hoppip": 0.4,
  "skiploom": 0.6,
  "jumpluff": 0.8,
  "aipom": 0.8,
  "sunkern": 0.3,
  "sunflora": 0.8,
  "yanma": 1.2,
  "wooper": 0.4,
  "quagsire": 1.4,
  "espeon": 0.9,
  "umbreon": 1.0,
  "murkrow": 0.5,
  "slowking": 2.0,
  "misdreavus": 0.7,
  "unown": 0.5,
  "wobbuffet": 1.3,
  "girafarig": 1.5,
  "pineco": 0.6,
  "forretress": 1.2,
  "dunsparce": 1.5,
  "gligar": 1.1,
  "steelix": 9.2,
  "snubbull": 0.6,
  "granbull": 1.4,
  "qwilfish": 0.5,
  "scizor": 1.8,
  "shuckle": 0.6,
  "heracross": 1.5,
  "sneasel": 0.9,
  "teddiursa": 0.6,
  "ursaring": 1.8,
  "slugma": 0.7,
  "magcargo": 0.8,
  "swinub": 0.4,
  "piloswine": 1.1,
  "corsola": 0.6,
  "remoraid": 0.6,
  "octillery": 0.9,
  "delibird": 0.9,
  "mantine": 2.1,
  "skarmory": 1.7,
  "houndour": 0.6,
  "houndoom": 1.4,
  "kingdra": 1.8,
  "phanpy": 0.5,
  "donphan": 1.1,
  "porygon2": 0.6,
  "stantler": 1.4,
  "smeargle": 1.2,
  "tyrogue": 0.7,
  "hitmontop": 1.4,
  "smoochum": 0.4,
  "elekid": 0.6,
  "magby": 0.7,
  "miltank": 1.2,
  "blissey": 1.5,
  "raikou": 1.9,
  "entei": 2.1,
  "suicune": 2.0,
  "larvitar": 0.6,
  "pupitar": 1.2,
  "tyranitar": 2.0,
  "lugia": 5.2,
  "ho-oh": 3.8,
  "celebi": 0.6,
};

const HEIGHT_CAP_M = 3.5;
/** Escala relativa: Abra chico, Venusaur grande, Onix/Gyarados capeados. */
const SCALE_MIN = 0.62;
const SCALE_MAX = 1.18;

/** Factor ~0.62–1.18 según altura de la especie (Onix/Gyarados se capean). */
export function battleSpeciesScale(speciesName: string): number {
  const key = speciesName.trim().toLowerCase();
  const raw = SPECIES_HEIGHT_M[key] ?? 1;
  const h = Math.min(raw, HEIGHT_CAP_M);
  const t = Math.min(1, Math.max(0, (h - 0.25) / (HEIGHT_CAP_M - 0.25)));
  return SCALE_MIN + t * (SCALE_MAX - SCALE_MIN);
}

/**
 * Fracción del alto del campo (antes de escala por especie).
 *
 * Sólo se usan como respaldo cuando la especie no está en `SPRITE_NATURAL_PX`:
 * el camino normal es `spriteBoxFromNatural`, que dimensiona desde el arte.
 */
export const BATTLE_PLAYER_SPRITE_FRAC = 0.42;
export const BATTLE_WILD_SPRITE_FRAC = 0.3;

/**
 * Factores de Showdown, medidos en su propio `scene-test` (gen 6, `ani`,
 * scale on): el sprite de frente se dibuja 1:1 y el de espalda 1.49× —
 * el de espalda va más grande porque está "más cerca" de la cámara.
 *
 * Van sobre el tamaño **nativo** del GIF y no sobre el alto del campo, porque
 * el arte de Showdown ya codifica el tamaño de la especie (Charizard 172px,
 * Cyndaquil 45px). Escalar además por altura era contar lo mismo dos veces:
 * dimensionar contra el arena dejaba a Cyndaquil en 4.4× y a Charizard en
 * 0.5×, o sea el chico reventado y el grande aplastado.
 */
export const BATTLE_BACK_SPRITE_SCALE = 1.5;
export const BATTLE_FRONT_SPRITE_SCALE = 1;

/**
 * Ancho nativo de los fondos de batalla de Showdown (753×500). El arena se
 * dibuja a este ancho —o a un múltiplo entero— para que el bitmap del fondo
 * quede 1:1: más angosto lo encoge y más ancho lo estira, y las dos cosas
 * comen detalle en pixel art.
 */
export const BATTLE_ARENA_BASE_W = 753;

/**
 * Caja del sprite a partir de su resolución nativa (modelo Showdown).
 * `maxPx` acota en pantallas chicas, donde un sprite a tamaño natural se
 * comería el campo.
 */
export function spriteBoxFromNatural(
  naturalPx: number,
  facing: "front" | "back",
  maxPx: number,
): number {
  const factor = facing === "back" ? BATTLE_BACK_SPRITE_SCALE : BATTLE_FRONT_SPRITE_SCALE;
  return Math.max(1, Math.min(Math.round(naturalPx * factor), Math.round(maxPx)));
}

/**
 * Tope vs ancho del campo: en mobile el arena es muy alto y angosto; si el
 * tamaño sale sólo del alto, el sprite se pasa de ancho y se ve cortado/deformado.
 */
export const BATTLE_PLAYER_SPRITE_WIDTH_CAP = 0.62;
export const BATTLE_WILD_SPRITE_WIDTH_CAP = 0.48;


