-- Replaces the 33-line rehab checklist with a 17-line one.
--
-- Expenses and bank transactions store their subcategory as text, and
-- computeProperty() builds the rollup from the budget lines that exist: an
-- expense whose subcategory has no matching line is dropped from the category
-- total with no error and no visible gap. So renames come first, and no line is
-- deleted while anything still refers to it.
--
-- Verified against production before writing: no bank transaction carries a
-- subcategory, and every rehab budget estimate is still zero, so the checklist
-- can be swapped without losing entered figures.

-- Step 1: move existing entries onto the new names. Only the four that had
-- data are mapped; "Exterior Doors" goes to the exterior envelope alongside
-- siding, per the owner's decision.
UPDATE "Expense" SET "subcategory" = 'Demolition and Site Prep'   WHERE "subcategory" = 'Demolition';
UPDATE "Expense" SET "subcategory" = 'Exterior Walls and Siding'  WHERE "subcategory" IN ('Siding', 'Exterior Doors');
UPDATE "Expense" SET "subcategory" = 'Interior Doors and Millwork' WHERE "subcategory" = 'Interior Doors';

UPDATE "BankTxn" SET "subcategory" = 'Demolition and Site Prep'   WHERE "subcategory" = 'Demolition';
UPDATE "BankTxn" SET "subcategory" = 'Exterior Walls and Siding'  WHERE "subcategory" IN ('Siding', 'Exterior Doors');
UPDATE "BankTxn" SET "subcategory" = 'Interior Doors and Millwork' WHERE "subcategory" = 'Interior Doors';

-- Step 2: retire the old lines — but only where nothing depends on them.
-- A line carrying a figure, or still referenced by an expense or a posted bank
-- transaction, is left in place. It will show up as an extra row rather than
-- taking its money with it: a visible leftover beats a silent loss.
DELETE FROM "BudgetLine" b
WHERE b."category" = 'Rehab Costs'
  AND b."subcategory" NOT IN (
    'Building Materials', 'Demolition and Site Prep', 'Framing', 'Roofing',
    'Exterior Walls and Siding', 'HVAC', 'Plumbing', 'Electrical', 'Insulation',
    'Interior Walls and Drywall', 'Flooring', 'Kitchen Remodel', 'Bathroom Remodels',
    'Interior Doors and Millwork', 'Fixtures and Appliances', 'Landscaping',
    'Miscellaneous and Permits'
  )
  AND b."estimated" = 0
  AND b."actual" = 0
  AND NOT EXISTS (
    SELECT 1 FROM "Expense" e WHERE e."propertyId" = b."propertyId" AND e."subcategory" = b."subcategory"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "BankTxn" t WHERE t."propertyId" = b."propertyId" AND t."subcategory" = b."subcategory"
  );

-- Step 3: give every property the full new checklist. Idempotent via the
-- NOT EXISTS guard, which matches @@unique([propertyId, subcategory]).
INSERT INTO "BudgetLine" ("id", "propertyId", "category", "subcategory", "estimated", "actual", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'Rehab Costs', s."subcategory", 0, 0, NOW()
FROM "Property" p
CROSS JOIN (VALUES
  ('Building Materials'), ('Demolition and Site Prep'), ('Framing'), ('Roofing'),
  ('Exterior Walls and Siding'), ('HVAC'), ('Plumbing'), ('Electrical'), ('Insulation'),
  ('Interior Walls and Drywall'), ('Flooring'), ('Kitchen Remodel'), ('Bathroom Remodels'),
  ('Interior Doors and Millwork'), ('Fixtures and Appliances'), ('Landscaping'),
  ('Miscellaneous and Permits')
) AS s("subcategory")
WHERE NOT EXISTS (
  SELECT 1 FROM "BudgetLine" b
  WHERE b."propertyId" = p."id" AND b."subcategory" = s."subcategory"
);
