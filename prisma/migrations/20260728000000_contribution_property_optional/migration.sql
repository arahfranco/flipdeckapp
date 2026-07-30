-- Makes a contribution's property optional: a partner's capital can be
-- company-level (blank) rather than tied to one property.
--
-- Also changes the delete rule from Cascade to SetNull. Under Cascade,
-- deleting a property silently deleted that property's partner contributions —
-- wrong once a contribution can stand alone. SetNull detaches instead, so a
-- partner's capital entry survives and simply becomes company-level.
--
-- Additive: existing rows keep their propertyId; nothing is nulled here.
ALTER TABLE "Contribution" ALTER COLUMN "propertyId" DROP NOT NULL;

ALTER TABLE "Contribution" DROP CONSTRAINT "Contribution_propertyId_fkey";
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
