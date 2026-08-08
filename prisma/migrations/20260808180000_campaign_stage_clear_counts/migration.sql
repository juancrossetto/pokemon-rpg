-- Partial wild clear progress toward multi-win campaign stages.
ALTER TABLE "CampaignProgress" ADD COLUMN "stageClearCounts" JSONB NOT NULL DEFAULT '{}';
