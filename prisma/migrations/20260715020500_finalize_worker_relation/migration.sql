-- Data already backfilled via one-off script before this migration: every
-- PayrollEntry.workerId is populated, so dropping the old free-text column
-- and requiring workerId is safe.
ALTER TABLE "PayrollEntry" DROP COLUMN "worker";
ALTER TABLE "PayrollEntry" ALTER COLUMN "workerId" SET NOT NULL;
