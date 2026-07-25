-- Potas de PP (Ether / Elixir) + stock de Leppa.
-- Sprite PokeAPI: ether.png, max-ether.png, elixir.png, max-elixir.png, leppa-berry.png
-- Uso: click derecho en un Pokémon del equipo/PC → "Restaurar PP".

INSERT INTO "Item" (id, name, type, "effectText", "buyPrice", "catchMultiplier", "healAmount", "moveId")
VALUES
  (gen_random_uuid()::text, 'Ether', 'POTION', 'Restaura 10 PP de un movimiento.', 1200, NULL, NULL, NULL),
  (gen_random_uuid()::text, 'Max Ether', 'POTION', 'Restaura todos los PP de un movimiento.', 2000, NULL, NULL, NULL),
  (gen_random_uuid()::text, 'Elixir', 'POTION', 'Restaura 10 PP de todos los movimientos.', 3000, NULL, NULL, NULL),
  (gen_random_uuid()::text, 'Max Elixir', 'POTION', 'Restaura todos los PP de todos los movimientos.', 4500, NULL, NULL, NULL),
  (gen_random_uuid()::text, 'Leppa Berry', 'BERRY', 'Restaura 10 PP de un movimiento.', 250, NULL, NULL, NULL)
ON CONFLICT (name) DO UPDATE
SET
  type = EXCLUDED.type,
  "effectText" = EXCLUDED."effectText",
  "buyPrice" = EXCLUDED."buyPrice",
  "healAmount" = EXCLUDED."healAmount";

-- Dar stock a Bubalu (username case-insensitive).
INSERT INTO "InventoryItem" ("userId", "itemId", quantity)
SELECT u.id, i.id, v.qty
FROM "User" u
CROSS JOIN (
  VALUES
    ('Ether', 15),
    ('Max Ether', 5),
    ('Elixir', 5),
    ('Max Elixir', 2),
    ('Leppa Berry', 10)
) AS v(item_name, qty)
JOIN "Item" i ON i.name = v.item_name
WHERE lower(u.username) = lower('Bubalu')
ON CONFLICT ("userId", "itemId") DO UPDATE
SET quantity = "InventoryItem".quantity + EXCLUDED.quantity;
