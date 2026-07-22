import { Prisma, Status } from "@prisma/client";
import { money } from "@/lib/format";

interface Props {
  status: Status;
  monthlyRent: Prisma.Decimal | null;
}

/**
 * Monthly rent for a property row.
 *
 * Only a RENTED property is actually collecting rent, and that is the same
 * rule the Company Value rental income figure uses. A rent stored against a
 * property that is still in rehab is a projection of what it could earn, so it
 * is shown but marked, rather than either hidden (losing the estimate someone
 * entered) or shown plainly (implying money is coming in).
 */
export function RentCell({ status, monthlyRent }: Props) {
  if (!monthlyRent || monthlyRent.isZero()) return <span className="hint">—</span>;

  if (status === Status.RENTED) return <>{money(monthlyRent)}</>;

  return (
    <span className="hint" title="Not rented yet — this is an estimate, and is not counted as rental income">
      {money(monthlyRent)} est.
    </span>
  );
}
