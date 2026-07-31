-- Stages de las 6 stats + precisión/evasión.
-- Antes sólo se guardaban Atq/Def/Vel, así que Calm Mind, Nasty Plot, Amnesia
-- o Sand Attack gastaban el turno sin efecto persistido.
ALTER TABLE "BattleSession"
  ADD COLUMN "playerSpaStage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "playerSpdStage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "playerAccStage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "playerEvaStage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wildSpaStage"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wildSpdStage"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wildAccStage"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wildEvaStage"   INTEGER NOT NULL DEFAULT 0;
