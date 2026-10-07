// Workflow / field IDs for the Calibration & Repair Quote Builder.
// Fields have no keys in most of these workflows — hex IDs used directly,
// mirroring the Product Configurator app's schema.ts convention.

export const TRIPS_IHS = {
  workflowId: '6a211715b129621437c16b03',
  phases: {
    triage: '6a211716b129621437c16b0e',
    preTravel: '6a211716b129621437c16b0f',
    inProgress: '6a211716b129621437c16b11',
    followUp: '6a211716b129621437c16b12',
    waitingOnPo: '6a211716b129621437c16b13',
    waitingOnDates: '6a211716b129621437c16b14',
    closed: '6a211716b129621437c16b10',
  },
  // Every non-closed phase — the ticket picker searches across all of these.
  get openPhases(): string[] {
    return [
      this.phases.triage,
      this.phases.preTravel,
      this.phases.inProgress,
      this.phases.followUp,
      this.phases.waitingOnPo,
      this.phases.waitingOnDates,
    ];
  },
  fields: {
    customer: '6a211716b129621437c16b16', // activitylink -> Customers
    company: '6a211716b129621437c16b26', // textarea fallback, older tickets
    ticketCode: '6a211716b129621437c16b27', // e.g. "E-Clb-0005"
    serviceType: '6a325f05506c8ccc619b0dbb', // Calibration | In House Service / Repair | Startup | Testing | Training
    asset1: '6a211716b129621437c16b28', // activitylink -> Assets
    asset2: '6a212af52813c3db76ce6881',
    asset3: '6a212b1f2813c3db76ce6a02',
    iso17025Calibration: '6a211716b129621437c16b34', // Yes/No roll-up across all assets on this ticket
    serviceTripType: '6a211716b129621437c16b2e', // Warranty | Service Plan | Paid | Courtesy
    quote: '6a211716b129621437c16b3b', // informal textarea summary
    poNumber: '6a211716b129621437c16b3c',
    poReceived: '6a211716b129621437c16b3d',
    poAmount: '6a211716b129621437c16b3e',
    // The old 'Amount to Invoice' field was deleted; TMXE Total now holds "how much to invoice for this trip",
    // so the quoted per-year total is written there. (Key name kept so call sites don't change.)
    amountToInvoice: '6a425ee640e736dacafe81ed',
    tmxeTotal: '6a425ee640e736dacafe81ed',
    clientContactPerson: '6a799e8aef5cbedbd85d3631', // activitylink -> Contact persons
    clientContactEmail: '6a75d1557163b2968df43e2f',
    daysOnsite: '6a211716b129621437c16b39',
    totalTravelDays: '6a211716b129621437c16b38',
    estimatedMonth: '6a211716b129621437c16b33',
    yearOfService: '6a211716b129621437c16b36',
    billingNotes: '6a32778f506c8ccc619c6f86',
    assetText: '6a211716b129621437c16b23', // freeform textarea, required on create
    estimatedArrivalDate: '6a211716b129621437c16b35',
    clientIdentifiedIssues: '6a211716b129621437c16b30',
    // Calibration Quote Builder app fields (added for this app):
    quoteNumber: '6a96c6e122a116fc988bb15f',
    quoteExpires: '6a96c6e122a116fc988bb162',
    locationOfAnnualCalibration: '6a96c6e122a116fc988bb166',
    newCalibrationClient: '6a96c6e122a116fc988bb169', // Yes/No
    quoteDetailsJson: '6a96c6e122a116fc988bb16e',
    excludeFromQuoteBuilder: '6a98167b8a75d36b1badd64a', // Yes/No — hides this ticket from the app's picker
    yearsQuoted: '6a96c6f48e07afb74cb66097',
  },
} as const;

export const ASSETS = {
  workflowId: '6a041d0ffc4db70b8339c8c7',
  phaseId: '6a041d0ffc4db70b8339c8ca',
  fields: {
    assetName: '6a041d0ffc4db70b8339c8c8', // e.g. "507-21" — the unit's own serial-ish label
    productFamily: '6a070e0841b657c20f86323a', // dropdown, e.g. "507-Foot"
    company: '6a0714bf205f1f20554a4340', // activitylink -> Customers
    calibrationDue: '6a07118e41b657c20f863f5e',
    lastCalibration: '6a0d79749de2da90175a4d5d',
    iso17025: '6a0711d541b657c20f86404e', // Yes/No
  },
} as const;

export const CUSTOMERS = {
  workflowId: '6a041d0ffc4db70b8339c891',
  phaseId: '6a041d0ffc4db70b8339c89c',
  fields: {
    streetAddress: '6a508cd12ea5e9da20741d68',
    city: '6a041d0ffc4db70b8339c897',
    country: '6a3cbc95c15e261f4512e9a0',
    paymentTerms: '6a97c5d43fecc74918abc6cd', // dropdown: "NET 30" | "NET 45" | "NET 60" | "NET 75" | "NET 90"
  },
} as const;

// Surcharge applied to the whole quote total, based on the client's own
// Payment Terms dropdown. Matches the field's own documented schedule —
// confirmed against real customer data already using these exact rates
// (e.g. CTAG stored "NET 60 (1.5% surcharge on total price)" before the
// field was converted to a dropdown).
export const PAYMENT_TERMS_SURCHARGE_PCT: Record<string, number> = {
  'NET 30': 0,
  'NET 45': 0.01,
  'NET 60': 0.015,
  'NET 75': 0.02,
  'NET 90': 0.03,
};

export const CONTACTS = {
  workflowId: '6a041d0ffc4db70b8339c89a',
  phaseId: '6a041d0ffc4db70b8339c8e5',
  fields: {
    firstName: '6a041d0ffc4db70b8339c8e0',
    lastName: '6a041d0ffc4db70b8339c8e1',
    phone: '6a041d0ffc4db70b8339c8e2',
    email: '6a041d0ffc4db70b8339c8c5',
    company: '6a041d0ffc4db70b8339c8e4', // activitylink -> Customers
  },
} as const;

// Calibration Rates dataset — fields have keys, resolve via field resolver.
// Same dataset the Product Configurator's CalibrationBox reads.
export const CALIBRATION_RATES = {
  workflowId: '6a687f173ca04dbbb1afaf49',
  phaseId: '6a687f173ca04dbbb1afaf48',
  fields: {
    rowType: 'row_type',
    daysTraveling: 'days_traveling',
    airfare: 'airfare',
    carPerDay: 'car_per_day',
    hotelPerDay: 'hotel_per_day',
    foodPerDay: 'food_per_day',
    daysOnSite: 'days_on_site',
    partsCost: 'parts_cost',
    value: 'value',
  },
} as const;

// The single "ISO 17025 Certificate" Price List row — flat €500 add-on.
export const ISO_17025_CERT = {
  activityId: '6a69e437616a9a685edd2372',
  priceFieldId: '6a6858ec3ee2c872c64f6013',
} as const;

export const NO_TRAVEL = 'NO TRAVEL';

// Assets.product_family -> the matching tab name in calibrationMatrix.ts
// (from "Calibration Matrix by System 9.28.22.xlsx"). Families with no
// mapping (e.g. 600-Custom, or Burnie which isn't calibrated at all) simply
// get no scope-of-work section on the quote.
export const PRODUCT_FAMILY_TO_MATRIX_CATEGORY: Record<string, string> = {
  '501-Newton': 'T - Manikins',
  '504-Child': 'T - Manikins',
  '502-Nemo': 'T - Manikins',
  '513-Baby': 'T - Manikins',
  '515-ANDI': 'T - Manikins',
  '521-Liz': 'T - Manikins',
  '505-Head': 'T - Manikins',
  '506-Hand': 'T - Manikins',
  '507-Foot': 'T - Manikins',
  '509-STAN': 'T - Manikins',
  '522-ACE': 'T - Manikins',
  '306-GHP': 'T - Hotplates',
  '306-SGHP': 'T - Hotplates',
  '306-SDHP': 'T - Hotplates',
  '431-iSGHP': 'T - Hotplates',
  '431-iSDHP': 'T - Hotplates',
  '431-iDHP': 'T - Hotplates',
  '514-DRT': 'T - DRT',
  '508-HVAC': 'T - HVAC',
  '316-ST-2XL': 'T - ST2XL',
  '403-TPP': 'P - TPP',
  '419-RPP': 'P - RPP',
  '461-CCHR': 'P - CCHR',
  '292-SET': 'P - SET',
  '520-Flash Fire': 'P - FFC',
};

// Assets.product_family -> Calibration Rates "system" row name.
// Confirmed with Kristin 2026-09 — see handoff notes for the reasoning per family.
export const PRODUCT_FAMILY_TO_RATE: Record<string, string> = {
  '306-GHP': 'SGHP', // same rate as SGHP
  '306-SGHP': 'SGHP',
  '306-SDHP': 'D-SGHP', // "D-SGHP" = old naming for SDHP
  '431-iSGHP': 'iSGHP',
  '431-iSDHP': 'D-iSGHP', // "D-iSGHP" = old naming for iSDHP
  '501-Newton': 'Newton',
  '502-Nemo': 'Nemo',
  '504-Child': 'Newton', // identical rate to Baby/Newton
  '505-Head': 'BODY PART',
  '506-Hand': 'BODY PART',
  '507-Foot': 'BODY PART',
  '508-HVAC': 'HVAC (In House only)',
  '509-STAN': 'STAN (In House only)',
  '513-Baby': 'Baby',
  '514-DRT': 'DRT',
  '515-ANDI': 'ANDI',
  '521-Liz': 'Liz',
  '316-ST-2XL': 'ST2XL (In House only)',
};

// Client self-calibrates — never offered as a Calibration line, repair only.
export const NO_CALIBRATION_FAMILIES = new Set(['510-Burnie']);

// Business constants confirmed with Kristin — see handoff notes.
export const NEW_CLIENT_DISCOUNT_PCT_PER_YEAR = 0.05; // 5%/yr, capped at 2 years — corrected to match the official "TMXE Terms & Conditions on Services" document (was 10%)
export const NEW_CLIENT_DISCOUNT_MAX_YEARS = 2;
export const MULTI_UNIT_DISCOUNT_PER_ASSET = 1000; // € flat, per additional asset beyond the first
export const MULTI_YEAR_DISCOUNT_PCT_PER_YEAR = 0.02; // 2% of 1-year subtotal, x years requested — only applies at 2-3 years, not a 1-year quote
export const MAX_COMBINED_DISCOUNT_PCT = 0.1; // combined discounts never exceed 10% of Subtotal
export const MAX_ASSETS_PER_TRIP = 3;
export const PARTS_MARKUP = 0.7; // 70% markup on repair parts cost (same as calibration parts)
