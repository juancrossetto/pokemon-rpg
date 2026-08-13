-- En este RPG, Golbat evoluciona a Crobat usando el Cordón Unión.
UPDATE "Species"
SET
  "evolveTrigger" = 'use-item',
  "evolveItem" = 'Linking Cord',
  "evolveMinLevel" = NULL
WHERE id = 169
  AND "evolvesFromId" = 42;

UPDATE "Item"
SET "effectText" = 'Evoluciona especies que normalmente requieren intercambio y a Golbat.'
WHERE name = 'Linking Cord';
