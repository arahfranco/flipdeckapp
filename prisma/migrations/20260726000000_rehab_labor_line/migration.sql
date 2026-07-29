-- Adds a "Labor" line to Rehab Costs so labor paid directly (a contractor's
-- lump sum, not through the payroll module) can be budgeted and expensed.
--
-- Distinct from the derived "Labor (Payroll)" row calc.ts appends from
-- PayrollEntry sums — that one is computed, not stored, and needs no budget line.
--
-- Additive and idempotent. New properties get the line from SUBS_BY_CAT; this
-- backfills existing ones. The NOT EXISTS guard matches
-- @@unique([propertyId, subcategory]), so re-running is a no-op.
INSERT INTO "BudgetLine" ("id", "propertyId", "category", "subcategory", "estimated", "actual", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'Rehab Costs', 'Labor', 0, 0, NOW()
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "BudgetLine" b
  WHERE b."propertyId" = p."id" AND b."subcategory" = 'Labor'
);
