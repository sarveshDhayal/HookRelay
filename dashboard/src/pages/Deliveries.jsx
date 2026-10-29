import React, { useEffect, useState, useReducer, useCallback } from 'react';
import {
  Send,
  Filter,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Skull,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SlideOver } from '../components/SlideOver';
import { EmptyState } from '../components/EmptyState';

// Filter reducer (CS coursework requirement: useReducer)
function filterReducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload, page: 1 };
    case 'SET_ENDPOINT':
      return { ...state, endpointId: action.payload, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'RESET':
      return { status: '', endpointId: '', page: 1 };
    default:
      return state;
  }
}

export function Deliveries() {
  const { authFetch } = useAuth();
  const [filters, dispatch] = useReducer(filterReducer, {
    status: '',
    endpointId: '',
    page: 1,
  });

  const [deliveries, setDeliveries] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: '15',
      });
      if (filters.status) params.set('status', filters.status);
      if (filters.endpointId) params.set('endpointId', filters.endpointId);

      const res = await authFetch(`/api/v1/deliveries?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setDeliveries(body.data);
        setPagination(body.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, filters]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const openInspection = async (delivery) => {
    try {
      // Fetch full delivery details with attempts
      const res = await authFetch(`/api/v1/deliveries/${delivery.id}`);
      if (res.ok) {
        const body = await res.json();
        setSelectedDelivery(body.data);
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusPill = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completed</span>;
      case 'DEAD':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Dead Letter</span>;
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Retrying</span>;
      case 'PROCESSING':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">Processing</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Delivery Log</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit log of all outbound webhook dispatches, HTTP attempts, and retry timers.
          </p>
        </div>
        <button
          onClick={fetchDeliveries}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filter Bar using useReducer */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5 text-indigo-400" /> Filter:
        </div>

        {['', 'COMPLETED', 'FAILED', 'DEAD', 'PENDING'].map((st) => (
          <button
            key={st || 'ALL'}
            onClick={() => dispatch({ type: 'SET_STATUS', payload: st })}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              filters.status === st
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {st === '' ? 'All Statuses' : st === 'FAILED' ? 'Retrying' : st}
          </button>
        ))}
      </div>

      {/* Deliveries Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        {deliveries.length === 0 && !loading ? (
          <EmptyState
            icon={Send}
            title="No deliveries match criteria"
            description="Adjust your filters or ingest a new event to populate the queue."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                  <th className="py-3.5 pl-4">Status</th>
                  <th className="py-3.5">Event Type</th>
                  <th className="py-3.5">Destination</th>
                  <th className="py-3.5">Attempts</th>
                  <th className="py-3.5">Queued At</th>
                  <th className="py-3.5 text-right pr-4">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deliveries.map((del) => (
                  <tr
                    key={del.id}
                    onClick={() => openInspection(del)}
                    className="hover:bg-slate-900/50 cursor-pointer transition group"
                  >
                    <td className="py-3.5 pl-4">{getStatusPill(del.status)}</td>
                    <td className="py-3.5 font-mono font-medium text-indigo-300">
                      {del.event?.type || 'event'}
                    </td>
                    <td className="py-3.5 font-mono text-slate-300 max-w-xs truncate">
                      {del.endpoint?.url}
                    </td>
                    <td className="py-3.5 text-slate-300">
                      <span className="font-semibold text-slate-200">{del._count?.attempts || del.retryCount}</span>
                      <span className="text-slate-500"> / {del.maxAttempts}</span>
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(del.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      <button className="text-slate-400 group-hover:text-indigo-400 p-1 transition">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800/80 text-xs text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} deliveries)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => dispatch({ type: 'SET_PAGE', payload: pagination.page - 1 })}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => dispatch({ type: 'SET_PAGE', payload: pagination.page + 1 })}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SlideOver Drawer for Attempt Inspection */}
      <SlideOver
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        delivery={selectedDelivery}
      />
    </div>
  );
}

