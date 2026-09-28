import pdfMake from 'pdfmake/build/pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatMoney } from './hailer/api-helpers';
import { AssetLine, QuoteMeta, QuoteTotals } from './types';
import { THERMETRICS_LOGO } from './assets/logo';
import { CALIBRATION_MATRIX } from './constants/calibrationMatrix';
import { PRODUCT_FAMILY_TO_MATRIX_CATEGORY } from './constants/schema';

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfMake as any).addVirtualFileSystem(vfsFonts);
  fontsRegistered = true;
}

interface QuotePdfInput {
  totals: QuoteTotals;
  meta: QuoteMeta;
  clientName: string;
  assetLines: AssetLine[];
}

// pdfmake table cell needs plain strings.
function matrixCell(v: string): Content {
  return { text: v || '', fontSize: 6.5, margin: [0, 0, 0, 0] as [number, number, number, number] };
}

// Trims a matrix sheet down for print: drops any column that's entirely
// blank across every row (several sheets carry unused placeholder columns —
// e.g. Hotplates' "Items to Picked" was never filled in), and drops any
// column literally titled "Notes" — that's for internal use only, not the
// client-facing quote.
function trimSheetForPrint(sheet: { headers: string[]; rows: string[][] }): { headers: string[]; rows: string[][] } {
  const keep = sheet.headers.map((h, i) => {
    if (h.trim().toLowerCase() === 'notes') return false;
    const allBlank = sheet.rows.every((r) => !r[i] || !r[i].trim());
    return !allBlank;
  });
  return {
    headers: sheet.headers.filter((_, i) => keep[i]),
    rows: sheet.rows.map((r) => r.filter((_, i) => keep[i])),
  };
}

// Only the categories actually being calibrated on THIS quote — not all 10.
function matrixSectionsFor(assetLines: AssetLine[]): Content[] {
  const categories = new Set<string>();
  for (const line of assetLines) {
    if (!line.calibration.enabled) continue;
    const category = PRODUCT_FAMILY_TO_MATRIX_CATEGORY[line.asset.productFamily];
    if (category) categories.add(category);
  }
  if (categories.size === 0) {
    return [
      {
        text: 'The specific calibration activities and components included within each system calibration are defined in the applicable Thermetrics System Calibration Matrix.',
        fontSize: 8,
        color: '#4a5568',
        margin: [0, 0, 0, 10],
      },
    ];
  }

  const content: Content[] = [];
  for (const categoryName of categories) {
    const rawSheet = CALIBRATION_MATRIX.find((s) => s.name === categoryName);
    if (!rawSheet) continue;
    const sheet = trimSheetForPrint(rawSheet);
    content.push({ text: categoryName.replace(/^[TP] - /, ''), bold: true, fontSize: 9, margin: [0, 6, 0, 3] });
    // Every column gets an explicit FIXED width — 'auto' still sizes to the
    // header/content's natural (unwrapped) length, which for these long
    // descriptive headers ends up just as wide as the page. Fixed widths
    // force every cell (including headers) to wrap, so the table's total
    // width is deterministic and narrow regardless of content length.
    const colWidths = sheet.headers.map((_, i) => (i === 0 ? 170 : 65));
    content.push({
      table: {
        headerRows: 1,
        widths: colWidths,
        body: [
          sheet.headers.map((h) => ({ text: h, bold: true, fontSize: 6.5, fillColor: '#e2e8f0' })),
          ...sheet.rows.map((row) => row.map(matrixCell)),
        ],
      },
      layout: { paddingTop: () => 1, paddingBottom: () => 1, paddingLeft: () => 3, paddingRight: () => 3 },
      // Fixed column widths give the table a fixed total width narrower than
      // the page — 'center' then centers that block on the page instead of
      // pinning it to the left margin.
      alignment: 'center',
      margin: [0, 0, 0, 6] as [number, number, number, number],
    });
  }
  return content;
}

// From "TMXE Terms & Conditions on Services.pdf" (updated 1.7.2026). The
// "Discounts" section is deliberately omitted per instruction — the quote
// already shows actual computed discount lines, so restating the general
// policy text here would be redundant. Everything else is genuinely new —
// there were no legal/commercial terms in the quote before this, only the
// scope-of-work content above.
function termsAndConditionsSections(): Content[] {
  const h2 = (text: string): Content => ({ text, bold: true, fontSize: 10, margin: [0, 10, 0, 4] as [number, number, number, number] });
  const h3 = (text: string): Content => ({ text, bold: true, fontSize: 9, margin: [0, 6, 0, 2] as [number, number, number, number] });
  const p = (text: string): Content => ({ text, fontSize: 8, color: '#4a5568', margin: [0, 0, 0, 4] as [number, number, number, number] });

  return [
    // No forced page break here — the matrix tables are now compact enough
    // that a hard break left a large blank gap at the bottom of that page.
    // Flowing naturally lets pdfmake fill the remaining space first.
    { text: 'Terms and Conditions on Services', fontSize: 14, bold: true, margin: [0, 10, 0, 10] as [number, number, number, number] },

    h2('General Terms and Conditions'),
    h3('1. Purchase Orders and Scheduling'),
    p('A valid Purchase Order is required for all Onsite or Factory Calibration services. Purchase Orders must be received no later than one (1) calendar month prior to the requested service date in order to reserve a calendar slot. Availability is not guaranteed until confirmed in writing by Thermetrics.'),
    h3('2. Invoicing'),
    p('Invoices shall be issued from the email address europe@thermetrics.com and will include all required banking and payment information.'),
    h3('3. Scope of Services'),
    p('The purchase of a single calibration constitutes a one-time service transaction and does not include any ongoing maintenance, support, or extended service coverage beyond the specific calibration purchased.'),
    h3('4. Payment Obligation'),
    p('All payments shall be made in full to Thermetrics Europe Oy, unless otherwise agreed in writing.'),
    h3('5. Limitation of Liability'),
    p('To the fullest extent permitted by applicable EU law, Thermetrics shall not be liable for any indirect, incidental, consequential, or special damages, including but not limited to loss of use, loss of profits, cost of cover, extraordinary removal or reinstallation costs, or governmental fines or penalties, arising out of or in connection with the performance or non-performance of services, late delivery, or errors or omissions.'),
    p('This limitation does not apply to liability that cannot be excluded or limited under mandatory law, including liability for death or personal injury caused by negligence, fraud, or willful misconduct.'),
    h3('6. Liability Cap'),
    p("Subject to mandatory statutory provisions, Thermetrics' total aggregate liability under any agreement shall not exceed one hundred percent (100%) of the fees paid for the relevant service giving rise to the claim."),
    h3('7. Indemnification and Confidentiality'),
    p("Thermetrics' standard warranty provisions relating to indemnification and confidentiality apply in full and form an integral part of these Terms and Conditions."),
    h3('8. Force Majeure and Service Interruptions'),
    p('Thermetrics Europe shall not be liable for delays, suspension, or failure to perform services resulting from events beyond its reasonable control, including but not limited to government-issued travel restrictions, public health emergencies, acts of authorities, or other circumstances that prevent the safe or lawful delivery of services.'),

    h2('Payment Terms'),
    h3('1. Standard Payment Terms'),
    p('Thermetrics Europe shall issue a quotation upon request. Unless otherwise agreed in writing, the default payment term is Net 30 days, payable by bank transfer.'),
    p('No work shall commence and no goods shall be shipped until a valid Purchase Order has been received by Thermetrics Europe Oy.'),
    h3('2. Alternative Payment Terms'),
    p('Alternative payment terms may be agreed on a case-by-case basis prior to acceptance of the quotation. Where alternative terms are agreed, a revised quotation shall be issued reflecting the applicable pricing adjustment:'),
    {
      ul: [
        'Net 30: no surcharge',
        'Net 45: 1.0% surcharge on total price',
        'Net 60: 1.5% surcharge on total price',
        'Net 75: 2.0% surcharge on total price',
        'Net 90: 3.0% surcharge on total price',
      ],
      fontSize: 8,
      color: '#4a5568',
      margin: [0, 0, 0, 4] as [number, number, number, number],
    },
    h3('3. Failure to Provide Purchase Order'),
    p('Failure to provide a Purchase Order prior to the agreed start date may result in delays, suspension of services, or cancellation of the order without liability to Thermetrics.'),

    h2('Cancellation or Postponement by Client Terms'),
    h3('1. Notice Requirement'),
    p('The Client may cancel or postpone a scheduled service or trip by providing written notice to Thermetrics as soon as reasonably possible, and no later than one (1) calendar month prior to the scheduled service date.'),
    h3('2. Cancellation or Postponement Fees'),
    p('More than 15 calendar days\u2019 notice: No cancellation fee will apply. Any prepayments shall be refunded or, at Thermetrics\u2019 discretion, credited toward a future service.'),
    p('7 to 14 calendar days\u2019 notice: The Client shall be charged fifty percent (50%) of the applicable travel-related service fees.'),
    p('Less than 7 calendar days\u2019 notice: The Client shall be charged one hundred percent (100%) of the applicable travel-related service fees.'),
    h3('3. Rescheduling'),
    p('Thermetrics Europe will use reasonable efforts to accommodate rescheduling requests, subject to availability and mutual written agreement. Any additional costs incurred as a result of rescheduling shall be borne by the Client.'),
  ];
}

function fmtDate(v: string): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString();
}

// Renders the "QUOTE #/CASE #/..." and "LOCATION OF ANNUAL CALIBRATION/..."
// blocks as ONE borderless table (5 columns: label, value, gap, label, value)
// instead of two independent side-by-side `stack`s. This matters because a
// `stack` has no concept of a shared row height — when a value on one side
// wraps to multiple lines (a long quote number, a full street address),
// that stack simply gets taller while the other stack's rows don't move, so
// unrelated label/value pairs drift into visual alignment with each other
// (confirmed from a real generated PDF: "LOCATION OF ANNUAL CALIBRATION"
// running straight into the address with no gap). A real pdfmake `table`
// gives every row one height (the max of its cells), keeping both sides in
// lockstep no matter how much either side wraps. Values are left-aligned so
// wrapped multi-line values stay readable (right-aligning would make each
// wrapped line jump to a different horizontal position).
function infoTable(left: [string, string][], right: [string, string][]): Content {
  const rowCount = Math.max(left.length, right.length);
  const body: TableCell[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const [lLabel, lValue] = left[i] ?? ['', ''];
    const [rLabel, rValue] = right[i] ?? ['', ''];
    body.push([
      { text: lLabel, bold: true, fontSize: 9 },
      { text: lValue || '—', fontSize: 9 },
      { text: '' },
      { text: rLabel, bold: true, fontSize: 9 },
      { text: rValue || '—', fontSize: 9 },
    ]);
  }
  return {
    // All 5 columns are fixed pt widths, not 'auto'/'*' — this table's total
    // must fit A4's ~515pt content width (595.28 - 80 margins) MINUS the
    // 'noBorders' layout's own built-in cell padding (4pt each side of each
    // internal column boundary = 32pt total across 5 columns), which isn't
    // reflected in the widths array at all. Using '*' or 'auto' without
    // accounting for that padding silently overflowed text past the page's
    // right edge instead of wrapping it (confirmed by rendering an actual
    // PDF) — 75/118/14/155/118 sums to 480 + 32 padding = 512, safely under
    // the 515.28pt budget, and 118pt fits ~26-27 characters per line at
    // fontSize 9, wrapping long values (addresses, quote numbers) onto
    // multiple lines cleanly instead of clipping them.
    table: { widths: [75, 118, 14, 155, 118], body },
    layout: 'noBorders',
    margin: [0, 0, 0, 15],
  };
}

export function buildQuoteDocDefinition(input: QuotePdfInput): TDocumentDefinitions {
  const { totals, meta, clientName } = input;

  const headerRow: TableCell[] = ['Line Item', 'PRODUCT ID', 'DESCRIPTION', 'PRICE (EUR)'];
  const body: TableCell[][] = [headerRow];
  let lineNum = 0;

  // One lump-sum line — label already includes the traveler count.
  for (const l of totals.travelLines) {
    lineNum += 1;
    body.push([
      String(lineNum),
      'Service Engineer',
      l.label,
      formatMoney(l.price * l.years),
    ]);
  }

  for (const l of totals.lines) {
    if (l.isRepair) {
      lineNum += 1;
      body.push([String(lineNum), 'Repair', l.label.replace('Repair: ', 'Asset: '), formatMoney(l.price * l.years)]);
      continue;
    }
    if (l.label.startsWith('ISO 17025')) {
      body.push(['', '', l.label.replace('ISO 17025 Calibration: ', 'ISO 17025 Calibration: '), formatMoney(l.price * l.years)]);
      continue;
    }
    lineNum += 1;
    body.push([String(lineNum), 'Single Calibration', l.label.replace('Single Calibration: ', 'Asset: '), formatMoney(l.price * l.years)]);
  }

  body.push([{ text: '', colSpan: 3 }, {}, {}, { text: `Subtotal: ${formatMoney(totals.subtotal)}`, bold: true }]);

  if (totals.discounts.newClientFinal > 0) {
    body.push([
      { text: '', colSpan: 2 },
      {},
      { text: 'New Calibration Client (5% per year on calibration work, max of 2 years issued on same quote)', fontSize: 8 },
      { text: `-${formatMoney(totals.discounts.newClientFinal)}`, color: '#c05621' },
    ]);
  }
  if (totals.discounts.multiUnitFinal > 0) {
    body.push([
      { text: '', colSpan: 2 },
      {},
      { text: 'Multi-Unit Discount (1000€ per each additional asset per trip)', fontSize: 8 },
      { text: `-${formatMoney(totals.discounts.multiUnitFinal)}`, color: '#c05621' },
    ]);
  }
  if (totals.discounts.multiYearFinal > 0) {
    body.push([
      { text: '', colSpan: 2 },
      {},
      { text: 'Multi-Year Discount (2% per year for a max of 3 years)', fontSize: 8 },
      { text: `-${formatMoney(totals.discounts.multiYearFinal)}`, color: '#c05621' },
    ]);
  }

  body.push([{ text: '', colSpan: 3 }, {}, {}, { text: `Annual Subtotal: ${formatMoney(totals.subtotal - totals.totalDiscount)}`, bold: true }]);
  body.push([{ text: '', colSpan: 2 }, {}, { text: '# of Years', fontSize: 9 }, { text: String(totals.years), fontSize: 9 }]);
  // Payment Terms surcharge is baked directly into every line price and
  // every discount above (see pricing.ts) — Annual Subtotal already reflects
  // it, so TOTAL below is just that figure, with no separate addition and no
  // unexplained gap between the line items and the total.
  body.push([{ text: '', colSpan: 3 }, {}, {}, { text: `TOTAL: ${formatMoney(totals.grandTotal)}`, bold: true, fontSize: 12 }]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { fontSize: 9 },
    content: [
      {
        columns: [
          { text: 'Calibration Quote', fontSize: 20, bold: true },
          { image: THERMETRICS_LOGO, width: 150, alignment: 'right' as const },
        ],
        margin: [0, 0, 0, 15],
      },
      infoTable(
        [
          ['QUOTE #', meta.quoteNumber],
          ['CASE #', meta.caseNumber],
          ['CLIENT', clientName],
          ['REQUESTED BY', meta.requestedBy],
          ['DATE', fmtDate(meta.quoteDate)],
        ],
        [
          ['LOCATION OF ANNUAL CALIBRATION', meta.locationOfAnnualCalibration],
          ['QUOTE EXPIRES', fmtDate(meta.quoteExpires)],
          ['QUOTE ISSUED BY', 'Kristin Sirkkola, Thermetrics Europe Oy'],
          ['PAYMENT TERMS', `Wire Transfer, ${totals.paymentTerms}`],
        ],
      ),
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: 'Billing INFORMATION (CLIENT to fill)', colSpan: 2, bold: true, fillColor: '#f0f0f0' }, {}],
            ['Contact Name', meta.billingContactName || ''],
            ['Email Address', meta.billingEmail || ''],
            ['Phone Number', meta.billingPhone || ''],
            ['Billing Address', meta.billingAddress || ''],
          ],
        },
        margin: [0, 0, 0, 15],
      },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto'],
          body,
        },
        layout: { fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e2e8f0' : null) },
        margin: [0, 0, 0, 10],
      },
      {
        text: 'A PO is needed one month prior to any trip, service or software upgrade to reserve a spot on our support calendar. All services will be carried out by Thermetrics Europe Oy.',
        fontSize: 8,
        color: '#718096',
        margin: [0, 0, 0, 20],
      },
      { text: 'Reviewed and Accepted By:', bold: true, margin: [0, 0, 0, 8] },
      { text: 'Signature: ________________________________  Date: ________________________', margin: [0, 0, 0, 4] },
      { text: 'Name: ', margin: [0, 0, 0, 2] },
      { text: 'Title: ', margin: [0, 0, 0, 2] },
      { text: 'Company: ', margin: [0, 0, 0, 12] },
      { text: '________________________________  Date: _________________________', margin: [0, 0, 0, 4] },
      { text: 'Name: Kristin Sirkkola', margin: [0, 0, 0, 2] },
      { text: 'Title: Business Operations Manager', margin: [0, 0, 0, 2] },
      { text: 'Company: Thermetrics Europe Oy', margin: [0, 0, 0, 20] },
      { text: 'Please contact europe@thermetrics.com for further information and inquiries.', fontSize: 8, color: '#718096' },
      { text: '', pageBreak: 'before' as const },
      { text: 'System Calibration Services', fontSize: 14, bold: true, margin: [0, 0, 0, 10] },
      { text: 'General Provisions', bold: true, margin: [0, 0, 0, 4] },
      { text: 'Service Provider', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      { text: 'Full system calibration services are provided by Thermetrics (Thermetrics Europe Oy).', fontSize: 8, color: '#4a5568' },
      { text: 'Location of Calibration', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: "System calibration is ordinarily performed at the Client's premises. Where repair or additional services are requested in conjunction with calibration, the system may, subject to mutual agreement, be transported to Thermetrics Europe Oy's facility in Porvoo, Finland.",
        fontSize: 8,
        color: '#4a5568',
      },
      {
        text: 'The agreed calibration location shall be declared at the time of purchase and expressly stated in the quotation and sales documentation.',
        fontSize: 8,
        color: '#4a5568',
        margin: [0, 4, 0, 0],
      },
      { text: 'Duration of Calibration', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      { text: 'Onsite system calibrations typically require three (3) to five (5) working days.', fontSize: 8, color: '#4a5568' },
      {
        text: 'System calibrations performed at a Thermetrics facility typically require two (2) to four (4) weeks, depending on system type and scope.',
        fontSize: 8,
        color: '#4a5568',
      },
      {
        text: 'These timeframes are indicative and may vary based on system condition, scope, or external factors.',
        fontSize: 8,
        color: '#4a5568',
      },
      { text: 'System Availability', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: 'The system shall be unavailable and out of operation for the full duration of the calibration work.',
        fontSize: 8,
        color: '#4a5568',
      },
      { text: 'Scheduling Requirements', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: 'Calibration services must be requested by the Client and scheduled no less than four (4) weeks prior to the intended service start date. Scheduling is subject to availability and written confirmation by Thermetrics.',
        fontSize: 8,
        color: '#4a5568',
      },
      { text: 'Multiple Systems', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: 'Where multiple systems are included within the same order and calibration is performed onsite, all systems shall be calibrated during the same service window unless otherwise expressly agreed in writing.',
        fontSize: 8,
        color: '#4a5568',
      },
      { text: 'Thermal System Calibration Specifics', bold: true, fontSize: 10, margin: [0, 10, 0, 4] },
      { text: 'System Location Restrictions', bold: true, fontSize: 9, margin: [0, 4, 0, 2] },
      {
        text: "STAN and HVAC manikins may only be calibrated at Thermetrics' facility in Seattle, USA. Onsite or field calibration services are not available for these systems.",
        fontSize: 8,
        color: '#4a5568',
      },
      {
        text: 'ISGHP systems (Hotplate with integrated environmental chamber) may only be calibrated at the Client\'s premises.',
        fontSize: 8,
        color: '#4a5568',
        margin: [0, 4, 0, 0],
      },
      { text: 'Client Responsibilities for Onsite Calibration', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: 'For onsite calibration services, the Client shall provide an environmental chamber capable of accommodating the system and maintaining a stable temperature of 35 °C ± 0.5 °C for a continuous period of at least twenty-four (24) hours.',
        fontSize: 8,
        color: '#4a5568',
      },
      { text: 'This requirement does not apply to ISGHP system calibrations.', fontSize: 8, color: '#4a5568', margin: [0, 4, 0, 0] },
      { text: 'Calibration Documentation', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      { text: 'A standard Thermetrics Calibration Certificate is included for all calibrated systems.', fontSize: 8, color: '#4a5568' },
      {
        text: 'Separate calibration certificates shall be issued for sensors identified in the applicable calibration matrix referenced below.',
        fontSize: 8,
        color: '#4a5568',
      },
      { text: 'ISO 17025 Calibration Certificates', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: 'An ISO/IEC 17025-compliant Calibration Certificate is not included as standard but may be provided upon request for select systems and at an additional cost.',
        fontSize: 8,
        color: '#4a5568',
      },
      {
        text: 'Such certification includes calibration of temperature, voltage, and resistance parameters and expressly excludes flow conductance calibration.',
        fontSize: 8,
        color: '#4a5568',
        margin: [0, 4, 0, 0],
      },
      { text: 'Scope of Calibration', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
      {
        text: 'The specific calibration activities and components included within each system calibration are defined in the applicable Thermetrics System Calibration Matrix, as referenced in the table below and incorporated into these Terms by reference.',
        fontSize: 8,
        color: '#4a5568',
        margin: [0, 0, 0, 6],
      },
      ...matrixSectionsFor(input.assetLines),
      ...termsAndConditionsSections(),
      { text: 'Please contact europe@thermetrics.com for further information and inquiries.', fontSize: 8, color: '#718096', margin: [0, 10, 0, 4] },
      { text: 'THANK YOU FOR YOUR BUSINESS', bold: true, alignment: 'center' as const, margin: [0, 10, 0, 0] },
    ],
  };

  return docDefinition;
}

export function generateQuotePdf(input: QuotePdfInput): void {
  ensureFonts();
  const docDefinition = buildQuoteDocDefinition(input);
  const filenameParts = [input.meta.quoteNumber || input.meta.caseNumber, input.clientName].filter(Boolean).join(' - ');
  pdfMake.createPdf(docDefinition).download(`Calibration Quote${filenameParts ? ` - ${filenameParts}` : ''}.pdf`);
}
