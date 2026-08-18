-- Game Corner: cupo diario de giros (los primeros son gratis; el resto gasta energía).

CREATE TABLE "ParkCorner" (
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "spins" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParkCorner_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ParkCorner" ADD CONSTRAINT "ParkCorner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
