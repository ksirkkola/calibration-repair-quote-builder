import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Checkbox,
  Grid,
  GridItem,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Text,
  VStack,
} from '@chakra-ui/react';
import { formatMoney } from '../hailer/api-helpers';
import { NO_CALIBRATION_FAMILIES } from '../constants/schema';
import { calibrationUnitPrice, repairUnitPrice, DEFAULT_CONSTANTS } from '../pricing';
import { AssetLine } from '../types';

interface Props {
  line: AssetLine;
  travelers: number;
  isoPrice: number;
  onChange: (line: AssetLine) => void;
}

export default function AssetLineCard({ line, travelers, isoPrice, onChange }: Props) {
  const { asset, calibration, repair } = line;
  const calibrationBlocked = NO_CALIBRATION_FAMILIES.has(asset.productFamily);

  const calPreview = calibration.rate
    ? calibrationUnitPrice(calibration.rate.daysOnSite, calibration.rate.partsCost, travelers, DEFAULT_CONSTANTS)
    : null;
  const repairPreview = repairUnitPrice(repair.daysOnSite, repair.partsCost, travelers, DEFAULT_CONSTANTS);

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <HStack justify="space-between" mb={3}>
        <VStack align="start" spacing={0}>
          <Text fontWeight="bold">{asset.displayName}</Text>
          <Text fontSize="xs" color="subtleText">
            Product family: {asset.productFamily || '—'}
          </Text>
        </VStack>
        {asset.calibrationDue && (
          <Badge colorScheme="purple">Cal. due {new Date(asset.calibrationDue).toLocaleDateString()}</Badge>
        )}
      </HStack>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        {/* Calibration column */}
        <GridItem>
          <VStack align="stretch" spacing={2}>
            <Checkbox
              isChecked={calibration.enabled}
              isDisabled={calibrationBlocked}
              onChange={(e) => onChange({ ...line, calibration: { ...calibration, enabled: e.target.checked } })}
            >
              Needs Calibration
            </Checkbox>
            {calibrationBlocked && (
              <Alert status="info" fontSize="xs" borderRadius="md" py={1}>
                <AlertIcon boxSize={3} />
                Client self-calibrates this system — not offered here.
              </Alert>
            )}
            {calibration.enabled && !calibrationBlocked && (
              <VStack align="stretch" spacing={2} pl={6}>
                {calibration.rate ? (
                  <Text fontSize="sm" color="subtleText">
                    Rate: {calibration.rate.displayName} — {calibration.rate.daysOnSite}d on-site,{' '}
                    {formatMoney(calibration.rate.partsCost)} parts
                    {calPreview && (
                      <>
                        {' '}
                        → <b>{formatMoney(calPreview.price)}</b> / yr
                      </>
                    )}
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={1}>
                    <Alert status="warning" fontSize="xs" borderRadius="md" py={1}>
                      <AlertIcon boxSize={3} />
                      No calibration rate on file for this family — enter a price manually.
                    </Alert>
                    <NumberInput
                      size="sm"
                      min={0}
                      value={calibration.manualPrice ?? ''}
                      onChange={(v) =>
                        onChange({
                          ...line,
                          calibration: { ...calibration, manualPrice: v === '' ? null : Number(v) },
                        })
                      }
                    >
                      <NumberInputField placeholder="Manual price / yr (€)" />
                    </NumberInput>
                  </VStack>
                )}
                <Checkbox
                  size="sm"
                  isChecked={calibration.iso17025}
                  onChange={(e) =>
                    onChange({ ...line, calibration: { ...calibration, iso17025: e.target.checked } })
                  }
                >
                  ISO 17025 Calibration (+{formatMoney(isoPrice)}/yr)
                </Checkbox>
              </VStack>
            )}
          </VStack>
        </GridItem>

        {/* Repair column */}
        <GridItem>
          <VStack align="stretch" spacing={2}>
            <Checkbox
              isChecked={repair.enabled}
              onChange={(e) => onChange({ ...line, repair: { ...repair, enabled: e.target.checked } })}
            >
              Needs Repair
            </Checkbox>
            {repair.enabled && (
              <VStack align="stretch" spacing={2} pl={6}>
                <HStack>
                  <Text fontSize="sm" minW="90px">
                    Days on-site
                  </Text>
                  <NumberInput
                    size="sm"
                    min={0}
                    value={repair.daysOnSite}
                    onChange={(v) => onChange({ ...line, repair: { ...repair, daysOnSite: Number(v) || 0 } })}
                  >
                    <NumberInputField />
                  </NumberInput>
                </HStack>
                <HStack>
                  <Text fontSize="sm" minW="90px">
                    Parts cost
                  </Text>
                  <NumberInput
                    size="sm"
                    min={0}
                    value={repair.partsCost}
                    onChange={(v) => onChange({ ...line, repair: { ...repair, partsCost: Number(v) || 0 } })}
                  >
                    <NumberInputField placeholder="€ cost (before markup)" />
                  </NumberInput>
                </HStack>
                <Input
                  size="sm"
                  placeholder="Repair notes (what's broken)"
                  value={repair.notes}
                  onChange={(e) => onChange({ ...line, repair: { ...repair, notes: e.target.value } })}
                />
                <Text fontSize="sm" color="subtleText">
                  → <b>{formatMoney(repairPreview.price)}</b> one-time (70% parts markup)
                </Text>
              </VStack>
            )}
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
}
