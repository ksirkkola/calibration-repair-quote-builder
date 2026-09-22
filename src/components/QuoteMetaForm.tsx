import { Box, Grid, Input, Text, useColorModeValue, VStack } from '@chakra-ui/react';
import { QuoteMeta } from '../types';

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Box>
      <Text fontSize="sm" mb={1} color="subtleText">
        {label}
      </Text>
      <Input size="sm" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Box>
  );
}

export default function QuoteMetaForm({ meta, onChange }: Props) {
  const set = <K extends keyof QuoteMeta>(key: K, value: QuoteMeta[K]) => onChange({ ...meta, [key]: value });
  // gray.50 stays near-white even in dark mode — swap in a readable dark
  // counterpart so the read-only field doesn't wash out the text on top of it.
  const readOnlyBg = useColorModeValue('gray.50', 'gray.700');

  return (
    <VStack align="stretch" spacing={4}>
      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Text fontSize="sm" fontWeight="bold" mb={3} color="subtleText">
          QUOTE DETAILS
        </Text>
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
          <Field label="Quote #" value={meta.quoteNumber} onChange={(v) => set('quoteNumber', v)} />
          <Box>
            <Text fontSize="sm" mb={1} color="subtleText">
              Case # (ticket code)
            </Text>
            <Input size="sm" value={meta.caseNumber} isReadOnly bg={readOnlyBg} />
          </Box>
          <Field label="Requested By" value={meta.requestedBy} onChange={(v) => set('requestedBy', v)} />
          <Field label="Date" type="date" value={meta.quoteDate} onChange={(v) => set('quoteDate', v)} />
          <Field
            label="Location of Annual Calibration"
            value={meta.locationOfAnnualCalibration}
            onChange={(v) => set('locationOfAnnualCalibration', v)}
            placeholder="Site address, if different from billing"
          />
          <Field
            label="Quote Expires"
            type="date"
            value={meta.quoteExpires}
            onChange={(v) => set('quoteExpires', v)}
          />
        </Grid>
      </Box>

      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Text fontSize="sm" fontWeight="bold" mb={3} color="subtleText">
          BILLING INFORMATION (CLIENT)
        </Text>
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
          <Field
            label="Contact Name"
            value={meta.billingContactName}
            onChange={(v) => set('billingContactName', v)}
          />
          <Field label="Email Address" value={meta.billingEmail} onChange={(v) => set('billingEmail', v)} />
          <Field label="Phone Number" value={meta.billingPhone} onChange={(v) => set('billingPhone', v)} />
          <Field label="Billing Address" value={meta.billingAddress} onChange={(v) => set('billingAddress', v)} />
        </Grid>
      </Box>
    </VStack>
  );
}
