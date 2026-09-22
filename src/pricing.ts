import {
  MAX_COMBINED_DISCOUNT_PCT,
  MULTI_UNIT_DISCOUNT_PER_ASSET,
  MULTI_YEAR_DISCOUNT_PCT_PER_YEAR,
  NEW_CLIENT_DISCOUNT_MAX_YEARS,
  NEW_CLIENT_DISCOUNT_PCT_PER_YEAR,
  NO_TRAVEL,
  PARTS_MARKUP,
  PAYMENT_TERMS_SURCHARGE_PCT,
} from './constants/schema';
import { AssetLine, CountryRate, DiscountBreakdown, QuoteLineResult, QuoteTotals } from './types';

export interface RateConstants {
  laborPerDay: number;
  travelLaborPerDay: number;
  partsMarkup: number;
}

export const DEFAULT_CONSTANTS: RateConstants = {
  laborPerDay: 850,
  travelLaborPerDay: 850,
  partsMarkup: PARTS_MARKUP,
};

// Matches CalibrationBox's per-system formula exactly: days on-site x labor
// rate x travelers, plus marked-up parts.
export function calibrationUnitPrice(
  daysOnSite: number,
  partsCost: number,
  travelers: number,
  constants: RateConstants,
): { price: number; cost: number } {
  const labor = daysOnSite * constants.laborPerDay * travelers;
  return {
    price: labor + partsCost * (1 + constants.partsMarkup),
    cost: labor + partsCost,
  };
}

export function repairUnitPrice(
  daysOnSite: number,
  partsCost: number,
  travelers: number,
  constants: RateConstants,
): { price: number; cost: number } {
  const labor = daysOnSite * constants.laborPerDay * travelers;
  return {
    price: labor + partsCost * (1 + constants.partsMarkup),
    cost: labor + partsCost,
  };
}

interface ComputeQuoteInput {
  assetLines: AssetLine[];
  country: CountryRate | null; // null / NO_TRAVEL name => no travel line
  travelers: number;
  years: number;
  newCalibrationClient: boolean;
  isoPrice: number; // flat ISO 17025 add-on, per asset per year
  constants: RateConstants;
  paymentTerms: string; // e.g. "NET 60" — from the client's own record
}

function scaleDiscounts(raw: DiscountBreakdown, cap: number): DiscountBreakdown {
  const rawTotal = raw.newClientRaw + raw.multiUnitRaw + raw.multiYearRaw;
  if (rawTotal <= cap || rawTotal <= 0) {
    return {
      ...raw,
      newClientFinal: raw.newClientRaw,
      multiUnitFinal: raw.multiUnitRaw,
      multiYearFinal: raw.multiYearRaw,
      scaled: false,
    };
  }
  const scale = cap / rawTotal;
  return {
    ...raw,
    newClientFinal: raw.newClientRaw * scale,
    multiUnitFinal: raw.multiUnitRaw * scale,
    multiYearFinal: raw.multiYearRaw * scale,
    scaled: true,
  };
}

export function computeQuote(input: ComputeQuoteInput): QuoteTotals {
  const { assetLines, country, travelers, years, newCalibrationClient, isoPrice, constants, paymentTerms } = input;

  const lines: QuoteLineResult[] = [];
  let calSubtotal1yr = 0; // calibration + ISO lines only, ONE year — the base for New Client / Multi-Year discounts
  let onSiteDaysTotal = 0;
  const distinctAssetsInvolved = new Set<string>();

  for (const line of assetLines) {
    const label = line.asset.displayName;

    if (line.calibration.enabled) {
      distinctAssetsInvolved.add(line.asset._id);
      let unitPrice: number;
      let unitCost: number;
      if (line.calibration.rate) {
        const r = calibrationUnitPrice(
          line.calibration.rate.daysOnSite,
          line.calibration.rate.partsCost,
          travelers,
          constants,
        );
        unitPrice = r.price;
        unitCost = r.cost;
        onSiteDaysTotal += line.calibration.rate.daysOnSite;
      } else {
        // No rate row for this family — manual price fallback.
        unitPrice = line.calibration.manualPrice ?? 0;
        unitCost = unitPrice;
      }
      lines.push({
        label: `Single Calibration: ${label}`,
        price: unitPrice,
        cost: unitCost,
        isRepair: false,
        years,
      });
      calSubtotal1yr += unitPrice;

      if (line.calibration.iso17025) {
        lines.push({
          label: `ISO 17025 Calibration: ${label}`,
          price: isoPrice,
          cost: 0,
          isRepair: false,
          years,
        });
        calSubtotal1yr += isoPrice;
      }
    }

    if (line.repair.enabled) {
      distinctAssetsInvolved.add(line.asset._id);
      const r = repairUnitPrice(line.repair.daysOnSite, line.repair.partsCost, travelers, constants);
      onSiteDaysTotal += line.repair.daysOnSite;
      lines.push({
        label: `Repair: ${label}`,
        price: r.price,
        cost: r.cost,
        isRepair: true,
        years: 1, // one-time, never scaled by the multi-year contract length
      });
    }
  }

  // Travel — one lump-sum line covering labor, airfare, car, hotel, and
  // meals combined. Recurs every year (each annual visit still needs travel).
  const travelLines: QuoteLineResult[] = [];
  if (country && country.name !== NO_TRAVEL) {
    const travelLabor = country.daysTraveling * constants.travelLaborPerDay * travelers;
    const airfare = country.airfare * travelers;
    const car = onSiteDaysTotal * country.carPerDay;
    const hotel = onSiteDaysTotal * country.hotelPerDay * travelers;
    const meals = onSiteDaysTotal * country.foodPerDay * travelers;
    const travelTotal = travelLabor + airfare + car + hotel + meals;
    if (travelTotal > 0) {
      const label = `Travel Expense for ${travelers} Service Engineer${travelers === 1 ? '' : 's'}`;
      travelLines.push({ label, price: travelTotal, cost: travelTotal, isRepair: false, years });
    }
  }

  const subtotal =
    lines.reduce((s, l) => s + l.price * l.years, 0) + travelLines.reduce((s, l) => s + l.price * l.years, 0);

  const newClientRaw = newCalibrationClient
    ? NEW_CLIENT_DISCOUNT_PCT_PER_YEAR * calSubtotal1yr * Math.min(years, NEW_CLIENT_DISCOUNT_MAX_YEARS)
    : 0;
  // Onsite only — per the official T&Cs, does not apply to factory/in-house
  // calibration (destination is NO_TRAVEL, i.e. no `country` or its name is
  // literally "NO TRAVEL").
  const isOnsite = !!country && country.name !== NO_TRAVEL;
  const multiUnitRaw = isOnsite ? MULTI_UNIT_DISCOUNT_PER_ASSET * Math.max(0, distinctAssetsInvolved.size - 1) : 0;
  // Only applies when actually committing to multiple years (2-3), not a single-year quote.
  const multiYearRaw = years > 1 ? MULTI_YEAR_DISCOUNT_PCT_PER_YEAR * calSubtotal1yr * years : 0;

  const discounts = scaleDiscounts(
    {
      newClientRaw,
      multiUnitRaw,
      multiYearRaw,
      newClientFinal: 0,
      multiUnitFinal: 0,
      multiYearFinal: 0,
      scaled: false,
    },
    MAX_COMBINED_DISCOUNT_PCT * subtotal,
  );

  // Base (pre-surcharge) discount total — used only to report the surcharge's
  // dollar impact below; the actual returned totals use the surcharged version.
  const totalDiscount = discounts.newClientFinal + discounts.multiUnitFinal + discounts.multiYearFinal;

  // Payment Terms surcharge — based on the client's own record. Most
  // customers don't have this set yet (being filled in over time) — default
  // unset/unrecognized terms to "NET 30" (no surcharge) rather than leaving
  // it blank, so the assumption is explicit everywhere it's shown, not just
  // an invisible 0%.
  const effectivePaymentTerms = paymentTerms && PAYMENT_TERMS_SURCHARGE_PCT[paymentTerms] !== undefined ? paymentTerms : 'NET 30';
  const paymentTermsSurchargePct = PAYMENT_TERMS_SURCHARGE_PCT[effectivePaymentTerms] ?? 0;
  const surchargeMultiplier = 1 + paymentTermsSurchargePct;

  // Baked into every quoted price and every discount line — not added as a
  // separate lump sum at the end. This way each line the client sees already
  // reflects what they'll actually be charged, and Subtotal minus Discounts
  // adds up cleanly to TOTAL with no unexplained gap.
  const surchargedLines = lines.map(l => ({ ...l, price: l.price * surchargeMultiplier }));
  const surchargedTravelLines = travelLines.map(l => ({ ...l, price: l.price * surchargeMultiplier }));
  const surchargedDiscounts: DiscountBreakdown = {
    ...discounts,
    newClientFinal: discounts.newClientFinal * surchargeMultiplier,
    multiUnitFinal: discounts.multiUnitFinal * surchargeMultiplier,
    multiYearFinal: discounts.multiYearFinal * surchargeMultiplier,
  };

  const surchargedSubtotal = subtotal * surchargeMultiplier;
  const surchargedTotalDiscount =
    surchargedDiscounts.newClientFinal + surchargedDiscounts.multiUnitFinal + surchargedDiscounts.multiYearFinal;
  const annualSubtotal = surchargedSubtotal - surchargedTotalDiscount;

  // The dollar amount the surcharge added, purely for informational display
  // (e.g. "prices include a 1.5% NET 60 surcharge") — it's not a separate
  // line to add anywhere; it's already inside subtotal/discounts/annualSubtotal above.
  const paymentTermsSurchargeAmount = (subtotal - totalDiscount) * paymentTermsSurchargePct;

  return {
    lines: surchargedLines,
    travelLines: surchargedTravelLines,
    subtotal: surchargedSubtotal,
    discounts: surchargedDiscounts,
    totalDiscount: surchargedTotalDiscount,
    annualSubtotal,
    years,
    paymentTerms: effectivePaymentTerms,
    paymentTermsSurchargePct,
    paymentTermsSurchargeAmount,
    grandTotal: annualSubtotal,
  };
}
