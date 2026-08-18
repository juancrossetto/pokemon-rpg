-- Pesca: cupo diario de lances (los primeros son gratis; el resto gasta energía).

CREATE TABLE "ParkFishing" (
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "casts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParkFishing_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ParkFishing" ADD CONSTRAINT "ParkFishing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
