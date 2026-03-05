'use client';

import PowderAlert from '@/components/PowderAlert';
import BluebirdIndicator from '@/components/BluebirdIndicator';
import FrostbiteWarning from '@/components/FrostbiteWarning';

interface AlertsSectionProps {
  snow24h: number;
  bluebirdDay: boolean;
  currentSkyCover: number;
  currentWindSpeed: number;
  currentTemp: number;
}

export default function AlertsSection({
  snow24h,
  bluebirdDay,
  currentSkyCover,
  currentWindSpeed,
  currentTemp,
}: AlertsSectionProps) {
  return (
    <div className="space-y-4">
      <PowderAlert snow24h={snow24h} />
      <BluebirdIndicator
        isBluebird={bluebirdDay}
        skyCover={currentSkyCover}
        windSpeed={currentWindSpeed}
      />
      <FrostbiteWarning
        temperature={currentTemp}
        windSpeed={currentWindSpeed}
      />
    </div>
  );
}
