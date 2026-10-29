import React, { useEffect, useState, useCallback } from 'react';
import { Skull, RotateCcw, Play, Eye, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SlideOver } from '../components/SlideOver';
import { EmptyState } from '../components/EmptyState';

export function DeadLetters() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [deadLetters, setDeadLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchDeadLetters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/deliveries/dead-letters');
      if (res.ok) {
        const body = await res.json();
        setDeadLetters(body.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchDeadLetters();
  }, [fetchDeadLetters]);

  const handleReplay = async (deliveryId) => {
    setReplayingId(deliveryId);
    try {
      const res = await authFetch(`/api/v1/deliveries/${deliveryId}/replay`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to replay delivery');
      }

      addToast('Delivery re-queued for immediate dispatch! (Status: PENDING)');
      fetchDeadLetters();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setReplayingId(null);
    }
  };

  const inspectDelivery = async (deliveryId) => {
    try {
      const res = await authFetch(`/api/v1/deliveries/${deliveryId}`);
      if (res.ok) {
        const body = await res.json();
        setSelectedDelivery(body.data);
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Skull className="w-6 h-6 text-rose-400" /> Dead Letter Queue (DLQ)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deliveries that exhausted all 6 exponential retry attempts. Manually inspect and replay.
          </p>
        </div>
        <button
          onClick={fetchDeadLetters}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {deadLetters.length === 0 && !loading ? (
        <div className="glass-card rounded-2xl border border-slate-800">
          <EmptyState
            icon={Skull}
            title="Dead Letter Queue is empty"
            description="All webhooks are delivering smoothly or recovering within their retry windows."
          />
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                  <th className="py-3.5 pl-4">Delivery ID</th>
                  <th className="py-3.5">Event Type</th>
                  <th className="py-3.5">Destination Endpoint</th>
                  <th className="py-3.5">Failed Attempts</th>
                  <th className="py-3.5">Last Failed At</th>
                  <th className="py-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deadLetters.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 pl-4 font-mono font-medium text-slate-200">
                      {del.id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 font-mono text-indigo-300">
                      {del.event?.type}
                    </td>
                    <td className="py-3.5 font-mono text-slate-300 max-w-xs truncate">
                      {del.endpoint?.url}
                    </td>
                    <td className="py-3.5 text-rose-400 font-semibold">
                      {del.retryCount} / {del.maxAttempts} attempts
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(del.updatedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 text-right pr-4 space-x-2">
                      <button
                        onClick={() => inspectDelivery(del.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                        title="Inspect attempts"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                      <button
                        onClick={() => handleReplay(del.id)}
                        disabled={replayingId === del.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                      >
                        <Play className="w-3 h-3" />
                        {replayingId === del.id ? 'Replaying...' : 'Replay'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SlideOver Drawer */}
      <SlideOver
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        delivery={selectedDelivery}
      />
    </div>
  );
}

