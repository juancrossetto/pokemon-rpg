-- Aviso al ganar una MT/MO de líder de gimnasio (primera medalla).
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'GYM_TM_REWARD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
