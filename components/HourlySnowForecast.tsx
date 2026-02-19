import type { HourlySnowData } from '@/lib/nwsTypes';

interface HourlySnowForecastProps {
  hourlyData: HourlySnowData[];
}

export default function HourlySnowForecast({ hourlyData }: HourlySnowForecastProps) {
  // Filter to show only hours with snowfall
  const snowHours = hourlyData.filter(h => h.snowfall > 0);
  
  if (snowHours.length === 0) {
    return (
      <div className="glass-card">
        <h3 className="metric-label mb-4">Hourly Snow Forecast (48h)</h3>
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-3">🌤️</div>
          <p>No snowfall expected in the next 48 hours</p>
        </div>
      </div>
    );
  }

  // Get max snowfall for scaling the bars
  const maxSnowfall = Math.max(...snowHours.map(h => h.snowfall));

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="metric-label">Hourly Snow Forecast</h3>
        <span className="text-xs sm:text-sm text-gray-400">Next 48 hours</span>
      </div>
      
      {/* Scrollable container */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 sm:gap-3 min-w-max">
          {snowHours.map((hour, index) => {
            const barHeight = (hour.snowfall / maxSnowfall) * 100;
            const date = new Date(hour.time);
            const timeLabel = date.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              hour12: true 
            });
            const dateLabel = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });
            
            // Determine quality color
            let qualityColor = 'from-blue-400 to-cyan-400';
            if (hour.snowQuality === 'Champagne Powder') {
              qualityColor = 'from-purple-400 to-pink-400';
            } else if (hour.snowQuality === 'Premium Packed') {
              qualityColor = 'from-blue-400 to-cyan-400';
            } else if (hour.snowQuality === 'Sierra Cement') {
              qualityColor = 'from-yellow-400 to-orange-400';
            } else if (hour.snowQuality.includes('Slush')) {
              qualityColor = 'from-orange-400 to-red-400';
            }

            return (
              <div 
                key={index}
                className="flex flex-col items-center min-w-[70px] sm:min-w-[80px] p-2 sm:p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
              >
                {/* Snowfall amount */}
                <div className="text-base sm:text-lg font-bold text-cyan-400 mb-1">
                  {hour.snowfall.toFixed(1)}&quot;
                </div>
                
                {/* Visual bar */}
                <div className="w-full h-24 sm:h-32 bg-white/5 rounded-md overflow-hidden flex flex-col justify-end mb-2">
                  <div 
                    className={`w-full bg-gradient-to-t ${qualityColor} rounded-t-md transition-all duration-500`}
                    style={{ height: `${barHeight}%` }}
                  ></div>
                </div>
                
                {/* Time */}
                <div className="text-xs sm:text-sm font-semibold text-white mb-1">
                  {timeLabel}
                </div>
                
                {/* Date */}
                <div className="text-xs text-gray-400 mb-2">
                  {dateLabel}
                </div>
                
                {/* Temperature */}
                <div className="text-xs text-gray-300 mb-1">
                  {hour.temperature}°F
                </div>
                
                {/* Wind speed */}
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span>💨</span>
                  <span>{hour.windSpeed} mph</span>
                </div>
                
                {/* Snow quality indicator */}
                <div className="mt-2 text-center">
                  <div className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${qualityColor} text-white font-semibold`}>
                    {hour.snowQuality === 'Champagne Powder' && '💎'}
                    {hour.snowQuality === 'Premium Packed' && '❄️'}
                    {hour.snowQuality === 'Sierra Cement' && '⚠️'}
                    {hour.snowQuality.includes('Slush') && '💦'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"></div>
            <span className="text-gray-400">💎 Champagne</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"></div>
            <span className="text-gray-400">❄️ Packed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400"></div>
            <span className="text-gray-400">⚠️ Cement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-red-400"></div>
            <span className="text-gray-400">💦 Slush</span>
          </div>
        </div>
      </div>
    </div>
  );
}
