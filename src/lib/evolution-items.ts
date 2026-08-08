/**
 * Catálogo de objetos evolutivos (Wikidex / main series).
 *
 * Módulo puro: sin Prisma. El seed, la tienda (gemas) y el remap de especies
 * leen de acá. Las piedras clásicas siguen en monedas (`items.ts`); acá van
 * los que en los juegos eran trueque / held+trueque / contacto especial y en
 * este RPG se usan como “usar objeto” (mismo patrón que Cordón Unión).
 *
 * Si la especie aún no está en la base, el remap no hace nada (0 filas) y el
 * ítem igual queda en la tienda listo para cuando el dex crezca.
 */

/** Sustituye el trueque puro (Kadabra, Machoke, Graveler, Haunter). */
export const LINKING_CORD = "Linking Cord";

/**
 * Species hijo (forma evolucionada) → objeto que dispara la evo.
 * IDs nacionales PokeAPI (formas regionales aparte cuando existan).
 */
export const SPECIES_EVOLUTION_ITEM: Readonly<Record<number, string>> = {
  // Trueque puro → Cordón Unión (SV)
  65: LINKING_CORD, // Alakazam
  68: LINKING_CORD, // Machamp
  76: LINKING_CORD, // Golem
  94: LINKING_CORD, // Gengar

  // Trueque + objeto → usar objeto
  186: "King's Rock", // Politoed
  199: "King's Rock", // Slowking
  208: "Metal Coat", // Steelix
  212: "Metal Coat", // Scizor
  230: "Dragon Scale", // Kingdra
  233: "Up-Grade", // Porygon2
  367: "Deep Sea Tooth", // Huntail
  368: "Deep Sea Scale", // Gorebyss
  464: "Protector", // Rhyperior
  466: "Electirizer", // Electivire
  467: "Magmarizer", // Magmortar
  474: "Dubious Disc", // Porygon-Z
  477: "Reaper Cloth", // Dusknoir
  350: "Prism Scale", // Milotic
  683: "Sachet", // Aromatisse
  685: "Whipped Dream", // Softboiled… Slurpuff

  // Held + level → contacto (simplificado a usar objeto)
  113: "Oval Stone", // Chansey ← Happiny
  461: "Razor Claw", // Weavile
  472: "Razor Fang", // Gliscor

  // Contacto Galar / Hisui / Paldea / Kitakami
  841: "Tart Apple", // Flapple
  842: "Sweet Apple", // Appletun
  855: "Cracked Pot", // Polteageist
  900: "Black Augurite", // Kleavor
  901: "Peat Block", // Ursaluna
  936: "Auspicious Armor", // Armarouge
  937: "Malicious Armor", // Ceruledge
  983: "Leader's Crest", // Kingambit
  1000: "Gimmighoul Coin", // Gholdengo (acumulación: lógica futura)
  1011: "Syrupy Apple", // Dipplin
  1013: "Unremarkable Teacup", // Sinistcha
  1018: "Metal Alloy", // Archaludon
};

/**
 * Catálogo comprable por gemas.
 * King's Rock ya existe como HELD — el seed de held ajusta `gemPrice`.
 */
export type GemEvolutionItemDef = {
  name: string;
  gemPrice: number;
  effectText: string;
  /** Si true, no se crea fila EVOLUTION_STONE (ya vive como HELD u otro). */
  skipCreate?: boolean;
};

export const GEM_EVOLUTION_ITEMS: readonly GemEvolutionItemDef[] = [
  {
    name: LINKING_CORD,
    gemPrice: 8,
    effectText: "Evoluciona a las especies que normalmente requieren intercambio.",
  },
  {
    name: "King's Rock",
    gemPrice: 7,
    effectText: "Evoluciona a Poliwhirl y Slowpoke. En combate puede causar flinch.",
    skipCreate: true,
  },
  {
    name: "Metal Coat",
    gemPrice: 7,
    effectText: "Evoluciona a Onix y Scyther (Steelix / Scizor).",
  },
  {
    name: "Dragon Scale",
    gemPrice: 7,
    effectText: "Evoluciona a Seadra en Kingdra.",
  },
  {
    name: "Up-Grade",
    gemPrice: 6,
    effectText: "Evoluciona a Porygon en Porygon2.",
  },
  {
    name: "Dubious Disc",
    gemPrice: 6,
    effectText: "Evoluciona a Porygon2 en Porygon-Z.",
  },
  {
    name: "Protector",
    gemPrice: 6,
    effectText: "Evoluciona a Rhydon en Rhyperior.",
  },
  {
    name: "Electirizer",
    gemPrice: 6,
    effectText: "Evoluciona a Electabuzz en Electivire.",
  },
  {
    name: "Magmarizer",
    gemPrice: 6,
    effectText: "Evoluciona a Magmar en Magmortar.",
  },
  {
    name: "Reaper Cloth",
    gemPrice: 6,
    effectText: "Evoluciona a Dusclops en Dusknoir.",
  },
  {
    name: "Deep Sea Tooth",
    gemPrice: 6,
    effectText: "Evoluciona a Clamperl en Huntail.",
  },
  {
    name: "Deep Sea Scale",
    gemPrice: 6,
    effectText: "Evoluciona a Clamperl en Gorebyss.",
  },
  {
    name: "Prism Scale",
    gemPrice: 6,
    effectText: "Evoluciona a Feebas en Milotic.",
  },
  {
    name: "Sachet",
    gemPrice: 6,
    effectText: "Evoluciona a Spritzee en Aromatisse.",
  },
  {
    name: "Whipped Dream",
    gemPrice: 6,
    effectText: "Evoluciona a Swirlix en Slurpuff.",
  },
  {
    name: "Oval Stone",
    gemPrice: 5,
    effectText: "Evoluciona a Happiny en Chansey.",
  },
  {
    name: "Razor Claw",
    gemPrice: 5,
    effectText: "Evoluciona a Sneasel en Weavile.",
  },
  {
    name: "Razor Fang",
    gemPrice: 5,
    effectText: "Evoluciona a Gligar en Gliscor.",
  },
  {
    name: "Tart Apple",
    gemPrice: 6,
    effectText: "Evoluciona a Applin en Flapple.",
  },
  {
    name: "Sweet Apple",
    gemPrice: 6,
    effectText: "Evoluciona a Applin en Appletun.",
  },
  {
    name: "Syrupy Apple",
    gemPrice: 6,
    effectText: "Evoluciona a Applin en Dipplin.",
  },
  {
    name: "Cracked Pot",
    gemPrice: 6,
    effectText: "Evoluciona a Sinistea (genuino) en Polteageist.",
  },
  {
    name: "Chipped Pot",
    gemPrice: 6,
    effectText: "Evoluciona a Sinistea (falsificado) en Polteageist.",
  },
  {
    name: "Galarica Cuff",
    gemPrice: 6,
    effectText: "Evoluciona a Slowpoke de Galar en Slowbro de Galar.",
  },
  {
    name: "Galarica Wreath",
    gemPrice: 6,
    effectText: "Evoluciona a Slowpoke de Galar en Slowking de Galar.",
  },
  {
    name: "Black Augurite",
    gemPrice: 7,
    effectText: "Evoluciona a Scyther en Kleavor.",
  },
  {
    name: "Peat Block",
    gemPrice: 7,
    effectText: "Evoluciona a Ursaring en Ursaluna.",
  },
  {
    name: "Auspicious Armor",
    gemPrice: 8,
    effectText: "Evoluciona a Charcadet en Armarouge.",
  },
  {
    name: "Malicious Armor",
    gemPrice: 8,
    effectText: "Evoluciona a Charcadet en Ceruledge.",
  },
  {
    name: "Metal Alloy",
    gemPrice: 7,
    effectText: "Evoluciona a Duraludon en Archaludon.",
  },
  {
    name: "Scroll of Darkness",
    gemPrice: 10,
    effectText: "Evoluciona a Kubfu en Urshifu estilo brusco.",
  },
  {
    name: "Scroll of Waters",
    gemPrice: 10,
    effectText: "Evoluciona a Kubfu en Urshifu estilo fluido.",
  },
  {
    name: "Unremarkable Teacup",
    gemPrice: 6,
    effectText: "Evoluciona a Poltchageist (fraudulento) en Sinistcha.",
  },
  {
    name: "Masterpiece Teacup",
    gemPrice: 6,
    effectText: "Evoluciona a Poltchageist (opulento) en Sinistcha.",
  },
  {
    name: "Leader's Crest",
    gemPrice: 8,
    effectText: "Evoluciona a Bisharp en Kingambit.",
  },
  {
    name: "Gimmighoul Coin",
    gemPrice: 1,
    effectText: "Acumulá 999 para evolucionar a Gimmighoul en Gholdengo (uso futuro).",
  },
] as const;

/** Objetos que sustituyen un trueque: la UI muestra el hint de intercambio. */
export const TRADE_SUBSTITUTE_ITEMS: ReadonlySet<string> = new Set([
  LINKING_CORD,
  "King's Rock",
  "Metal Coat",
  "Dragon Scale",
  "Up-Grade",
  "Dubious Disc",
  "Protector",
  "Electirizer",
  "Magmarizer",
  "Reaper Cloth",
  "Deep Sea Tooth",
  "Deep Sea Scale",
  "Prism Scale",
  "Sachet",
  "Whipped Dream",
]);

/** Piedras clásicas adicionales (monedas), además de las 5 de Kanto. */
export const EXTRA_EVOLUTION_STONES = [
  {
    name: "Sun Stone",
    buyPrice: 2100,
    effectText: "Evoluciona a Gloom, Sunkern y otras especies afines.",
  },
  {
    name: "Shiny Stone",
    buyPrice: 2100,
    effectText: "Evoluciona a Togetic, Roselia y otras especies afines.",
  },
  {
    name: "Dusk Stone",
    buyPrice: 2100,
    effectText: "Evoluciona a Murkrow, Misdreavus y otras especies afines.",
  },
  {
    name: "Dawn Stone",
    buyPrice: 2100,
    effectText: "Evoluciona a Kirlia (♂) y Snorunt (♀).",
  },
  {
    name: "Ice Stone",
    buyPrice: 2100,
    effectText: "Evoluciona a Eevee (Glaceon) y otras especies de tipo Hielo.",
  },
] as const;

export function isTradeSubstituteItem(name: string): boolean {
  return TRADE_SUBSTITUTE_ITEMS.has(name);
}

/**
 * Recetas para el detalle del ítem: `from → ítem → to`.
 *
 * Los `spriteId` son ids de Pokémon en PokeAPI (incluye formas regionales
 * 10xxx). No hace falta tener la especie en nuestra DB: el CDN de HOME sirve
 * el PNG igual. Cuando el dex crezca, estos ids siguen siendo válidos.
 */
export type ItemEvolutionRecipe = {
  itemName: string;
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
};

export const ITEM_EVOLUTION_RECIPES: readonly ItemEvolutionRecipe[] = [
  // Cordón Unión
  { itemName: LINKING_CORD, fromId: 64, fromName: "Kadabra", toId: 65, toName: "Alakazam" },
  { itemName: LINKING_CORD, fromId: 67, fromName: "Machoke", toId: 68, toName: "Machamp" },
  { itemName: LINKING_CORD, fromId: 75, fromName: "Graveler", toId: 76, toName: "Golem" },
  { itemName: LINKING_CORD, fromId: 93, fromName: "Haunter", toId: 94, toName: "Gengar" },
  // Trueque + held
  { itemName: "King's Rock", fromId: 61, fromName: "Poliwhirl", toId: 186, toName: "Politoed" },
  { itemName: "King's Rock", fromId: 79, fromName: "Slowpoke", toId: 199, toName: "Slowking" },
  { itemName: "Metal Coat", fromId: 95, fromName: "Onix", toId: 208, toName: "Steelix" },
  { itemName: "Metal Coat", fromId: 123, fromName: "Scyther", toId: 212, toName: "Scizor" },
  { itemName: "Dragon Scale", fromId: 117, fromName: "Seadra", toId: 230, toName: "Kingdra" },
  { itemName: "Up-Grade", fromId: 137, fromName: "Porygon", toId: 233, toName: "Porygon2" },
  { itemName: "Dubious Disc", fromId: 233, fromName: "Porygon2", toId: 474, toName: "Porygon-Z" },
  { itemName: "Protector", fromId: 112, fromName: "Rhydon", toId: 464, toName: "Rhyperior" },
  { itemName: "Electirizer", fromId: 125, fromName: "Electabuzz", toId: 466, toName: "Electivire" },
  { itemName: "Magmarizer", fromId: 126, fromName: "Magmar", toId: 467, toName: "Magmortar" },
  { itemName: "Reaper Cloth", fromId: 356, fromName: "Dusclops", toId: 477, toName: "Dusknoir" },
  { itemName: "Deep Sea Tooth", fromId: 366, fromName: "Clamperl", toId: 367, toName: "Huntail" },
  { itemName: "Deep Sea Scale", fromId: 366, fromName: "Clamperl", toId: 368, toName: "Gorebyss" },
  { itemName: "Prism Scale", fromId: 349, fromName: "Feebas", toId: 350, toName: "Milotic" },
  { itemName: "Sachet", fromId: 682, fromName: "Spritzee", toId: 683, toName: "Aromatisse" },
  { itemName: "Whipped Dream", fromId: 684, fromName: "Swirlix", toId: 685, toName: "Slurpuff" },
  // Held + level → contacto
  { itemName: "Oval Stone", fromId: 440, fromName: "Happiny", toId: 113, toName: "Chansey" },
  { itemName: "Razor Claw", fromId: 215, fromName: "Sneasel", toId: 461, toName: "Weavile" },
  { itemName: "Razor Fang", fromId: 207, fromName: "Gligar", toId: 472, toName: "Gliscor" },
  // Contacto moderno
  { itemName: "Tart Apple", fromId: 840, fromName: "Applin", toId: 841, toName: "Flapple" },
  { itemName: "Sweet Apple", fromId: 840, fromName: "Applin", toId: 842, toName: "Appletun" },
  { itemName: "Syrupy Apple", fromId: 840, fromName: "Applin", toId: 1011, toName: "Dipplin" },
  { itemName: "Cracked Pot", fromId: 854, fromName: "Sinistea", toId: 855, toName: "Polteageist" },
  { itemName: "Chipped Pot", fromId: 854, fromName: "Sinistea", toId: 855, toName: "Polteageist" },
  { itemName: "Galarica Cuff", fromId: 10164, fromName: "Slowpoke (Galar)", toId: 10165, toName: "Slowbro (Galar)" },
  { itemName: "Galarica Wreath", fromId: 10164, fromName: "Slowpoke (Galar)", toId: 10172, toName: "Slowking (Galar)" },
  { itemName: "Black Augurite", fromId: 123, fromName: "Scyther", toId: 900, toName: "Kleavor" },
  { itemName: "Peat Block", fromId: 217, fromName: "Ursaring", toId: 901, toName: "Ursaluna" },
  { itemName: "Auspicious Armor", fromId: 935, fromName: "Charcadet", toId: 936, toName: "Armarouge" },
  { itemName: "Malicious Armor", fromId: 935, fromName: "Charcadet", toId: 937, toName: "Ceruledge" },
  { itemName: "Metal Alloy", fromId: 884, fromName: "Duraludon", toId: 1018, toName: "Archaludon" },
  { itemName: "Scroll of Darkness", fromId: 891, fromName: "Kubfu", toId: 892, toName: "Urshifu" },
  { itemName: "Scroll of Waters", fromId: 891, fromName: "Kubfu", toId: 10191, toName: "Urshifu (Rapid)" },
  { itemName: "Unremarkable Teacup", fromId: 1012, fromName: "Poltchageist", toId: 1013, toName: "Sinistcha" },
  { itemName: "Masterpiece Teacup", fromId: 1012, fromName: "Poltchageist", toId: 1013, toName: "Sinistcha" },
  { itemName: "Leader's Crest", fromId: 624, fromName: "Bisharp", toId: 983, toName: "Kingambit" },
  { itemName: "Gimmighoul Coin", fromId: 999, fromName: "Gimmighoul", toId: 1000, toName: "Gholdengo" },
];

const recipesByItem = new Map<string, ItemEvolutionRecipe[]>();
for (const recipe of ITEM_EVOLUTION_RECIPES) {
  const list = recipesByItem.get(recipe.itemName) ?? [];
  list.push(recipe);
  recipesByItem.set(recipe.itemName, list);
}

/** Recetas del ítem, o lista vacía si no es evolutivo del catálogo. */
export function evolutionRecipesForItem(itemName: string): ItemEvolutionRecipe[] {
  return recipesByItem.get(itemName) ?? [];
}

