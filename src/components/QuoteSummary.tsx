import { Box, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { formatMoney } from '../hailer/api-helpers';
import { QuoteTotals } from '../types';

interface Props {
  totals: QuoteTotals;
}

export default function QuoteSummary({ totals }: Props) {
  const {
    lines,
    travelLines,
    subtotal,
    discounts,
    totalDiscount,
    grandTotal,
    years,
    paymentTerms,
    paymentTermsSurchargePct,
    paymentTermsSurchargeAmount,
  } = totals;

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Text fontSize="sm" fontWeight="bold" mb={3} color="subtleText">
        QUOTE SUMMARY
      </Text>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Line Item</Th>
            <Th isNumeric>Price</Th>
          </Tr>
        </Thead>
        <Tbody>
          {travelLines.map((l, i) => (
            <Tr key={`travel-${i}`}>
              <Td>{l.label}</Td>
              <Td isNumeric>{formatMoney(l.price * l.years)}</Td>
            </Tr>
          ))}
          {lines.length === 0 && travelLines.length === 0 && (
            <Tr>
              <Td colSpan={2}>
                <Text color="subtleText" fontSize="sm">
                  Add at least one asset to build the quote.
                </Text>
              </Td>
            </Tr>
          )}
          {lines.map((l, i) => (
            <Tr key={i}>
              <Td>
                {l.label}
                {l.years > 1 && (
                  <Text as="span" color="subtleText" fontSize="xs">
                    {' '}
                    (× {l.years} yrs)
                  </Text>
                )}
              </Td>
              <Td isNumeric>{formatMoney(l.price * l.years)}</Td>
            </Tr>
          ))}
          <Tr fontWeight="bold" borderTopWidth="2px">
            <Td>Subtotal</Td>
            <Td isNumeric>{formatMoney(subtotal)}</Td>
          </Tr>
          {discounts.newClientFinal > 0 && (
            <Tr color="orange.600">
              <Td>New Calibration Client Discount</Td>
              <Td isNumeric>-{formatMoney(discounts.newClientFinal)}</Td>
            </Tr>
          )}
          {discounts.multiUnitFinal > 0 && (
            <Tr color="orange.600">
              <Td>Multi-Unit Discount</Td>
              <Td isNumeric>-{formatMoney(discounts.multiUnitFinal)}</Td>
            </Tr>
          )}
          {discounts.multiYearFinal > 0 && (
            <Tr color="orange.600">
              <Td>Multi-Year Discount</Td>
              <Td isNumeric>-{formatMoney(discounts.multiYearFinal)}</Td>
            </Tr>
          )}
          {discounts.scaled && (
            <Tr>
              <Td colSpan={2}>
                <Text fontSize="xs" color="subtleText" fontStyle="italic">
                  Combined discounts scaled down to stay within the 10% cap.
                </Text>
              </Td>
            </Tr>
          )}
          <Tr fontWeight="bold" borderTopWidth="2px">
            <Td>Annual Subtotal</Td>
            <Td isNumeric>{formatMoney(subtotal - totalDiscount)}</Td>
          </Tr>
          <Tr>
            <Td color="subtleText"># of Years</Td>
            <Td isNumeric>{years}</Td>
          </Tr>
          <Tr>
            <Td colSpan={2}>
              <Text fontSize="xs" color="subtleText" fontStyle="italic">
                {paymentTermsSurchargeAmount > 0
                  ? `Payment Terms: ${paymentTerms} — a ${(paymentTermsSurchargePct * 100).toFixed(1)}% surcharge (${formatMoney(paymentTermsSurchargeAmount)}) is already included in every price above, not added separately.`
                  : `Payment Terms: ${paymentTerms} (no surcharge)`}
              </Text>
            </Td>
          </Tr>
          <Tr fontWeight="extrabold" fontSize="lg" borderTopWidth="2px" borderColor="green.500">
            <Td>TOTAL</Td>
            <Td isNumeric color="green.600">
              {formatMoney(grandTotal)}
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </Box>
  );
}
