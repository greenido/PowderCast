'use client';

import { BeakerIcon } from '@heroicons/react/24/solid';

interface HumidityCardProps {
  humidity: number;
  dewpoint: number;
  temperature: number;
}

export default function HumidityCard({ humidity, dewpoint, temperature }: HumidityCardProps) {
  const humidityLevel = humidity > 70 ? 'high' : humidity > 40 ? 'moderate' : 'low';
  const humidityColor = 
    humidityLevel === 'high' ? 'text-blue-400' :
    humidityLevel === 'moderate' ? 'text-cyan-400' :
    'text-gray-400';

  // Calculate dew point spread (temp - dewpoint) - important for snow quality
  const dewpointSpread = temperature - dewpoint;
  const spreadInfo = 
    dewpointSpread < 5 ? 'Very humid, potential fog' :
    dewpointSpread < 10 ? 'Humid conditions' :
    dewpointSpread < 20 ? 'Moderate moisture' :
    'Dry conditions';

  return (
    <div className="glass-card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`p-2 sm:p-3 rounded-xl ${
          humidityLevel === 'high' ? 'bg-blue-400/20' :
          humidityLevel === 'moderate' ? 'bg-cyan-400/20' :
          'bg-gray-400/20'
        }`}>
          <BeakerIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${humidityColor}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="metric-label mb-2">Humidity & Moisture</div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div>
              <div className={`metric-large ${humidityColor}`}>
                {Math.round(humidity)}%
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 capitalize">
                {humidityLevel} Humidity
              </div>
            </div>
            
            <div>
              <div className="metric-large text-cyan-300">
                {Math.round(dewpoint)}°F
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">Dewpoint</div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-300">
            <span className="text-cyan-400 font-semibold">Δ{Math.round(dewpointSpread)}°</span> spread • {spreadInfo}
          </div>
        </div>
      </div>
    </div>
  );
}
