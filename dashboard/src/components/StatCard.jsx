import React, { useEffect, useState } from 'react';

export function StatCard({
  title,
  value,
  unit = '',
  icon: Icon,
  trend,
  color = 'indigo',
  sparklineData = [4, 6, 8, 5, 9, 7, 12, 10, 14],
}) {
  const [displayValue, setDisplayValue] = useState(0);

  // Animated count-up effect
  useEffect(() => {
    let start = 0;
    const end = typeof value === 'number' ? value : parseFloat(value) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 800; // ms
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start * 10) / 10);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  const colorStyles = {
    indigo: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-400',
      border: 'border-indigo-500/20',
      stroke: '#6366f1',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      stroke: '#10b981',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      stroke: '#f59e0b',
    },
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/20',
      stroke: '#f43f5e',
    },
  }[color] || {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    stroke: '#6366f1',
  };

  // Generate SVG path for sparkline
  const max = Math.max(...sparklineData, 1);
  const min = Math.min(...sparklineData, 0);
  const range = max - min || 1;
  const points = sparklineData
    .map((v, i) => {
      const x = (i / (sparklineData.length - 1)) * 90;
      const y = 30 - ((v - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="glass-card p-6 rounded-2xl relative overflow-hidden transition-all duration-200 hover:scale-[1.01] hover:border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold tracking-tight text-slate-100">
              {displayValue}
            </span>
            {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          </div>
        </div>

        <div className={`p-3 rounded-xl ${colorStyles.bg} ${colorStyles.text} border ${colorStyles.border}`}>
          {Icon && <Icon className="w-5 h-5" />}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
        <span className="text-xs text-slate-400 font-medium">
          {trend || 'Live rolling calculation'}
        </span>

        {/* Subtle mini sparkline */}
        <svg className="w-20 h-6 overflow-visible opacity-70" viewBox="0 0 90 30">
          <polyline
            fill="none"
            stroke={colorStyles.stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
}

