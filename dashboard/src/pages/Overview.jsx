import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Send,
  Clock,
  Skull,
  AlertTriangle,
  Play,
  RotateCcw,
  Activity,
  Layers,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function Overview() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, endpointsRes] = await Promise.all([
        authFetch('/api/v1/metrics/overview'),
        authFetch('/api/v1/metrics/endpoints'),
      ]);

      if (overviewRes.ok) {
        const ov = await overviewRes.json();
        setMetrics(ov.data);
      }
      if (endpointsRes.ok) {
        const ep = await endpointsRes.json();
        setEndpoints(ep.data);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch overview metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Auto-refresh every 5 seconds with cleanup
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const resumeEndpoint = async (endpointId) => {
    try {
      const res = await authFetch(`/api/v1/endpoints/${endpointId}/resume`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast('Endpoint resumed. Delivery worker will resume dispatches.');
        fetchData();
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const kpis = metrics?.kpis || {
    successRate: 0,
    totalDeliveries: 0,
    p95LatencyMs: 0,
    dlqSize: 0,
  };

  const chartData = metrics?.charts?.hourlyDeliveries || [];
  const donutData = metrics?.charts?.statusDistribution || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            System Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time webhook queue telemetry, delivery health, and statistical anomaly detection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Manual Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Success Rate"
          value={kpis.successRate}
          unit="%"
          icon={CheckCircle2}
          color="emerald"
          trend="Target: >99.0%"
          sparklineData={[92, 94, 91, 96, 98, 97, 99, 99.5]}
        />
        <StatCard
          title="Total Deliveries"
          value={kpis.totalDeliveries}
          icon={Send}
          color="indigo"
          trend="All-time processed"
          sparklineData={[12, 18, 25, 30, 42, 55, 68, 85]}
        />
        <StatCard
          title="p95 Latency"
          value={kpis.p95LatencyMs}
          unit="ms"
          icon={Clock}
          color="amber"
          trend="95th percentile latency"
          sparklineData={[120, 110, 95, 80, 85, 75, 65, 52]}
        />
        <StatCard
          title="Dead Letter Queue"
          value={kpis.dlqSize}
          unit="jobs"
          icon={Skull}
          color={kpis.dlqSize > 0 ? 'rose' : 'indigo'}
          trend={kpis.dlqSize > 0 ? 'Exhausted 6 retries' : 'DLQ Empty'}
          sparklineData={[1, 0, 0, 2, 1, 3, 2, kpis.dlqSize]}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deliveries Area Chart (2 Cols) */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Deliveries Volume (24h)
              </h3>
              <p className="text-xs text-slate-400">Hourly delivery throughput and delivery outcomes</p>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="deliveries"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#deliveryGradient)"
                  name="Total Deliveries"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut Chart (1 Col) */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" /> Delivery Status
            </h3>
            <p className="text-xs text-slate-400">Current status composition</p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Endpoint Health Table */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Endpoint Health & Anomaly Detector</h3>
          <p className="text-xs text-slate-400">
            Real-time subscriber status, circuit breaker states, and statistical Z-Score outlier detection
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3 pl-2">Status</th>
                <th className="pb-3">Destination URL</th>
                <th className="pb-3">Deliveries</th>
                <th className="pb-3">Failure Rate</th>
                <th className="pb-3">Z-Score</th>
                <th className="pb-3">Avg Latency</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {endpoints.map((ep) => {
                const badgeColor = {
                  HEALTHY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  DEGRADED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  PAUSED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                  ANOMALY: 'bg-violet-500/15 text-violet-300 border-violet-500/40 animate-pulse',
                }[ep.healthStatus] || 'bg-slate-800 text-slate-300';

                return (
                  <tr key={ep.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 pl-2">
                      <span className={`px-2.5 py-1 rounded-full font-semibold border text-[11px] ${badgeColor}`}>
                        {ep.healthStatus}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-slate-200 max-w-xs truncate">
                      {ep.url}
                      {ep.description && (
                        <span className="block text-[11px] text-slate-400 font-sans truncate">
                          {ep.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-slate-300">{ep.totalDeliveries}</td>
                    <td className="py-3.5 text-slate-300 font-medium">
                      {(ep.failureRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3.5 font-mono text-slate-300">
                      {ep.zScore !== undefined ? (ep.zScore > 0 ? `+${ep.zScore}` : ep.zScore) : '0.00'}
                    </td>
                    <td className="py-3.5 text-slate-300">{ep.avgLatencyMs}ms</td>
                    <td className="py-3.5 text-right pr-2">
                      {ep.isPaused ? (
                        <button
                          onClick={() => resumeEndpoint(ep.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
                        >
                          <Play className="w-3 h-3" /> Resume
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs font-mono">Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

