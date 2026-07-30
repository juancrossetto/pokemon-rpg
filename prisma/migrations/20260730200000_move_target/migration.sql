-- AlterTable
ALTER TABLE "Move" ADD COLUMN IF NOT EXISTS "target" TEXT NOT NULL DEFAULT 'selected-pokemon';
