-- Add multi-select tags for directory status categories.
ALTER TABLE "MmidEntry"
ADD COLUMN "statusTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing single status value into statusTags for compatibility.
UPDATE "MmidEntry"
SET "statusTags" = ARRAY["status"]
WHERE "status" IS NOT NULL
  AND btrim("status") <> ''
  AND cardinality("statusTags") = 0;

-- Allow maintainers to hide sensitive report attachments from public directory rendering.
ALTER TABLE "ReportAttachment"
ADD COLUMN "hideFromDirectory" BOOLEAN NOT NULL DEFAULT false;
