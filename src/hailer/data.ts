import { Activity, HailerApi, Workflow } from '@hailer/app-sdk';
import { listAll, readLinkId, readLinkName } from './api-helpers';
import { createFieldResolver } from './field-resolver';
import {
  ASSETS,
  CALIBRATION_RATES,
  CUSTOMERS,
  ISO_17025_CERT,
  NO_TRAVEL,
  TRIPS_IHS,
} from '../constants/schema';
import { AssetSummary, CountryRate, SystemRate, TicketSummary } from '../types';

const OPEN_SERVICE_TYPES = new Set(['Calibration', 'In House Service / Repair']);

export async function fetchOpenTickets(hailer: HailerApi): Promise<TicketSummary[]> {
  const results = await Promise.all(
    TRIPS_IHS.openPhases.map((phaseId) =>
      hailer.activity.list(TRIPS_IHS.workflowId, phaseId, { limit: 200 }).catch(() => [] as Activity[]),
    ),
  );
  const all = results.flat();
  return all
    .filter((a) => {
      const excluded = a.fields?.[TRIPS_IHS.fields.excludeFromQuoteBuilder] === 'Yes';
      if (excluded) return false;
      const st = a.fields?.[TRIPS_IHS.fields.serviceType] as string | undefined;
      return !st || OPEN_SERVICE_TYPES.has(st);
    })
    .map((a) => ({
      _id: a._id,
      name: a.name,
      ticketCode: (a.fields?.[TRIPS_IHS.fields.ticketCode] as string) || '',
      serviceType: (a.fields?.[TRIPS_IHS.fields.serviceType] as string) || '',
      customerId: readLinkId(a.fields?.[TRIPS_IHS.fields.customer]) ?? null,
      customerName: readLinkName(a.fields?.[TRIPS_IHS.fields.customer]) || '',
      companyFallback: (a.fields?.[TRIPS_IHS.fields.company] as string) || '',
      currentPhaseId: a.currentPhase || '',
      existingAssetIds: [TRIPS_IHS.fields.asset1, TRIPS_IHS.fields.asset2, TRIPS_IHS.fields.asset3]
        .map((fid) => readLinkId(a.fields?.[fid]))
        .filter((id): id is string => !!id),
    }))
    .sort((a, b) => b._id.localeCompare(a._id));
}

export async function fetchAssetsForCompany(hailer: HailerApi, companyId: string): Promise<AssetSummary[]> {
  const all = await listAll(hailer, ASSETS.workflowId, ASSETS.phaseId);
  return all
    .filter((a) => readLinkId(a.fields?.[ASSETS.fields.company]) === companyId)
    .map((a) => {
      const productFamily = (a.fields?.[ASSETS.fields.productFamily] as string) || '';
      const name = (a.fields?.[ASSETS.fields.assetName] as string) || a.name;
      return {
        _id: a._id,
        name,
        displayName: `${name} — ${productFamily || a.name}`,
        productFamily,
        companyId: readLinkId(a.fields?.[ASSETS.fields.company]) ?? null,
        calibrationDue: (a.fields?.[ASSETS.fields.calibrationDue] as number | undefined) ?? null,
        lastCalibration: (a.fields?.[ASSETS.fields.lastCalibration] as number | undefined) ?? null,
        iso17025: a.fields?.[ASSETS.fields.iso17025] === 'Yes',
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function fetchAssetsByIds(hailer: HailerApi, ids: string[]): Promise<AssetSummary[]> {
  const results = await Promise.all(ids.map((id) => hailer.activity.get(id).catch(() => null)));
  return results.filter((a): a is Activity => !!a).map((a) => {
    const productFamily = (a.fields?.[ASSETS.fields.productFamily] as string) || '';
    const name = (a.fields?.[ASSETS.fields.assetName] as string) || a.name;
    return {
      _id: a._id,
      name,
      displayName: `${name} — ${productFamily || a.name}`,
      productFamily,
      companyId: readLinkId(a.fields?.[ASSETS.fields.company]) ?? null,
      calibrationDue: (a.fields?.[ASSETS.fields.calibrationDue] as number | undefined) ?? null,
      lastCalibration: (a.fields?.[ASSETS.fields.lastCalibration] as number | undefined) ?? null,
      iso17025: a.fields?.[ASSETS.fields.iso17025] === 'Yes',
    };
  });
}

const IN_HOUSE_SUFFIX = /\s*\(in house only\)\s*/i;

export interface CalibrationRatesData {
  countries: CountryRate[];
  systemsByName: Map<string, SystemRate>;
  constants: Record<string, number>;
}

export async function fetchCalibrationRates(
  hailer: HailerApi,
  workflows: Workflow[],
): Promise<CalibrationRatesData> {
  const calWorkflow = workflows.find((w) => w._id === CALIBRATION_RATES.workflowId);
  const f = createFieldResolver(calWorkflow?.fields);
  const activities = await listAll(hailer, CALIBRATION_RATES.workflowId, CALIBRATION_RATES.phaseId);

  const num = (a: Activity, key: string) => Number(a.fields?.[f(key)] ?? 0) || 0;
  const str = (a: Activity, key: string) => (a.fields?.[f(key)] as string) || '';

  const byType = (t: string) => activities.filter((a) => str(a, CALIBRATION_RATES.fields.rowType) === t);

  const countries: CountryRate[] = byType('country').map((a) => ({
    name: a.name,
    daysTraveling: num(a, CALIBRATION_RATES.fields.daysTraveling),
    airfare: num(a, CALIBRATION_RATES.fields.airfare),
    carPerDay: num(a, CALIBRATION_RATES.fields.carPerDay),
    hotelPerDay: num(a, CALIBRATION_RATES.fields.hotelPerDay),
    foodPerDay: num(a, CALIBRATION_RATES.fields.foodPerDay),
  }));

  const systemsByName = new Map<string, SystemRate>();
  byType('system').forEach((a) => {
    const displayName = a.name.replace(IN_HOUSE_SUFFIX, '').trim();
    systemsByName.set(a.name, {
      name: a.name,
      displayName,
      inHouseOnly: IN_HOUSE_SUFFIX.test(a.name),
      partsCost: num(a, CALIBRATION_RATES.fields.partsCost),
      daysOnSite: num(a, CALIBRATION_RATES.fields.daysOnSite),
    });
  });

  const constants: Record<string, number> = {};
  byType('constant').forEach((a) => {
    constants[a.name] = num(a, CALIBRATION_RATES.fields.value);
  });

  return { countries, systemsByName, constants };
}

export interface CustomerDetails {
  address: string; // "Street, City, Country" — whatever parts are actually set
  paymentTerms: string; // freeform, e.g. "NET 30"
}

export async function fetchCustomerDetails(hailer: HailerApi, customerId: string): Promise<CustomerDetails> {
  const a = await hailer.activity.get(customerId).catch(() => null);
  if (!a) return { address: '', paymentTerms: '' };
  const street = (a.fields?.[CUSTOMERS.fields.streetAddress] as string) || '';
  const city = (a.fields?.[CUSTOMERS.fields.city] as string) || '';
  const country = (a.fields?.[CUSTOMERS.fields.country] as string) || '';
  const address = [street, city, country].filter(Boolean).join(', ');
  const paymentTerms = (a.fields?.[CUSTOMERS.fields.paymentTerms] as string) || '';
  return { address, paymentTerms };
}

export async function fetchIso17025Price(hailer: HailerApi): Promise<number> {
  const a = await hailer.activity.get(ISO_17025_CERT.activityId).catch(() => null);
  if (!a) return 500; // fallback if lookup fails
  return Number(a.fields?.[ISO_17025_CERT.priceFieldId] ?? 500) || 500;
}

export { NO_TRAVEL };
