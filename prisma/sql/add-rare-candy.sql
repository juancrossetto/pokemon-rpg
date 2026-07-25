-- Carameloraro (Rare Candy): sube 1 nivel a un Pokémon.
-- Tipo BERRY porque ItemType no tiene consumible de XP; el uso en UI se suma aparte.
-- Sprite PokeAPI: rare-candy.png (slug desde el nombre "Rare Candy").

INSERT INTO "Item" (id, name, type, "effectText", "buyPrice", "catchMultiplier", "healAmount", "moveId")
VALUES (
  gen_random_uuid()::text,
  'Rare Candy',
  'BERRY',
  'Sube 1 nivel al Pokémon.',
  4800,
  NULL,
  NULL,
  NULL
)
ON CONFLICT (name) DO UPDATE
SET
  type = EXCLUDED.type,
  "effectText" = EXCLUDED."effectText",
  "buyPrice" = EXCLUDED."buyPrice";

-- Dar 10 a un entrenador (username case-insensitive).
INSERT INTO "InventoryItem" ("userId", "itemId", quantity)
SELECT u.id, i.id, 10
FROM "User" u
CROSS JOIN "Item" i
WHERE lower(u.username) = lower('Bubalu')
  AND i.name = 'Rare Candy'
ON CONFLICT ("userId", "itemId") DO UPDATE
SET quantity = "InventoryItem".quantity + EXCLUDED.quantity;
