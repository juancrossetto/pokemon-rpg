-- AlterEnum: aviso de energía al tope
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ENERGY_FULL';
