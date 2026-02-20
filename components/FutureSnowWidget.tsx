import type { HourlySnowData } from '@/lib/nwsTypes';

interface FutureSnowWidgetProps {
  hourlyData: HourlySnowData[];
}

interface DailySnowSummary {
  date: string;
  dayName: string;
  totalSnowfall: number;
  avgTemperature: number;
  maxWindSpeed: number;
  snowQuality: string;
  hours: HourlySnowData[];
}

export default function FutureSnowWidget({ hourlyData }: FutureSnowWidgetProps) {
  // Group hourly data by day
  const dailySummaries = groupByDay(hourlyData);
  
  // Calculate total forecast snowfall
  const totalForecastSnow = hourlyData.reduce((sum, hour) => sum + hour.snowfall, 0);
  
  if (dailySummaries.length === 0 || totalForecastSnow === 0) {
    return (
      <div className="glass-card">
        <h3 className="metric-label mb-4">Future Snow Forecast</h3>
        <div className="text-center py-8 text-gray-400">
          <div className="text-5xl mb-3">☀️</div>
          <p className="text-lg">No significant snowfall expected</p>
          <p className="text-sm mt-2">Check back later for updates</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="metric-label">⛷️ Future Snow Forecast</h3>
        <div className="text-right">
          <div className="text-xs text-gray-400">Total Expected</div>
          <div className="text-2xl font-bold text-cyan-400">
            {totalForecastSnow.toFixed(1)}&quot;
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {dailySummaries.map((day, index) => {
          // Determine quality color
          let qualityColor = 'from-blue-400 to-cyan-400';
          let qualityBg = 'bg-blue-500/20';
          let qualityBorder = 'border-blue-400/30';
          
          if (day.snowQuality === 'Champagne Powder') {
            qualityColor = 'from-purple-400 to-pink-400';
            qualityBg = 'bg-purple-500/20';
            qualityBorder = 'border-purple-400/30';
          } else if (day.snowQuality === 'Sierra Cement') {
            qualityColor = 'from-yellow-400 to-orange-400';
            qualityBg = 'bg-yellow-500/20';
            qualityBorder = 'border-yellow-400/30';
          } else if (day.snowQuality.includes('Slush')) {
            qualityColor = 'from-orange-400 to-red-400';
            qualityBg = 'bg-orange-500/20';
            qualityBorder = 'border-orange-400/30';
          }

          return (
            <div
              key={index}
              className={`${qualityBg} border ${qualityBorder} rounded-lg p-4 hover:scale-[1.02] transition-transform`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="font-bold text-lg text-white mb-1">
                    {day.dayName}
                  </div>
                  <div className="text-sm text-gray-400">
                    {day.date}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-3xl font-bold bg-gradient-to-r ${qualityColor} bg-clip-text text-transparent`}>
                    {day.totalSnowfall.toFixed(1)}&quot;
                  </div>
                  <div className="text-xs text-gray-400">Expected</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-1">Avg Temp</div>
                  <div className="font-semibold text-white">
                    {Math.round(day.avgTemperature)}°F
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-1">Max Wind</div>
                  <div className="font-semibold text-white">
                    {Math.round(day.maxWindSpeed)} mph
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-1">Quality</div>
                  <div className="font-semibold text-white text-xs">
                    {getQualityEmoji(day.snowQuality)} {getShortQuality(day.snowQuality)}
                  </div>
                </div>
              </div>
              
              {/* Snow distribution mini-chart */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-end gap-1 h-12">
                  {day.hours.map((hour, hourIndex) => {
                    const maxDaySnow = Math.max(...day.hours.map(h => h.snowfall));
                    const barHeight = maxDaySnow > 0 ? (hour.snowfall / maxDaySnow) * 100 : 0;
                    
                    return (
                      <div
                        key={hourIndex}
                        className="flex-1 group relative"
                        style={{ minWidth: '8px' }}
                      >
                        <div className="flex flex-col items-center justify-end h-full">
                          <div
                            className={`w-full bg-gradient-to-t ${qualityColor} rounded-t-sm transition-all`}
                            style={{ height: `${barHeight}%` }}
                          >
                            {/* Tooltip on hover */}
                            <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-white/20 rounded text-xs whitespace-nowrap z-10">
                              {new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}: {hour.snowfall.toFixed(1)}&quot;
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  Hourly distribution
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Summary footer */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-400">
            📊 {dailySummaries.length} day{dailySummaries.length > 1 ? 's' : ''} with snow
          </div>
          <div className="text-gray-400">
            Updated: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
        </div>
      </div>
    </div>
  );
}

function groupByDay(hourlyData: HourlySnowData[]): DailySnowSummary[] {
  const dayMap = new Map<string, HourlySnowData[]>();
  
  // Group hours by day
  hourlyData.forEach(hour => {
    const date = new Date(hour.time);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }
    dayMap.get(dayKey)!.push(hour);
  });
  
  // Create daily summaries
  const summaries: DailySnowSummary[] = [];
  
  dayMap.forEach((hours, dateKey) => {
    const totalSnowfall = hours.reduce((sum, h) => sum + h.snowfall, 0);
    
    // Only include days with snowfall
    if (totalSnowfall > 0) {
      const date = new Date(dateKey);
      const dayName = getDayName(date);
      const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const avgTemperature = hours.reduce((sum, h) => sum + h.temperature, 0) / hours.length;
      const maxWindSpeed = Math.max(...hours.map(h => h.windSpeed));
      
      // Determine predominant snow quality
      const qualityCount = new Map<string, number>();
      hours.forEach(h => {
        qualityCount.set(h.snowQuality, (qualityCount.get(h.snowQuality) || 0) + 1);
      });
      
      let snowQuality = 'Premium Packed';
      let maxCount = 0;
      qualityCount.forEach((count, quality) => {
        if (count > maxCount) {
          maxCount = count;
          snowQuality = quality;
        }
      });
      
      summaries.push({
        date: dateFormatted,
        dayName,
        totalSnowfall,
        avgTemperature,
        maxWindSpeed,
        snowQuality,
        hours,
      });
    }
  });
  
  return summaries;
}

function getDayName(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = date.toDateString();
  const todayStr = today.toDateString();
  const tomorrowStr = tomorrow.toDateString();
  
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function getQualityEmoji(quality: string): string {
  if (quality === 'Champagne Powder') return '💎';
  if (quality === 'Premium Packed') return '❄️';
  if (quality === 'Sierra Cement') return '⚠️';
  if (quality.includes('Slush')) return '💦';
  return '❄️';
}

function getShortQuality(quality: string): string {
  if (quality === 'Champagne Powder') return 'Powder';
  if (quality === 'Premium Packed') return 'Packed';
  if (quality === 'Sierra Cement') return 'Cement';
  if (quality.includes('Slush')) return 'Slush';
  return quality;
}
