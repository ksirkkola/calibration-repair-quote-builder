import { Activity, HailerApi } from '@hailer/app-sdk';

// Production cap: activity.list silently returns [] if limit is too large. Keep pageSize <= 200.
export async function listAll(
  hailer: HailerApi,
  workflowId: string,
  phaseId: string,
  pageSize = 200,
): Promise<Activity[]> {
  const all: Activity[] = [];
  let skip = 0;
  for (;;) {
    const page = await hailer.activity.list(workflowId, phaseId, { limit: pageSize, skip });
    all.push(...page);
    if (page.length < pageSize) break;
    skip += pageSize;
    if (skip > 5000) break; // safety cap
  }
  return all;
}

export async function fetchAllPhases(
  hailer: HailerApi,
  workflowId: string,
  phaseIds: string[],
): Promise<Activity[]> {
  const results = await Promise.all(
    phaseIds.map((p) =>
      listAll(hailer, workflowId, p).catch(() => [] as Activity[]),
    ),
  );
  return results.flat();
}

// activitylink read shape can be {_id,name}, [{_id,name}], or a plain id string.
export function readLinkId(v: unknown): string | undefined {
  if (Array.isArray(v)) return (v[0] as { _id?: string } | undefined)?._id;
  if (v && typeof v === 'object') return (v as { _id?: string })._id;
  if (typeof v === 'string') return v;
  return undefined;
}

export function readLinkName(v: unknown): string | undefined {
  if (Array.isArray(v)) return (v[0] as { name?: string } | undefined)?.name;
  if (v && typeof v === 'object') return (v as { name?: string }).name;
  return undefined;
}

// File-modifier fields store a JSON-stringified array of file IDs.
export function firstFileId(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed[0];
  } catch {
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

export function imageUrl(fileId: string, size: 'thumb' | 'hires' = 'hires'): string {
  return `https://api.hailer.com/image/${size}/${fileId}`;
}

export function formatMoney(value: number | undefined | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(unixMs: number | undefined | null): string {
  if (unixMs == null) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(unixMs));
}
