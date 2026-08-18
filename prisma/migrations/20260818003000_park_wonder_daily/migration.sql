-- Trueque: cupo diario de intercambios (los primeros son gratis; el resto gasta energía).

CREATE TABLE "ParkWonder" (
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "trades" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkWonder_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ParkWonder" ADD CONSTRAINT "ParkWonder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
