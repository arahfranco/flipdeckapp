-- Makes property optional on expenses and payroll: a blank property is a
-- general / overhead item, counted company-wide rather than against one flip.
--
-- Delete rule changes from Cascade to SetNull for both. Under Cascade, deleting
-- a property silently deleted its expenses and payroll; now those survive and
-- simply become general. Additive — existing rows keep their property.
ALTER TABLE "Expense" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_propertyId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollEntry" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "PayrollEntry" DROP CONSTRAINT "PayrollEntry_propertyId_fkey";
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
