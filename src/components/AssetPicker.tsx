import { useMemo } from 'react';
import { Alert, AlertIcon, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { HailerXSmall } from '../hailer/theme/icons/HailerXSmall';
import SearchableSelect from './SearchableSelect';
import AssetLineCard from './AssetLineCard';
import { MAX_ASSETS_PER_TRIP, NO_CALIBRATION_FAMILIES, PRODUCT_FAMILY_TO_RATE } from '../constants/schema';
import { AssetLine, AssetSummary } from '../types';
import { CalibrationRatesData } from '../hailer/data';

interface Props {
  availableAssets: AssetSummary[];
  lines: AssetLine[];
  onChange: (lines: AssetLine[]) => void;
  rates: CalibrationRatesData;
  travelers: number;
  isoPrice: number;
}

function mkId() {
  return `asset-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildAssetLine(asset: AssetSummary, rates: CalibrationRatesData): AssetLine {
  const rateName = PRODUCT_FAMILY_TO_RATE[asset.productFamily];
  const rate = rateName ? rates.systemsByName.get(rateName) ?? null : null;
  const calibrationBlocked = NO_CALIBRATION_FAMILIES.has(asset.productFamily);
  return {
    id: mkId(),
    asset,
    calibration: {
      enabled: !calibrationBlocked,
      iso17025: asset.iso17025,
      rate,
      manualPrice: null,
    },
    repair: {
      enabled: false,
      daysOnSite: 0,
      partsCost: 0,
      notes: '',
    },
  };
}

export default function AssetPicker({ availableAssets, lines, onChange, rates, travelers, isoPrice }: Props) {
  const usedIds = useMemo(() => new Set(lines.map((l) => l.asset._id)), [lines]);
  const options = useMemo(
    () =>
      availableAssets
        .filter((a) => !usedIds.has(a._id))
        .map((a) => ({ _id: a._id, name: a.displayName, badge: a.productFamily })),
    [availableAssets, usedIds],
  );
  const atMax = lines.length >= MAX_ASSETS_PER_TRIP;

  function handleAdd(assetId: string) {
    const asset = availableAssets.find((a) => a._id === assetId);
    if (!asset) return;
    onChange([...lines, buildAssetLine(asset, rates)]);
  }

  function handleRemove(lineId: string) {
    onChange(lines.filter((l) => l.id !== lineId));
  }

  function handleLineChange(updated: AssetLine) {
    onChange(lines.map((l) => (l.id === updated.id ? updated : l)));
  }

  return (
    <VStack align="stretch" spacing={3}>
      <Text fontSize="sm" fontWeight="bold" color="subtleText">
        ASSETS ({lines.length}/{MAX_ASSETS_PER_TRIP})
      </Text>

      {atMax ? (
        <Alert status="info" borderRadius="md" fontSize="sm">
          <AlertIcon />
          Maximum of {MAX_ASSETS_PER_TRIP} assets per trip. Additional assets need a separate trip/quote.
        </Alert>
      ) : (
        <SearchableSelect
          value={null}
          onChange={handleAdd}
          options={options}
          placeholder={
            availableAssets.length === 0 ? 'This customer has no assets on file' : 'Add an asset to this quote…'
          }
          isDisabled={availableAssets.length === 0}
        />
      )}

      {lines.length === 0 ? (
        <Text fontSize="sm" color="subtleText" textAlign="center" py={6}>
          No assets added yet.
        </Text>
      ) : (
        lines.map((line) => (
          <HStack key={line.id} align="start" spacing={2}>
            <AssetLineCard line={line} travelers={travelers} isoPrice={isoPrice} onChange={handleLineChange} />
            <IconButton
              aria-label="Remove asset"
              icon={<HailerXSmall />}
              size="sm"
              variant="ghost"
              onClick={() => handleRemove(line.id)}
            />
          </HStack>
        ))
      )}
    </VStack>
  );
}
