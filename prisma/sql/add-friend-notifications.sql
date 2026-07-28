-- Notificaciones de amistad (solicitud / aceptación)
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REQUEST';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
