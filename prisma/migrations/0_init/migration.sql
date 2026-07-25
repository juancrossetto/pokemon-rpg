-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MARKET_SOLD', 'MARKET_EXPIRED', 'GYM_WON', 'GYM_LOST', 'PVP_WON', 'PVP_LOST');

-- CreateEnum
CREATE TYPE "MoveCategory" AS ENUM ('PHYSICAL', 'SPECIAL', 'STATUS');

-- CreateEnum
CREATE TYPE "LearnMethod" AS ENUM ('LEVEL_UP', 'MACHINE');

-- CreateEnum
CREATE TYPE "GymRunStatus" AS ENUM ('ACTIVE', 'WON', 'ABANDONED');

-- CreateEnum
CREATE TYPE "StatusCondition" AS ENUM ('BURN', 'PARALYSIS', 'POISON', 'SLEEP');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('BERRY', 'EVOLUTION_STONE', 'POKEBALL', 'POTION', 'MACHINE');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('POKEMON', 'ITEM');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "BattleKind" AS ENUM ('PVE_WILD', 'PVE_GYM', 'PVP');

-- CreateEnum
CREATE TYPE "BattleSessionStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'FLED', 'CAUGHT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "gender" TEXT,
    "age" INTEGER,
    "avatarId" TEXT,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "energy" INTEGER NOT NULL DEFAULT 20,
    "energyMax" INTEGER NOT NULL DEFAULT 20,
    "energyUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHealAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pvpRating" INTEGER NOT NULL DEFAULT 1000,
    "pvpWins" INTEGER NOT NULL DEFAULT 0,
    "pvpLosses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignProgress" (
    "userId" TEXT NOT NULL,
    "currentRegionId" TEXT NOT NULL DEFAULT 'kanto',
    "highestUnlockedLocationId" TEXT NOT NULL,
    "selectedLocationId" TEXT NOT NULL,
    "farmingLocationId" TEXT NOT NULL,
    "farmingStageId" TEXT NOT NULL,
    "highestCompletedStageId" TEXT,
    "completedStageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastMilestoneId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignProgress_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "types" TEXT[],
    "baseHp" INTEGER NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "baseDefense" INTEGER NOT NULL,
    "baseSpAtk" INTEGER NOT NULL,
    "baseSpDef" INTEGER NOT NULL,
    "baseSpeed" INTEGER NOT NULL,
    "spriteUrl" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "captureRate" INTEGER NOT NULL DEFAULT 45,
    "evolvesFromId" INTEGER,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" "MoveCategory" NOT NULL,
    "power" INTEGER,
    "accuracy" INTEGER,
    "pp" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectText" TEXT,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesMove" (
    "speciesId" INTEGER NOT NULL,
    "moveId" INTEGER NOT NULL,
    "method" "LearnMethod" NOT NULL DEFAULT 'LEVEL_UP',
    "learnLevel" INTEGER,

    CONSTRAINT "SpeciesMove_pkey" PRIMARY KEY ("speciesId","moveId","method")
);

-- CreateTable
CREATE TABLE "PokemonInstance" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL DEFAULT 5,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "currentHp" INTEGER NOT NULL,
    "isShiny" BOOLEAN NOT NULL DEFAULT false,
    "teamSlot" INTEGER,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isTradeLocked" BOOLEAN NOT NULL DEFAULT false,
    "caughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unspentPoints" INTEGER NOT NULL DEFAULT 0,
    "ptStrength" INTEGER NOT NULL DEFAULT 0,
    "ptSpeed" INTEGER NOT NULL DEFAULT 0,
    "ptDexterity" INTEGER NOT NULL DEFAULT 0,
    "ptIntelligence" INTEGER NOT NULL DEFAULT 0,
    "ptConstitution" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PokemonInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Egg" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "parentAId" TEXT NOT NULL,
    "parentBId" TEXT NOT NULL,
    "ptStrength" INTEGER NOT NULL DEFAULT 0,
    "ptSpeed" INTEGER NOT NULL DEFAULT 0,
    "ptDexterity" INTEGER NOT NULL DEFAULT 0,
    "ptIntelligence" INTEGER NOT NULL DEFAULT 0,
    "ptConstitution" INTEGER NOT NULL DEFAULT 0,
    "isShiny" BOOLEAN NOT NULL DEFAULT false,
    "readyAt" TIMESTAMP(3) NOT NULL,
    "hatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Egg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonMove" (
    "pokemonInstanceId" TEXT NOT NULL,
    "moveId" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "currentPp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PokemonMove_pkey" PRIMARY KEY ("pokemonInstanceId","slot")
);

-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "leaderName" TEXT NOT NULL,
    "badgeName" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "opensHour" INTEGER NOT NULL DEFAULT 0,
    "closesHour" INTEGER NOT NULL DEFAULT 24,
    "coinReward" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymPokemon" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "GymPokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymTrainer" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GymTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymTrainerPokemon" (
    "id" TEXT NOT NULL,
    "gymTrainerId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "GymTrainerPokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "status" "GymRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "clearedTrainerSlots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "won" BOOLEAN NOT NULL,

    CONSTRAINT "GymAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "effectText" TEXT,
    "buyPrice" INTEGER NOT NULL,
    "catchMultiplier" DOUBLE PRECISION,
    "healAmount" INTEGER,
    "moveId" INTEGER,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "pokemonInstanceId" TEXT,
    "itemId" TEXT,
    "quantity" INTEGER,
    "price" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),
    "sellerSeenAt" TIMESTAMP(3),
    "buyerClaimedAt" TIMESTAMP(3),

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanMember" (
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanMember_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClanMessage" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleLog" (
    "id" TEXT NOT NULL,
    "kind" "BattleKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "opponentId" TEXT,
    "gymId" TEXT,
    "userWon" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pokemonInstanceId" TEXT NOT NULL,
    "wildSpeciesId" INTEGER NOT NULL,
    "wildLevel" INTEGER NOT NULL,
    "wildCurrentHp" INTEGER NOT NULL,
    "wildMaxHp" INTEGER NOT NULL,
    "wildMoveIds" INTEGER[],
    "wildMovePp" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "wildIsShiny" BOOLEAN NOT NULL DEFAULT false,
    "status" "BattleSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "log" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pendingXp" INTEGER NOT NULL DEFAULT 0,
    "gymId" TEXT,
    "gymRunId" TEXT,
    "gymTrainerId" TEXT,
    "gymPokemonSlot" INTEGER,
    "playerStatus" "StatusCondition",
    "wildStatus" "StatusCondition",
    "playerSleepTurns" INTEGER NOT NULL DEFAULT 0,
    "wildSleepTurns" INTEGER NOT NULL DEFAULT 0,
    "playerAtkStage" INTEGER NOT NULL DEFAULT 0,
    "playerDefStage" INTEGER NOT NULL DEFAULT 0,
    "playerSpeStage" INTEGER NOT NULL DEFAULT 0,
    "wildAtkStage" INTEGER NOT NULL DEFAULT 0,
    "wildDefStage" INTEGER NOT NULL DEFAULT 0,
    "wildSpeStage" INTEGER NOT NULL DEFAULT 0,
    "fleeAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PvpMatch" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "challengerRatingBefore" INTEGER NOT NULL,
    "challengerRatingAfter" INTEGER NOT NULL,
    "opponentRatingBefore" INTEGER NOT NULL,
    "opponentRatingAfter" INTEGER NOT NULL,
    "koLog" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "turns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PvpMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Species_name_key" ON "Species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Move_name_key" ON "Move"("name");

-- CreateIndex
CREATE INDEX "PokemonInstance_ownerId_idx" ON "PokemonInstance"("ownerId");

-- CreateIndex
CREATE INDEX "PokemonInstance_speciesId_idx" ON "PokemonInstance"("speciesId");

-- CreateIndex
CREATE INDEX "PokemonInstance_ownerId_isFavorite_idx" ON "PokemonInstance"("ownerId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonInstance_ownerId_teamSlot_key" ON "PokemonInstance"("ownerId", "teamSlot");

-- CreateIndex
CREATE INDEX "Egg_ownerId_hatchedAt_idx" ON "Egg"("ownerId", "hatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Gym_order_key" ON "Gym"("order");

-- CreateIndex
CREATE UNIQUE INDEX "GymPokemon_gymId_slot_key" ON "GymPokemon"("gymId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "GymTrainer_gymId_slot_key" ON "GymTrainer"("gymId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "GymTrainerPokemon_gymTrainerId_slot_key" ON "GymTrainerPokemon"("gymTrainerId", "slot");

-- CreateIndex
CREATE INDEX "GymRun_userId_gymId_status_idx" ON "GymRun"("userId", "gymId", "status");

-- CreateIndex
CREATE INDEX "GymAttempt_userId_gymId_idx" ON "GymAttempt"("userId", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_userId_gymId_key" ON "Badge"("userId", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- CreateIndex
CREATE INDEX "MarketListing_status_kind_idx" ON "MarketListing"("status", "kind");

-- CreateIndex
CREATE INDEX "MarketListing_pokemonInstanceId_idx" ON "MarketListing"("pokemonInstanceId");

-- CreateIndex
CREATE INDEX "MarketListing_sellerId_status_idx" ON "MarketListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "MarketListing_buyerId_status_idx" ON "MarketListing"("buyerId", "status");

-- CreateIndex
CREATE INDEX "MarketListing_buyerId_status_buyerClaimedAt_idx" ON "MarketListing"("buyerId", "status", "buyerClaimedAt");

-- CreateIndex
CREATE INDEX "MarketListing_status_expiresAt_idx" ON "MarketListing"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_name_key" ON "Clan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_tag_key" ON "Clan"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_leaderId_key" ON "Clan"("leaderId");

-- CreateIndex
CREATE INDEX "ClanMember_clanId_idx" ON "ClanMember"("clanId");

-- CreateIndex
CREATE INDEX "ClanMessage_clanId_createdAt_idx" ON "ClanMessage"("clanId", "createdAt");

-- CreateIndex
CREATE INDEX "BattleLog_userId_idx" ON "BattleLog"("userId");

-- CreateIndex
CREATE INDEX "BattleSession_userId_status_idx" ON "BattleSession"("userId", "status");

-- CreateIndex
CREATE INDEX "PvpMatch_challengerId_createdAt_idx" ON "PvpMatch"("challengerId", "createdAt");

-- CreateIndex
CREATE INDEX "PvpMatch_opponentId_createdAt_idx" ON "PvpMatch"("opponentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignProgress" ADD CONSTRAINT "CampaignProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_evolvesFromId_fkey" FOREIGN KEY ("evolvesFromId") REFERENCES "Species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesMove" ADD CONSTRAINT "SpeciesMove_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesMove" ADD CONSTRAINT "SpeciesMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonInstance" ADD CONSTRAINT "PokemonInstance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonInstance" ADD CONSTRAINT "PokemonInstance_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egg" ADD CONSTRAINT "Egg_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egg" ADD CONSTRAINT "Egg_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonMove" ADD CONSTRAINT "PokemonMove_pokemonInstanceId_fkey" FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonMove" ADD CONSTRAINT "PokemonMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPokemon" ADD CONSTRAINT "GymPokemon_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPokemon" ADD CONSTRAINT "GymPokemon_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymTrainer" ADD CONSTRAINT "GymTrainer_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymTrainerPokemon" ADD CONSTRAINT "GymTrainerPokemon_gymTrainerId_fkey" FOREIGN KEY ("gymTrainerId") REFERENCES "GymTrainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymTrainerPokemon" ADD CONSTRAINT "GymTrainerPokemon_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymRun" ADD CONSTRAINT "GymRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymRun" ADD CONSTRAINT "GymRun_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymAttempt" ADD CONSTRAINT "GymAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymAttempt" ADD CONSTRAINT "GymAttempt_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_pokemonInstanceId_fkey" FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clan" ADD CONSTRAINT "Clan_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMember" ADD CONSTRAINT "ClanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMember" ADD CONSTRAINT "ClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMessage" ADD CONSTRAINT "ClanMessage_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMessage" ADD CONSTRAINT "ClanMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_pokemonInstanceId_fkey" FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_wildSpeciesId_fkey" FOREIGN KEY ("wildSpeciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_gymRunId_fkey" FOREIGN KEY ("gymRunId") REFERENCES "GymRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_gymTrainerId_fkey" FOREIGN KEY ("gymTrainerId") REFERENCES "GymTrainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PvpMatch" ADD CONSTRAINT "PvpMatch_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PvpMatch" ADD CONSTRAINT "PvpMatch_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
