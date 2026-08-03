-- AlterEnum: aviso de recompensa diaria pendiente
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_REWARD_READY';
