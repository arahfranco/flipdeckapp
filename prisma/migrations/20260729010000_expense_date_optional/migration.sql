-- Allows an expense to have no date. Bulk import can bring in rows with a blank
-- receipt date; they import anyway and the date is filled later from the
-- Expenses Log. Amounts roll up independently of date, so a missing date does
-- not affect any property or company total. Additive — existing rows keep theirs.
ALTER TABLE "Expense" ALTER COLUMN "date" DROP NOT NULL;
