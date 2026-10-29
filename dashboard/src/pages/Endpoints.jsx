import React, { useEffect, useState, useCallback } from 'react';
import {
  Webhook,
  Plus,
  Play,
  Pause,
  Trash2,
  Key,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/EmptyState';

export function Endpoints() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Form state
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [eventTypesInput, setEventTypesInput] = useState('order.created, payment.succeeded');
  const [submitting, setSubmitting] = useState(false);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/endpoints');
      if (res.ok) {
        const body = await res.json();
        setEndpoints(body.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const eventTypes = eventTypesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await authFetch('/api/v1/endpoints', {
        method: 'POST',
        body: JSON.stringify({ url, description, eventTypes }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to register endpoint');
      }

      addToast('Webhook endpoint registered successfully!');
      setModalOpen(false);
      setUrl('');
      setDescription('');
      fetchEndpoints();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePauseResume = async (endpoint) => {
    try {
      const action = endpoint.isPaused ? 'resume' : 'pause';
      const res = await authFetch(`/api/v1/endpoints/${endpoint.id}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast(`Endpoint ${action === 'resume' ? 'resumed' : 'paused'} successfully`);
        fetchEndpoints();
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (endpointId) => {
    if (!window.confirm('Are you sure you want to delete this endpoint and all its delivery records?')) {
      return;
    }

    try {
      const res = await authFetch(`/api/v1/endpoints/${endpointId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast('Endpoint deleted successfully');
        fetchEndpoints();
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const copySecret = (secret, id) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    addToast('HMAC signing secret copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Webhook Endpoints</h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered subscriber destinations with automatic SSRF filtering and HMAC signing secrets.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/25 transition"
        >
          <Plus className="w-4 h-4" /> Register Endpoint
        </button>
      </div>

      {endpoints.length === 0 && !loading ? (
        <div className="glass-card rounded-2xl border border-slate-800">
          <EmptyState
            icon={Webhook}
            title="No endpoints registered"
            description="Add your first webhook receiver URL to start dispatching events."
            actionLabel="Register Endpoint"
            onAction={() => setModalOpen(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 transition-all hover:border-slate-700"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-slate-100">{ep.url}</span>
                    {ep.isPaused ? (
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Paused (Circuit Breaker)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </div>
                  {ep.description && (
                    <p className="text-xs text-slate-400">{ep.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePauseResume(ep)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      ep.isPaused
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {ep.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {ep.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => handleDelete(ep.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-slate-800 transition"
                    title="Delete endpoint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subscriptions & Secret */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1.5">Subscribed Event Types:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(ep.eventTypes) ? (
                      ep.eventTypes.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono text-[11px]"
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="font-mono text-slate-400">*</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1.5">HMAC Signing Secret:</span>
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-slate-300 text-[11px]">
                    <span className="truncate flex-1">{ep.secret}</span>
                    <button
                      onClick={() => copySecret(ep.secret, ep.id)}
                      className="text-slate-400 hover:text-indigo-400 p-1"
                      title="Copy Secret"
                    >
                      {copiedId === ep.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Endpoint Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="glass-card max-w-lg w-full p-6 rounded-2xl border border-slate-800 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Register Webhook Destination</h2>
              <p className="text-xs text-slate-400 mt-1">
                HookRelay automatically validates target IP addresses against private subnets (SSRF protection).
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Destination URL</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:4001/webhook"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary payments receiver"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Subscribed Event Types (comma-separated, or * for all)
                </label>
                <input
                  type="text"
                  required
                  value={eventTypesInput}
                  onChange={(e) => setEventTypesInput(e.target.value)}
                  placeholder="order.created, payment.*, *"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

