/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { CalendarRange, Layers, BarChart3, LineChart as LineIcon, CheckCircle, Info } from 'lucide-react';
import { ConstructionSite, DieselLog } from '../types';

interface SiteConsumptionChartProps {
  sites: ConstructionSite[];
  logs: DieselLog[];
  selectedSiteId: string;
}

const BRAND_COLORS = [
  '#E5B830', // Amber Gold
  '#138A8E', // Deep Teal
  '#1CA8AD', // Light Teal
  '#4E5B85', // Cool Slate Navy
  '#BCA153', // Sand Bronze
  '#15B581', // Forest Green
  '#8E6C88', // Muted Plum
  '#CE5D49', // Rust Terracotta
];

export default function SiteConsumptionChart({ sites, logs, selectedSiteId }: SiteConsumptionChartProps) {
  const [interval, setInterval] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // 1. Get Monday of a given date (for week grouping)
  const getWeekCommencing = (d: Date) => {
    const dt = new Date(d);
    const day = dt.getDay(); // Sunday is 0, Monday is 1, etc.
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1); // Adjust to get Monday
    const monday = new Date(dt.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  // Convert logs into formatted historical chart data points
  const chartData = useMemo(() => {
    if (logs.length === 0) return [];

    const groups: { [key: string]: { label: string; dateSort: string; total: number; [siteCode: string]: any } } = {};

    logs.forEach(log => {
      const date = new Date(log.dateTime);
      if (isNaN(date.getTime())) return;

      let key = '';
      let label = '';
      let dateSort = '';

      if (interval === 'day') {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        key = `${yyyy}-${mm}-${dd}`;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${date.getDate()} ${months[date.getMonth()]}`;
        dateSort = key;
      } else if (interval === 'week') {
        const monday = getWeekCommencing(date);
        const yyyy = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, '0');
        const dd = String(monday.getDate()).padStart(2, '0');
        key = `${yyyy}-W-${mm}-${dd}`;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `W/C ${monday.getDate()} ${months[monday.getMonth()]}`;
        dateSort = `${yyyy}-${mm}-${dd}`;
      } else if (interval === 'month') {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        key = `${yyyy}-${mm}`;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[date.getMonth()]} ${yyyy}`;
        dateSort = `${yyyy}-${mm}-01`;
      } else { // Interval year
        const yyyy = date.getFullYear();
        key = `${yyyy}`;
        label = `${yyyy}`;
        dateSort = `${yyyy}-01-01`;
      }

      if (!groups[key]) {
        groups[key] = {
          label,
          dateSort,
          total: 0,
        };
        // Pre-populate active/configured codes with 0
        sites.forEach(s => {
          groups[key][s.code] = 0;
        });
      }

      const site = sites.find(s => s.id === log.siteId);
      if (site) {
        groups[key][site.code] = (groups[key][site.code] || 0) + log.quantityLitres;
      }
      groups[key].total = (groups[key].total || 0) + log.quantityLitres;
    });

    // Convert into sorted array representation
    return Object.keys(groups)
      .map(key => ({
        key,
        ...groups[key],
      }))
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));

  }, [logs, sites, interval]);

  // Determine which site series we should map
  const activeSeriesMeta = useMemo(() => {
    if (selectedSiteId !== 'all') {
      const site = sites.find(s => s.id === selectedSiteId);
      return site ? [{ code: site.code, name: site.name, color: BRAND_COLORS[0] }] : [];
    }

    // For all sites, figure out which ones actually exist in the compiled chartData
    const activeCodes = new Set<string>();
    chartData.forEach(pt => {
      sites.forEach(s => {
        if (pt[s.code] > 0) {
          activeCodes.add(s.code);
        }
      });
    });

    return sites
      .filter(s => activeCodes.has(s.code))
      .map((s, idx) => ({
        code: s.code,
        name: s.name,
        color: BRAND_COLORS[idx % BRAND_COLORS.length]
      }));
  }, [sites, selectedSiteId, chartData]);

  // Compute a custom visual tooltip for brand rendering
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Collect entries and sort descending
      const filteredPayload = payload
        .map((p: any) => ({
          name: p.name,
          value: Number(p.value) || 0,
          color: p.color || p.stroke
        }))
        .filter((item: any) => item.value > 0)
        .sort((a: any, b: any) => b.value - a.value);

      const cumulativeTotal = filteredPayload.reduce((sum: number, p: any) => sum + p.value, 0);

      if (filteredPayload.length === 0) return null;

      return (
        <div id="recharts-custom-tooltip" className="bg-[#12192A] border border-[#232F4C] p-3.5 rounded-xl shadow-2xl text-xs font-sans text-zinc-100 min-w-[220px]">
          <p className="font-bold text-[#E5B830] border-b border-[#232F4C]/60 pb-1.5 mb-2 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] uppercase text-zinc-400 font-normal">Fuel Ledger</span>
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {filteredPayload.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-zinc-300 font-medium truncate max-w-[130px]" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-zinc-100 shrink-0">{((item && item.value) || 0).toFixed(1)} L</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#232F4C]/60 pt-2 mt-2 flex items-center justify-between font-bold text-[#138A8E]">
            <span>Total Consumption</span>
            <span className="font-mono text-zinc-100">{(cumulativeTotal || 0).toFixed(1)} L</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="site-consumption-chart-wrapper" className="bg-[#13192B] border border-[#1E273D] rounded-xl p-5 shadow-sm space-y-4">
      {/* HEADER CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#E5B830]" />
          <div>
            <h4 className="font-sans font-bold text-zinc-150 text-sm">Diesel Consumption History</h4>
            <p className="text-[10px] text-zinc-400 font-sans mt-0.5">Visual representation of logged diesel totals relative to filters</p>
          </div>
        </div>

        {/* INTERVAL BUTTONS GROUP */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selectors */}
          <div className="bg-[#161D32] border border-[#232F4C] p-1 rounded-lg flex items-center gap-1 text-[10px] font-bold tracking-tight">
            {(['day', 'week', 'month', 'year'] as const).map((t) => (
              <button
                key={t}
                type="button"
                id={`timeframe-btn-${t}`}
                onClick={() => setInterval(t)}
                className={`px-2.5 py-1 rounded transition uppercase cursor-pointer ${
                  interval === t
                    ? 'bg-[#E5B830] text-[#0C0F1D]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t === 'day' ? 'Daily' : t === 'week' ? 'Weekly' : t === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>

          {/* Chart Style Toggle */}
          <div className="bg-[#161D32] border border-[#232F4C] p-1 rounded-lg flex items-center gap-1">
            <button
              id="chart-type-bar"
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded transition cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-[#138A8E]/20 text-[#138A8E] border border-[#138A8E]/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Bar Chart display"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              id="chart-type-line"
              type="button"
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded transition cursor-pointer ${
                chartType === 'line'
                  ? 'bg-[#138A8E]/20 text-[#138A8E] border border-[#138A8E]/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Line Graph display"
            >
              <LineIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* GRAPH CONTAINER */}
      <div className="w-full">
        {chartData.length === 0 ? (
          <div className="h-[280px] bg-[#111625] rounded-xl border border-dashed border-[#1E273D] flex flex-col items-center justify-center text-center p-6">
            <CalendarRange className="h-8 w-8 text-zinc-550 mb-2 animate-pulse" />
            <p className="text-sm font-semibold text-zinc-400">No Logged Diesel Data</p>
            <p className="text-xs text-zinc-500 max-w-xs mt-1 leading-relaxed">
              Log entries inside the Agent Terminal context to populate active historical datasets.
            </p>
          </div>
        ) : (
          <div className="w-full h-[300px] mt-2 select-none">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#232F4C" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#8F9AA6" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis 
                    stroke="#8F9AA6" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val} L`}
                    dx={-4}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                  {activeSeriesMeta.length > 1 && (
                    <Legend 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, paddingTop: 12, color: '#A0AEC0' }}
                    />
                  )}
                  {activeSeriesMeta.map((series) => (
                    <Bar
                      key={series.code}
                      dataKey={series.code}
                      name={series.name}
                      fill={series.color}
                      stackId="a"
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#232F4C" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#8F9AA6" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis 
                    stroke="#8F9AA6" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val} L`}
                    dx={-4}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {activeSeriesMeta.length > 1 && (
                    <Legend 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, paddingTop: 12, color: '#A0AEC0' }}
                    />
                  )}
                  {activeSeriesMeta.map((series) => (
                    <Line
                      key={series.code}
                      type="monotone"
                      dataKey={series.code}
                      name={series.name}
                      stroke={series.color}
                      strokeWidth={2}
                      activeDot={{ r: 6 }}
                      dot={{ r: 3, strokeWidth: 1 }}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* FOOTER DESCRIPTOR BADGE */}
      {chartData.length > 0 && (
        <div className="bg-[#111625] rounded-lg p-2.5 flex items-start gap-2 border border-[#1E273D]/50 text-[10px] text-zinc-400 font-sans leading-relaxed">
          <Info className="h-3.5 w-[#E5B830] text-[#E5B830] shrink-0 mt-0.5" />
          <span>
            {selectedSiteId === 'all' 
              ? `Displaying combined fuel quantities for ${activeSeriesMeta.length} active construction project sites. Intervals stack visually to convey total load requirement.` 
              : `Showing localized diesel consumption sequence logs exclusively for project site code: "${activeSeriesMeta[0]?.code}".`}
          </span>
        </div>
      )}
    </div>
  );
}
