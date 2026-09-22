// Auto-creates (or updates, on re-finalize) the future-year TRIPS/IHS
// tickets for a multi-year quote. One quote, one price — these siblings are
// pure scheduling placeholders for years 2/3, not separate quotes: same
// customer, same assets, same PO, same per-year invoice amount, just a
// different Year of Service and an advanced placeholder arrival date.
import { Activity, ActivityFieldUpdateValue, HailerApi } from '@hailer/app-sdk';
import { readLinkId } from './hailer/api-helpers';
import { TRIPS_IHS } from './constants/schema';
import { AssetLine } from './types';

const LEADING_YEAR_RE = /^(\d{4})\b/;

function deriveSiblingName(originalName: string, targetYear: number): string {
  const m = originalName.match(LEADING_YEAR_RE);
  if (m) return originalName.replace(LEADING_YEAR_RE, String(targetYear));
  return `${originalName} (${targetYear})`;
}

function addYearsToMs(ms: number, yearsToAdd: number): number {
  const d = new Date(ms);
  d.setUTCFullYear(d.getUTCFullYear() + yearsToAdd);
  return d.getTime();
}

export async function createOrUpdateFutureYearTickets(
  hailer: HailerApi,
  originalTicket: Activity,
  assetLines: AssetLine[],
  perYearAmount: number,
  years: number,
  existingSiblingIds: string[],
): Promise<string[]> {
  if (years <= 1) return [];

  const customerId = readLinkId(originalTicket.fields?.[TRIPS_IHS.fields.customer]);
  const contactId = readLinkId(originalTicket.fields?.[TRIPS_IHS.fields.clientContactPerson]);
  const serviceType = (originalTicket.fields?.[TRIPS_IHS.fields.serviceType] as string) || '';
  const serviceTripType = (originalTicket.fields?.[TRIPS_IHS.fields.serviceTripType] as string) || '';
  const poNumber = (originalTicket.fields?.[TRIPS_IHS.fields.poNumber] as string) || '';
  const arrivalDateMs = originalTicket.fields?.[TRIPS_IHS.fields.estimatedArrivalDate] as number | undefined;
  const yearOfServiceRaw = (originalTicket.fields?.[TRIPS_IHS.fields.yearOfService] as string) || '';
  const baseYear = parseInt(yearOfServiceRaw, 10) || new Date().getUTCFullYear();

  const assetText = assetLines.map((l) => l.asset.displayName).join(', ') || 'See original quote for asset details';
  const assetFieldIds = [TRIPS_IHS.fields.asset1, TRIPS_IHS.fields.asset2, TRIPS_IHS.fields.asset3];

  const resultIds: string[] = [...existingSiblingIds];

  for (let i = 1; i < years; i++) {
    const targetYear = baseYear + i;
    const fields: Record<string, ActivityFieldUpdateValue> = {
      [TRIPS_IHS.fields.serviceType]: serviceType || null,
      [TRIPS_IHS.fields.assetText]: assetText,
      [TRIPS_IHS.fields.amountToInvoice]: perYearAmount,
      [TRIPS_IHS.fields.poAmount]: perYearAmount,
      [TRIPS_IHS.fields.yearOfService]: String(targetYear),
      [TRIPS_IHS.fields.clientIdentifiedIssues]: `Year ${i + 1} of ${years} — same quote/pricing as the original ticket. See that ticket for full quote details.`,
    };
    if (customerId) fields[TRIPS_IHS.fields.customer] = customerId;
    if (contactId) fields[TRIPS_IHS.fields.clientContactPerson] = contactId;
    if (serviceTripType) fields[TRIPS_IHS.fields.serviceTripType] = serviceTripType;
    if (poNumber) fields[TRIPS_IHS.fields.poNumber] = poNumber;
    if (arrivalDateMs) fields[TRIPS_IHS.fields.estimatedArrivalDate] = addYearsToMs(arrivalDateMs, i);
    assetFieldIds.forEach((fid, idx) => {
      fields[fid] = assetLines[idx] ? assetLines[idx].asset._id : null;
    });

    const existingId = existingSiblingIds[i - 1];
    if (existingId) {
      await hailer.activity.update([{ _id: existingId, fields }], {});
    } else {
      // create()'s field type doesn't accept null (unlike update()) — omit
      // any field with no real value instead of passing null for it.
      const createFields = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== null),
      ) as Record<string, Exclude<ActivityFieldUpdateValue, null>>;
      const name = deriveSiblingName(originalTicket.name, targetYear);
      const created = await hailer.activity.create(
        TRIPS_IHS.workflowId,
        [{ name, phaseId: TRIPS_IHS.phases.waitingOnDates, fields: createFields }],
        {},
      );
      const newId = created?.[0]?._id;
      if (newId) resultIds[i - 1] = newId;
    }
  }

  return resultIds.slice(0, years - 1);
}
