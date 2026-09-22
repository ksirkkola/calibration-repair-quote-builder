export interface CountryRate {
  name: string;
  daysTraveling: number;
  airfare: number;
  carPerDay: number;
  hotelPerDay: number;
  foodPerDay: number;
}

export interface SystemRate {
  name: string; // raw Calibration Rates row name, e.g. "SGHP", "BODY PART"
  displayName: string;
  inHouseOnly: boolean;
  partsCost: number;
  daysOnSite: number;
}

export interface TicketSummary {
  _id: string;
  name: string;
  ticketCode: string;
  serviceType: string;
  customerId: string | null;
  customerName: string;
  companyFallback: string; // older tickets' freeform "Company" textarea
  currentPhaseId: string;
  existingAssetIds: string[]; // asset_1/2/3, whatever is already linked
}

export interface AssetSummary {
  _id: string;
  name: string; // e.g. "507-21"
  displayName: string; // "507-21 — Foot"
  productFamily: string;
  companyId: string | null;
  calibrationDue: number | null;
  lastCalibration: number | null;
  iso17025: boolean;
}

export type ServiceKind = 'calibration' | 'repair';

// One line of work for ONE asset. An asset can carry a calibration line AND a
// repair line at the same time (e.g. calibrate + repair the same Foot).
export interface AssetLine {
  id: string; // stable client-side id
  asset: AssetSummary;
  calibration: {
    enabled: boolean;
    iso17025: boolean;
    // Populated when a Calibration Rates row exists for this family.
    rate: SystemRate | null;
    // Manual fallback when no rate row exists (or the rep just prefers to type one in).
    manualPrice: number | null;
  };
  repair: {
    enabled: boolean;
    daysOnSite: number;
    partsCost: number; // cost, before the 70% markup
    notes: string;
  };
}

export interface QuoteLineResult {
  label: string;
  price: number; // sell price for this single line, for 1 year (repair lines are always 1yr/one-time)
  cost: number;
  isRepair: boolean;
  years: number; // 1 for repair lines; matches the quote's Years for calibration lines
}

export interface DiscountBreakdown {
  newClientRaw: number;
  multiUnitRaw: number;
  multiYearRaw: number;
  // After proportional scale-down if the combined raw total exceeds the 10% cap.
  newClientFinal: number;
  multiUnitFinal: number;
  multiYearFinal: number;
  scaled: boolean;
}

export interface QuoteTotals {
  lines: QuoteLineResult[];
  // Broken out into its components (Travel Labor / Airfare / Car / Hotel /
  // Meals) rather than one lumped "Travel & Expenses" line — clients should
  // see exactly what they're being charged for, not a rolled-up number.
  travelLines: QuoteLineResult[];
  subtotal: number; // sum of all line totals (already x years for calibration lines)
  discounts: DiscountBreakdown;
  totalDiscount: number;
  annualSubtotal: number; // subtotal - totalDiscount (this already reflects the full multi-year total)
  years: number;
  // Applied on top of annualSubtotal, based on the client's Payment Terms.
  paymentTerms: string; // e.g. "NET 60", or "" if unset on the client record
  paymentTermsSurchargePct: number; // e.g. 0.015 for NET 60
  paymentTermsSurchargeAmount: number;
  grandTotal: number; // annualSubtotal + paymentTermsSurchargeAmount
}

export interface QuoteMeta {
  quoteNumber: string;
  caseNumber: string; // == ticket code, read-only
  requestedBy: string;
  quoteDate: string; // YYYY-MM-DD
  locationOfAnnualCalibration: string;
  quoteExpires: string; // YYYY-MM-DD
  newCalibrationClient: boolean;
  years: number; // 1-3
  destination: string; // country name, or NO_TRAVEL
  travelers: number;
  billingContactName: string;
  billingEmail: string;
  billingPhone: string;
  billingAddress: string;
}
