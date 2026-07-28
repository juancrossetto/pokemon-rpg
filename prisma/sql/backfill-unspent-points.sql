-- Backfill unspentPoints for existing Pokémon that never got the (level-1)×3 pool.
-- Does NOT touch already-invested pt*; only top-ups missing unspent so:
--   invested + unspent >= (level - 1) * 3
-- Safe to re-run.

UPDATE "PokemonInstance" AS p
SET "unspentPoints" = p."unspentPoints" + GREATEST(
  0,
  (GREATEST(1, LEAST(100, p.level)) - 1) * 3
    - (
      p."ptStrength"
      + p."ptSpeed"
      + p."ptDexterity"
      + p."ptIntelligence"
      + p."ptConstitution"
      + p."unspentPoints"
    )
)
WHERE (
  p."ptStrength"
  + p."ptSpeed"
  + p."ptDexterity"
  + p."ptIntelligence"
  + p."ptConstitution"
  + p."unspentPoints"
) < (GREATEST(1, LEAST(100, p.level)) - 1) * 3;
