import type { ProcessedWeatherData } from '@/lib/nwsTypes';

export interface RideScoreBreakdown {
  score: number;
  snow: number;
  quality: number;
  wind: number;
  visibility: number;
  temperature: number;
}

/**
 * Calculates a 0-100 Ride Score for snowboarders and skiers based on processed weather conditions.
 */
export function calculateRideScore(weather: ProcessedWeatherData): RideScoreBreakdown {
  // 1. Snow Score (Max 35 pts)
  // Weighs the new snow expected in the next 24 hours.
  let snowPoints = 0;
  if (weather.snow24h > 0) {
    if (weather.snow24h < 1) {
      snowPoints = 10;
    } else if (weather.snow24h < 3) {
      snowPoints = 20;
    } else if (weather.snow24h < 6) {
      snowPoints = 30;
    } else {
      snowPoints = 35; // 6"+ epic dump!
    }
  }

  // 2. Snow Quality Score (Max 20 pts)
  // Evaluates how good the snow is or will be.
  let qualityPoints = 0;
  if (weather.snow24h > 0) {
    switch (weather.snowQuality) {
      case 'Champagne Powder':
        qualityPoints = 20;
        break;
      case 'Premium Packed':
        qualityPoints = 15;
        break;
      case 'Sierra Cement':
        qualityPoints = 5;
        break;
      case 'Mashtatoes/Slush':
        qualityPoints = 2;
        break;
      case 'Ice Coast':
        qualityPoints = 0;
        break;
      default:
        qualityPoints = 10;
    }
  } else {
    // If no new snow, groomer quality is judged based on the general snowQuality classification
    switch (weather.snowQuality) {
      case 'Champagne Powder':
        qualityPoints = 12; // Nice residual dry snow
        break;
      case 'Premium Packed':
        qualityPoints = 10; // Great packed groomers
        break;
      case 'Sierra Cement':
        qualityPoints = 5;
        break;
      case 'Mashtatoes/Slush':
        qualityPoints = 2;
        break;
      case 'Ice Coast':
        qualityPoints = 0;
        break;
      default:
        qualityPoints = 8;
    }
  }

  // 3. Wind Score (Max 25 pts)
  // Lifts might go on hold or face wind buffing in high wind.
  let windPoints = 25;
  
  // Deduct for average wind speed
  if (weather.currentWindSpeed > 10) {
    const avgWindDeduction = (weather.currentWindSpeed - 10) * 0.5;
    windPoints -= Math.min(10, avgWindDeduction);
  }

  // Deduct for max wind gust
  if (weather.maxWindGust24h >= 40) {
    windPoints -= 25; // Massive lift hold risk!
  } else if (weather.maxWindGust24h >= 30) {
    windPoints -= 15;
  } else if (weather.maxWindGust24h >= 20) {
    windPoints -= 5;
  }
  
  windPoints = Math.max(0, windPoints);

  // 4. Visibility & Sky Score (Max 10 pts)
  // Low visibility or flat light affects riding experience.
  let visibilityPoints = 10;
  
  if (weather.bluebirdDay) {
    visibilityPoints = 10;
  } else {
    // Deduct based on sky cover percentage
    if (weather.currentSkyCover > 80) {
      visibilityPoints = 3; // Whiteout / overcast flat light
    } else if (weather.currentSkyCover > 50) {
      visibilityPoints = 6;
    } else if (weather.currentSkyCover > 20) {
      visibilityPoints = 8;
    } else {
      visibilityPoints = 9;
    }
  }

  // Deduct heavily if visibility is poor (e.g. fog under 3 miles / ~5000 meters)
  if (weather.currentVisibility < 5000) {
    visibilityPoints -= 4;
  }
  
  visibilityPoints = Math.max(0, visibilityPoints);

  // 5. Temperature Comfort Score (Max 10 pts)
  // Ideal riding temps are 15-28 F. Too hot melts snow, too cold risks frostbite.
  let tempPoints = 0;
  const temp = weather.currentTemp;
  
  if (temp >= 15 && temp <= 28) {
    tempPoints = 10; // Perfect winter temp
  } else if ((temp >= 5 && temp < 15) || (temp > 28 && temp <= 34)) {
    tempPoints = 8;  // A bit chilly or slightly warm
  } else if (temp > 34 && temp <= 40) {
    tempPoints = 5;  // Warm spring weather (starts to slush)
  } else if (temp >= -5 && temp < 5) {
    tempPoints = 3;  // Freezing, high layers needed
  } else {
    tempPoints = 0;  // Severe frostbite risk or extremely hot
  }

  const score = Math.round(snowPoints + qualityPoints + windPoints + visibilityPoints + tempPoints);
  
  return {
    score: Math.min(100, Math.max(0, score)),
    snow: Math.round(snowPoints),
    quality: Math.round(qualityPoints),
    wind: Math.round(windPoints),
    visibility: Math.round(visibilityPoints),
    temperature: Math.round(tempPoints)
  };
}

/**
 * Gets a descriptive label and color code for the ride score.
 */
export function getRideScoreLabel(score: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (score >= 85) {
    return {
      label: 'Epic Conditions 💎',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-400/30'
    };
  } else if (score >= 70) {
    return {
      label: 'Great 🏂',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-400/30'
    };
  } else if (score >= 50) {
    return {
      label: 'Fair Groomers 🏔️',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-400/30'
    };
  } else {
    return {
      label: 'Challenging / Ice ⚠️',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-400/30'
    };
  }
}
