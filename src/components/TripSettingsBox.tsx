import { Box, Checkbox, Grid, GridItem, Select, Text, VStack } from '@chakra-ui/react';
import { NO_TRAVEL } from '../constants/schema';
import { CountryRate } from '../types';

interface Props {
  countries: CountryRate[];
  destination: string;
  onDestinationChange: (v: string) => void;
  travelers: number;
  onTravelersChange: (v: number) => void;
  years: number;
  onYearsChange: (v: number) => void;
  newCalibrationClient: boolean;
  onNewCalibrationClientChange: (v: boolean) => void;
}

export default function TripSettingsBox({
  countries,
  destination,
  onDestinationChange,
  travelers,
  onTravelersChange,
  years,
  onYearsChange,
  newCalibrationClient,
  onNewCalibrationClientChange,
}: Props) {
  const isInHouse = destination === NO_TRAVEL;

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Text fontSize="sm" fontWeight="bold" mb={3} color="subtleText">
        TRIP SETTINGS
      </Text>
      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
        <GridItem>
          <Text fontSize="sm" mb={1} color="subtleText">
            Destination
          </Text>
          <Select
            size="sm"
            placeholder="Select destination…"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name === NO_TRAVEL ? 'In-house (no travel)' : c.name}
              </option>
            ))}
          </Select>
        </GridItem>
        <GridItem>
          <Text fontSize="sm" mb={1} color="subtleText">
            Travelers
          </Text>
          <Select
            size="sm"
            value={travelers}
            onChange={(e) => onTravelersChange(Number(e.target.value))}
            isDisabled={isInHouse}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </GridItem>
        <GridItem>
          <Text fontSize="sm" mb={1} color="subtleText">
            Years quoted
          </Text>
          <Select size="sm" value={years} onChange={(e) => onYearsChange(Number(e.target.value))}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </GridItem>
      </Grid>
      <VStack align="start" mt={4}>
        <Checkbox
          isChecked={newCalibrationClient}
          onChange={(e) => onNewCalibrationClientChange(e.target.checked)}
        >
          New Calibration Client (client has not been calibrated by Thermetrics before)
        </Checkbox>
      </VStack>
    </Box>
  );
}
