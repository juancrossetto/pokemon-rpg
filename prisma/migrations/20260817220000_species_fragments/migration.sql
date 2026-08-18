-- Fragmentos de especie para recompensas del Parque (10 = 1 Pokémon).

CREATE TABLE "SpeciesFragment" (
    "userId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeciesFragment_pkey" PRIMARY KEY ("userId","speciesId")
);

CREATE INDEX "SpeciesFragment_userId_idx" ON "SpeciesFragment"("userId");

ALTER TABLE "SpeciesFragment" ADD CONSTRAINT "SpeciesFragment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesFragment" ADD CONSTRAINT "SpeciesFragment_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;
