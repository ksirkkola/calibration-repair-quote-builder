import { useMemo, useState } from 'react';
import { Badge, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { TicketSummary } from '../types';

interface Props {
  tickets: TicketSummary[];
  onSelect: (ticket: TicketSummary) => void;
}

export default function TicketPicker({ tickets, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.ticketCode.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.companyFallback.toLowerCase().includes(q),
    );
  }, [tickets, search]);

  return (
    <VStack align="stretch" spacing={3}>
      <Input
        placeholder="Search by ticket code, name, or customer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <Text fontSize="sm" color="subtleText" textAlign="center" py={8}>
          {tickets.length === 0
            ? 'No open Calibration or Repair tickets found. Create one in TRIPS / IHS first.'
            : 'No tickets match your search.'}
        </Text>
      ) : (
        <VStack align="stretch" spacing={1} maxH="480px" overflowY="auto">
          {filtered.map((t) => (
            <HStack
              key={t._id}
              as="button"
              type="button"
              onClick={() => onSelect(t)}
              justify="space-between"
              p={3}
              borderWidth="1px"
              borderRadius="md"
              _hover={{ bg: 'gray.50', borderColor: 'green.300' }}
              textAlign="left"
            >
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold" fontSize="sm">
                  {t.name}
                </Text>
                <Text fontSize="xs" color="subtleText">
                  {t.customerName || t.companyFallback || 'No customer linked'}
                </Text>
              </VStack>
              <VStack align="end" spacing={0}>
                <Badge colorScheme={t.serviceType === 'Calibration' ? 'blue' : 'orange'}>
                  {t.serviceType || 'Unspecified'}
                </Badge>
                <Text fontSize="xs" color="subtleText">
                  {t.ticketCode || '—'}
                </Text>
              </VStack>
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
