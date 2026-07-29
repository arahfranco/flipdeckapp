-- Records when an expense entry was added to Flipdeck, separate from the date
-- on the receipt (the existing "date" column).
--
-- Additive. Existing rows get the current timestamp as their default — there's
-- no truer value available for entries made before this column existed, so
-- they'll all read as added at migration time. Only genuinely tells them apart
-- from here on.
ALTER TABLE "Expense" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
