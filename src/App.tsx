import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Heading,
  HStack,
  Link,
  Spinner,
  Text,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import type { ActivityFieldUpdateValue } from '@hailer/app-sdk';
import { useApp } from './hailer/use-app';
import { readLinkId, readLinkName } from './hailer/api-helpers';
import {
  fetchAssetsByIds,
  fetchAssetsForCompany,
  fetchCalibrationRates,
  fetchCustomerDetails,
  fetchIso17025Price,
  fetchOpenTickets,
  CalibrationRatesData,
} from './hailer/data';
import { CONTACTS, TRIPS_IHS } from './constants/schema';
import { computeQuote, DEFAULT_CONSTANTS } from './pricing';
import { QuoteStatus, restoreQuoteState, serializeQuoteState } from './quoteState';
import { createOrUpdateFutureYearTickets } from './siblingTickets';
import { AssetLine, AssetSummary, QuoteMeta, TicketSummary } from './types';
import { generateQuotePdf } from './pdf';
import TicketPicker from './components/TicketPicker';
import TripSettingsBox from './components/TripSettingsBox';
import AssetPicker, { buildAssetLine } from './components/AssetPicker';
import QuoteSummary from './components/QuoteSummary';
import QuoteMetaForm from './components/QuoteMetaForm';

declare const __APP_VERSION__: string;

const EMPTY_META: Omit<QuoteMeta, 'caseNumber'> = {
  quoteNumber: '',
  requestedBy: '',
  quoteDate: new Date().toISOString().slice(0, 10),
  locationOfAnnualCalibration: '',
  quoteExpires: '',
  newCalibrationClient: false,
  years: 1,
  destination: '',
  travelers: 1,
  billingContactName: '',
  billingEmail: '',
  billingPhone: '',
  billingAddress: '',
};

export default function App() {
  const { hailer, api, inside, ready, app, user } = useApp();

  // gray.50 reads as near-white and stays that way in dark mode too (it's not
  // theme-aware on its own) — pick a readable counterpart per color mode.
  const headerBarBg = useColorModeValue('gray.50', 'gray.700');

  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [rates, setRates] = useState<CalibrationRatesData | null>(null);
  const [isoPrice, setIsoPrice] = useState(500);

  const [assetLines, setAssetLines] = useState<AssetLine[]>([]);
  const [destination, setDestination] = useState('');
  const [travelers, setTravelers] = useState(1);
  const [years, setYears] = useState(1);
  const [newCalibrationClient, setNewCalibrationClient] = useState(false);
  // Always fetched live from the client's Customers record — never editable
  // in this app, never stored in the draft JSON.
  const [paymentTerms, setPaymentTerms] = useState('');
  const [meta, setMeta] = useState<Omit<QuoteMeta, 'caseNumber'>>(EMPTY_META);
  // Draft — same idea as the Product Configurator's Save Draft / Resume
  // Draft: a "draft" save only persists the JSON working state (nothing
  // financial is committed to the ticket yet). "Finalize" writes everything,
  // including Amount to Invoice, asset links, and the ISO 17025 roll-up flag.
  // Since this app is always ticket-scoped (no free-standing draft picker
  // needed), the draft simply lives on the same ticket's JSON field and is
  // restored automatically whenever that ticket is reselected.
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('draft');
  // Future-year sibling TRIPS/IHS tickets auto-created on Finalize for a
  // multi-year quote. Tracked so re-finalizing updates them instead of
  // creating duplicates.
  const [siblingTicketIds, setSiblingTicketIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    void api.init();
  }, [api]);

  // Rates + ISO price load once, as soon as we're inside Hailer.
  useEffect(() => {
    if (!inside || !hailer || !ready) return;
    let cancelled = false;
    Promise.all([fetchCalibrationRates(hailer, app.workflows), fetchIso17025Price(hailer)])
      .then(([r, iso]) => {
        if (cancelled) return;
        setRates(r);
        setIsoPrice(iso);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { msg?: string; message?: string };
        setLoadError(e?.msg || e?.message || String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [inside, hailer, ready, app.workflows]);

  // Open tickets load once, as soon as we're inside Hailer.
  useEffect(() => {
    if (!inside || !hailer) return;
    let cancelled = false;
    fetchOpenTickets(hailer)
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { msg?: string; message?: string };
        setLoadError(e?.msg || e?.message || String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [inside, hailer]);

  async function handleSelectTicket(ticket: TicketSummary) {
    if (!hailer || !rates) return;
    setSelectedTicket(ticket);
    setTicketLoading(true);
    setSaveNotice(null);
    try {
      const [companyAssets, fullTicket, customerDetails] = await Promise.all([
        ticket.customerId ? fetchAssetsForCompany(hailer, ticket.customerId) : Promise.resolve([]),
        hailer.activity.get(ticket._id),
        ticket.customerId ? fetchCustomerDetails(hailer, ticket.customerId) : Promise.resolve({ address: '', paymentTerms: '' }),
      ]);
      if (!fullTicket) throw new Error('Ticket could not be loaded.');
      setAssets(companyAssets);
      // Always live off the client's current record — not stored in the
      // draft JSON — so the surcharge always reflects today's payment terms,
      // even for a quote drafted before the terms changed.
      setPaymentTerms(customerDetails.paymentTerms);

      const storedJson = fullTicket.fields?.[TRIPS_IHS.fields.quoteDetailsJson] as string | undefined;
      const restored = storedJson ? await restoreQuoteState(hailer, storedJson, rates) : null;

      if (restored) {
        setAssetLines(restored.lines);
        setDestination(restored.destination);
        setTravelers(restored.travelers);
        setYears(restored.years);
        setNewCalibrationClient(restored.newCalibrationClient);
        setMeta({ ...EMPTY_META, ...restored.metaPartial });
        setQuoteStatus(restored.status);
        setSiblingTicketIds(restored.siblingTicketIds);
      } else {
        // Fresh start — seed from whatever assets are already linked to the
        // ticket (asset_1/2/3), default requester to the current user.
        const existing =
          ticket.existingAssetIds.length > 0 ? await fetchAssetsByIds(hailer, ticket.existingAssetIds) : [];
        setAssetLines(existing.map((a) => buildAssetLine(a, rates)));
        setDestination('');
        setTravelers(1);
        setYears(1);
        setNewCalibrationClient(false);
        setQuoteStatus('draft');
        setSiblingTicketIds([]);

        const contactId = readLinkId(fullTicket.fields?.[TRIPS_IHS.fields.clientContactPerson]);
        let contactPhone = '';
        let contactEmail = (fullTicket.fields?.[TRIPS_IHS.fields.clientContactEmail] as string) || '';
        let contactName = readLinkName(fullTicket.fields?.[TRIPS_IHS.fields.clientContactPerson]) || '';
        if (contactId) {
          const contact = await hailer.activity.get(contactId).catch(() => null);
          if (contact) {
            contactPhone = (contact.fields?.[CONTACTS.fields.phone] as string) || '';
            contactEmail = contactEmail || (contact.fields?.[CONTACTS.fields.email] as string) || '';
          }
        }

        setMeta({
          ...EMPTY_META,
          requestedBy: user.current ? `${user.current.firstname} ${user.current.lastname}`.trim() : '',
          billingContactName: contactName,
          billingEmail: contactEmail,
          billingPhone: contactPhone,
        });
      }

      // Billing Address and Location of Annual Calibration always go to the
      // client's own address on file — applied unconditionally here (not
      // just on a fresh ticket) so a ticket with an older saved draft still
      // picks up the company's current address, not a stale/blank value.
      // Still editable afterward for edge cases (e.g. in-house calibration
      // happens at Thermetrics' facility, not the client's).
      if (customerDetails.address) {
        setMeta((prev) => ({
          ...prev,
          billingAddress: customerDetails.address,
          locationOfAnnualCalibration: customerDetails.address,
        }));
      }
    } catch (err) {
      const e = err as { msg?: string; message?: string };
      setSaveNotice({ ok: false, message: e?.msg || e?.message || String(err) });
    } finally {
      setTicketLoading(false);
    }
  }

  const totals = useMemo(() => {
    if (!rates) return null;
    const country = destination ? rates.countries.find((c) => c.name === destination) ?? null : null;
    const constants = {
      laborPerDay: rates.constants['labor_per_day'] ?? DEFAULT_CONSTANTS.laborPerDay,
      travelLaborPerDay: rates.constants['travel_labor_per_day'] ?? DEFAULT_CONSTANTS.travelLaborPerDay,
      partsMarkup: rates.constants['parts_markup'] ?? DEFAULT_CONSTANTS.partsMarkup,
    };
    return computeQuote({
      assetLines,
      country,
      travelers,
      years,
      newCalibrationClient,
      isoPrice,
      constants,
      paymentTerms,
    });
  }, [rates, assetLines, destination, travelers, years, newCalibrationClient, isoPrice, paymentTerms]);

  const fullMeta: QuoteMeta = { ...meta, destination, travelers, years, newCalibrationClient, caseNumber: selectedTicket?.ticketCode || '' };

  // Save Draft — only persists the JSON working state to the ticket. Nothing
  // financial (Amount to Invoice, asset links, ISO roll-up, PO/quote fields)
  // is touched, so exploratory saves can't clobber a ticket's committed
  // numbers. Same motivation as the Product Configurator's Save Draft.
  async function handleSaveDraft() {
    if (!hailer || !selectedTicket) return;
    setSaving(true);
    setSaveNotice(null);
    try {
      await hailer.activity.update(
        [
          {
            _id: selectedTicket._id,
            fields: {
              [TRIPS_IHS.fields.quoteDetailsJson]: serializeQuoteState(
                assetLines,
                destination,
                travelers,
                years,
                newCalibrationClient,
                fullMeta,
                'draft',
                siblingTicketIds,
              ),
            },
          },
        ],
        {},
      );
      setQuoteStatus('draft');
      setSaveNotice({ ok: true, message: `Draft saved to ${selectedTicket.ticketCode || selectedTicket.name}.` });
    } catch (err) {
      const e = err as { msg?: string; message?: string };
      setSaveNotice({ ok: false, message: e?.msg || e?.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  // Finalize — writes everything, including the financial fields the rest of
  // the business (invoicing, PO tracking) relies on. For a multi-year quote,
  // also auto-creates (or updates, if re-finalizing) the future-year
  // scheduling tickets — one quote/price, cloned per extra year, invoiced
  // separately at time of service.
  async function handleFinalizeQuote() {
    if (!hailer || !selectedTicket || !totals) return;
    setFinalizing(true);
    setSaveNotice(null);
    try {
      const anyIso = assetLines.some((l) => l.calibration.enabled && l.calibration.iso17025);
      // Invoiced per-year at time of service, not the full multi-year total —
      // each ticket (this one + any future-year siblings) represents one
      // year's actual billable visit.
      const perYearAmount = totals.grandTotal / years;
      const quoteSummaryText = [
        ...totals.travelLines.map((l) => `${l.label}: €${(l.price * l.years).toFixed(2)}`),
        ...totals.lines.map((l) => `${l.label}: €${(l.price * l.years).toFixed(2)}`),
        ...(totals.paymentTermsSurchargeAmount > 0
          ? [
              `Payment Terms Surcharge (${totals.paymentTerms}, ${(totals.paymentTermsSurchargePct * 100).toFixed(1)}%): +€${totals.paymentTermsSurchargeAmount.toFixed(2)}`,
            ]
          : []),
        `TOTAL: €${totals.grandTotal.toFixed(2)} (${years} yr${years > 1 ? 's' : ''}, invoiced at €${perYearAmount.toFixed(2)}/yr)`,
      ].join('\n');

      let newSiblingIds = siblingTicketIds;
      if (years > 1) {
        const freshTicket = await hailer.activity.get(selectedTicket._id);
        if (freshTicket) {
          newSiblingIds = await createOrUpdateFutureYearTickets(
            hailer,
            freshTicket,
            assetLines,
            perYearAmount,
            years,
            siblingTicketIds,
          );
        }
      }

      const fields: Record<string, ActivityFieldUpdateValue> = {
        [TRIPS_IHS.fields.iso17025Calibration]: anyIso ? 'Yes' : 'No',
        [TRIPS_IHS.fields.quote]: quoteSummaryText,
        [TRIPS_IHS.fields.amountToInvoice]: perYearAmount,
        [TRIPS_IHS.fields.quoteNumber]: meta.quoteNumber,
        [TRIPS_IHS.fields.quoteExpires]: meta.quoteExpires ? new Date(meta.quoteExpires).getTime() : null,
        [TRIPS_IHS.fields.locationOfAnnualCalibration]: meta.locationOfAnnualCalibration,
        [TRIPS_IHS.fields.newCalibrationClient]: newCalibrationClient ? 'Yes' : 'No',
        [TRIPS_IHS.fields.yearsQuoted]: years,
        [TRIPS_IHS.fields.quoteDetailsJson]: serializeQuoteState(
          assetLines,
          destination,
          travelers,
          years,
          newCalibrationClient,
          fullMeta,
          'final',
          newSiblingIds,
        ),
      };
      // Fill asset_1/2/3 with whatever assets are on this quote (up to 3).
      const assetFieldIds = [TRIPS_IHS.fields.asset1, TRIPS_IHS.fields.asset2, TRIPS_IHS.fields.asset3];
      assetFieldIds.forEach((fid, i) => {
        fields[fid] = assetLines[i] ? assetLines[i].asset._id : null;
      });

      await hailer.activity.update([{ _id: selectedTicket._id, fields }], {});
      setQuoteStatus('final');
      setSiblingTicketIds(newSiblingIds);
      const siblingNote = newSiblingIds.length > 0 ? ` Created/updated ${newSiblingIds.length} future-year ticket(s).` : '';
      setSaveNotice({ ok: true, message: `Quote finalized on ${selectedTicket.ticketCode || selectedTicket.name}.${siblingNote}` });
    } catch (err) {
      const e = err as { msg?: string; message?: string };
      setSaveNotice({ ok: false, message: e?.msg || e?.message || String(err) });
    } finally {
      setFinalizing(false);
    }
  }

  function handleDownloadPdf() {
    if (!totals || !selectedTicket) return;
    generateQuotePdf({
      totals,
      meta: fullMeta,
      clientName: selectedTicket.customerName || selectedTicket.companyFallback || selectedTicket.name,
      assetLines,
    });
  }

  if (inside === null) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="subtleText">
          Connecting to Hailer…
        </Heading>
      </Box>
    );
  }

  if (inside === false) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="subtleText" mb={2}>
          You are outside of Hailer
        </Heading>
        <Text>
          This app must be loaded inside Hailer — see{' '}
          <Link href="https://www.npmjs.com/package/@hailer/create-app">@hailer/create-app</Link> for details.
        </Text>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="red.400" mb={2}>
          Failed to load
        </Heading>
        <Text>{loadError}</Text>
      </Box>
    );
  }

  if (!hailer || tickets === null || rates === null) {
    return (
      <HStack margin="2em">
        <Spinner size="sm" />
        <Text color="subtleText">Loading…</Text>
      </HStack>
    );
  }

  return (
    <Container maxW="container.lg" py={6}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Calibration &amp; Repair Quotes</Heading>
        {selectedTicket && (
          <Button size="sm" variant="ghost" onClick={() => setSelectedTicket(null)}>
            ← Back to ticket list
          </Button>
        )}
      </HStack>

      {!selectedTicket ? (
        <TicketPicker tickets={tickets} onSelect={handleSelectTicket} />
      ) : ticketLoading ? (
        <HStack margin="2em">
          <Spinner size="sm" />
          <Text color="subtleText">Loading ticket…</Text>
        </HStack>
      ) : (
        <VStack align="stretch" spacing={5}>
          <Box borderWidth="1px" borderRadius="md" p={3} bg={headerBarBg}>
            <HStack justify="space-between">
              <Text fontSize="sm">
                <b>{selectedTicket.name}</b> — {selectedTicket.ticketCode || 'no ticket code'} —{' '}
                {selectedTicket.customerName || selectedTicket.companyFallback || 'no customer linked'}
              </Text>
              <Badge colorScheme={quoteStatus === 'final' ? 'green' : 'blue'}>
                {quoteStatus === 'final' ? 'Finalized' : 'Draft'}
              </Badge>
            </HStack>
          </Box>

          {saveNotice && (
            <Alert status={saveNotice.ok ? 'success' : 'error'} borderRadius="md">
              <AlertIcon />
              {saveNotice.message}
            </Alert>
          )}

          <QuoteMetaForm meta={fullMeta} onChange={(m) => setMeta(m)} />

          <Divider />

          <TripSettingsBox
            countries={rates.countries}
            destination={destination}
            onDestinationChange={setDestination}
            travelers={travelers}
            onTravelersChange={setTravelers}
            years={years}
            onYearsChange={setYears}
            newCalibrationClient={newCalibrationClient}
            onNewCalibrationClientChange={setNewCalibrationClient}
          />

          <AssetPicker
            availableAssets={assets}
            lines={assetLines}
            onChange={setAssetLines}
            rates={rates}
            travelers={travelers}
            isoPrice={isoPrice}
          />

          {totals && <QuoteSummary totals={totals} />}

          <HStack justify="flex-end" spacing={3}>
            <Button variant="outline" onClick={handleDownloadPdf} isDisabled={!totals || totals.lines.length === 0}>
              Download PDF
            </Button>
            <Button colorScheme="blue" variant="outline" onClick={handleSaveDraft} isLoading={saving}>
              Save Draft
            </Button>
            <Button
              colorScheme="green"
              onClick={handleFinalizeQuote}
              isLoading={finalizing}
              isDisabled={!totals || totals.lines.length === 0}
            >
              Finalize Quote
            </Button>
          </HStack>
        </VStack>
      )}

      <Text fontSize="xs" color="gray.400" position="fixed" bottom={1} right={2} className="no-print">
        v{__APP_VERSION__}
      </Text>
    </Container>
  );
}
