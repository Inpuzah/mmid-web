DROP TABLE IF EXISTS "MmidEntryVote";
DROP TABLE IF EXISTS "MmidEntryProposal";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "showVoteHistoryOnProfile";

DROP TYPE IF EXISTS "ProposalAction";
DROP TYPE IF EXISTS "ProposalStatus";
