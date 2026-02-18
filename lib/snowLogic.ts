// Snow quality and rider intelligence logic

export type SnowQuality = 
  | 'Champagne Powder' 
  | 'Premium Packed' 
  | 'Sierra Cement' 
  | 'Mashtatoes/Slush'
  | 'Ice Coast';

/**
 * Determine snow quality based on temperature during precipitation
 */
export function determineSnowQuality(tempF: number): SnowQuality {
  if (tempF < 15) {
    return 'Champagne Powder';
  } else if (tempF >= 15 && tempF <= 26) {
    return 'Premium Packed';
  } else if (tempF >= 27 && tempF <= 34) {
    return 'Sierra Cement';
  } else {
    return 'Mashtatoes/Slush';
  }
}

/**
 * Check if conditions indicate ice coast conditions
 * (freeze-thaw cycles, rain then freeze)
 */
export function isIceCoast(tempF: number, recentHighTemp: number): boolean {
  // If temp is below freezing but recent high was above freezing
  return tempF < 32 && recentHighTemp > 33;
}

/**
 * Check if there's a powder alert (6"+ in 24 hours)
 */
export function isPowderAlert(snow24h: number): boolean {
  return snow24h >= 6;
}

/**
 * Check if conditions are "bluebird"
 * (<25% cloud cover + wind < 15 mph)
 */
export function isBluebirdDay(cloudCover: number, windSpeed: number): boolean {
  return cloudCover < 25 && windSpeed < 15;
}

/**
 * Check for frostbite risk (wind chill < -20°F)
 */
export function hasFrostbiteRisk(windChillF: number): boolean {
  return windChillF < -20;
}

/**
 * Check for wind hold risk (gusts > 40 mph)
 */
export function hasWindHoldRisk(windGustMph: number): boolean {
  return windGustMph >= 40;
}

/**
 * Get frostbite warning level and message
 */
export function getFrostbiteWarning(windChillF: number): {
  level: 'none' | 'caution' | 'danger' | 'extreme';
  message: string;
} {
  if (windChillF >= -20) {
    return { level: 'none', message: '' };
  } else if (windChillF >= -35) {
    return {
      level: 'caution',
      message: 'Frostbite possible in 30 minutes. Cover exposed skin.',
    };
  } else if (windChillF >= -50) {
    return {
      level: 'danger',
      message: 'Frostbite likely in 10 minutes. Minimize exposure.',
    };
  } else {
    return {
      level: 'extreme',
      message: 'EXTREME: Frostbite in 5 minutes. Life-threatening conditions.',
    };
  }
}

/**
 * Get wind hold warning level
 */
export function getWindHoldWarning(windGustMph: number): {
  level: 'none' | 'moderate' | 'high' | 'extreme';
  message: string;
} {
  if (windGustMph < 30) {
    return { level: 'none', message: '' };
  } else if (windGustMph < 40) {
    return {
      level: 'moderate',
      message: 'Gusty conditions. Some lifts may experience delays.',
    };
  } else if (windGustMph < 50) {
    return {
      level: 'high',
      message: 'High winds. Expect lift closures on exposed chairs.',
    };
  } else {
    return {
      level: 'extreme',
      message: 'EXTREME WINDS: Multiple lift closures likely.',
    };
  }
}

/**
 * Get snow quality description and icon
 */
export function getSnowQualityInfo(quality: SnowQuality): {
  description: string;
  emoji: string;
  color: string;
} {
  switch (quality) {
    case 'Champagne Powder':
      return {
        description: 'Ultra light and dry. Perfect face shots!',
        emoji: '❄️',
        color: 'text-cyan-400',
      };
    case 'Premium Packed':
      return {
        description: 'Classic powder conditions. Great all-mountain riding.',
        emoji: '🏂',
        color: 'text-blue-400',
      };
    case 'Sierra Cement':
      return {
        description: 'Heavy and wet. Ideal for jumps and park features.',
        emoji: '💪',
        color: 'text-orange-400',
      };
    case 'Mashtatoes/Slush':
      return {
        description: 'Spring conditions. Stay loose and have fun!',
        emoji: '☀️',
        color: 'text-yellow-400',
      };
    case 'Ice Coast':
      return {
        description: 'Variable conditions. Sharp edges recommended.',
        emoji: '🧊',
        color: 'text-gray-400',
      };
  }
}

/**
 * Calculate average temperature during precipitation window
 */
export function getPrecipitationTemp(
  temps: Array<{ time: string; value: number }>,
  precipTimes: Array<{ start: string; end: string }>
): number | null {
  if (precipTimes.length === 0) return null;
  
  const precipTemps: number[] = [];
  
  for (const precip of precipTimes) {
    for (const temp of temps) {
      const tempTime = new Date(temp.time);
      const precipStart = new Date(precip.start);
      const precipEnd = new Date(precip.end);
      
      if (tempTime >= precipStart && tempTime <= precipEnd) {
        precipTemps.push(temp.value);
      }
    }
  }
  
  if (precipTemps.length === 0) return null;
  
  return precipTemps.reduce((a, b) => a + b, 0) / precipTemps.length;
}
