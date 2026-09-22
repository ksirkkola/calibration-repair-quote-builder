// Serializes/restores the full in-progress quote to/from the TRIPS/IHS
// ticket's "Calibration Quote Details (JSON)" field — the same "save
// everything as JSON on the linked record" pattern the Product Configurator
// uses for its draft field, just always-on here (no separate draft/final
// distinction — every Save Quote overwrites this).
import { buildAssetLine } from './components/AssetPicker';
import { CalibrationRatesData, fetchAssetsByIds } from './hailer/data';
import { AssetLine, QuoteMeta } from './types';
import { HailerApi } from '@hailer/app-sdk';

interface StoredLineState {
  assetId: string;
  calEnabled: boolean;
  iso17025: boolean;
  manualPrice: number | null;
  repairEnabled: boolean;
  repairDays: number;
  repairParts: number;
  repairNotes: string;
}

export type QuoteStatus = 'draft' | 'final';

export interface QuoteStatePayload {
  version: 1;
  status: QuoteStatus;
  lines: StoredLineState[];
  destination: string;
  travelers: number;
  years: number;
  newCalibrationClient: boolean;
  meta: Omit<QuoteMeta, 'caseNumber'>;
  // IDs of the future-year TRIPS/IHS tickets auto-created on Finalize for a
  // multi-year quote (one quote, cloned into a scheduling ticket per extra
  // year). Tracked so re-finalizing an already-finalized quote UPDATES these
  // instead of creating duplicates.
  siblingTicketIds?: string[];
}

export function serializeQuoteState(
  lines: AssetLine[],
  destination: string,
  travelers: number,
  years: number,
  newCalibrationClient: boolean,
  meta: QuoteMeta,
  status: QuoteStatus,
  siblingTicketIds?: string[],
): string {
  const { caseNumber, ...restMeta } = meta;
  const payload: QuoteStatePayload = {
    version: 1,
    status,
    lines: lines.map((l) => ({
      assetId: l.asset._id,
      calEnabled: l.calibration.enabled,
      iso17025: l.calibration.iso17025,
      manualPrice: l.calibration.manualPrice,
      repairEnabled: l.repair.enabled,
      repairDays: l.repair.daysOnSite,
      repairParts: l.repair.partsCost,
      repairNotes: l.repair.notes,
    })),
    destination,
    travelers,
    years,
    newCalibrationClient,
    meta: restMeta,
    ...(siblingTicketIds && siblingTicketIds.length > 0 ? { siblingTicketIds } : {}),
  };
  return JSON.stringify(payload);
}

export interface RestoredQuoteState {
  lines: AssetLine[];
  destination: string;
  travelers: number;
  years: number;
  newCalibrationClient: boolean;
  metaPartial: Omit<QuoteMeta, 'caseNumber'>;
  status: QuoteStatus;
  siblingTicketIds: string[];
}

export async function restoreQuoteState(
  hailer: HailerApi,
  raw: string,
  rates: CalibrationRatesData,
): Promise<RestoredQuoteState | null> {
  let payload: QuoteStatePayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!payload || payload.version !== 1 || !Array.isArray(payload.lines)) return null;

  const assets = await fetchAssetsByIds(hailer, payload.lines.map((l) => l.assetId));
  const assetById = new Map(assets.map((a) => [a._id, a]));

  const lines: AssetLine[] = payload.lines
    .map((stored) => {
      const asset = assetById.get(stored.assetId);
      if (!asset) return null;
      const base = buildAssetLine(asset, rates);
      return {
        ...base,
        calibration: {
          ...base.calibration,
          enabled: stored.calEnabled,
          iso17025: stored.iso17025,
          manualPrice: stored.manualPrice,
        },
        repair: {
          enabled: stored.repairEnabled,
          daysOnSite: stored.repairDays,
          partsCost: stored.repairParts,
          notes: stored.repairNotes,
        },
      };
    })
    .filter((l): l is AssetLine => l !== null);

  return {
    lines,
    destination: payload.destination,
    travelers: payload.travelers,
    years: payload.years,
    newCalibrationClient: payload.newCalibrationClient,
    metaPartial: payload.meta,
    status: payload.status === 'final' ? 'final' : 'draft',
    siblingTicketIds: Array.isArray(payload.siblingTicketIds) ? payload.siblingTicketIds : [],
  };
}
