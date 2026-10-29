import React, { useEffect, useState, useCallback } from 'react';
import { Key, Plus, Copy, Check, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/EmptyState';

export function ApiKeys() {
  const { authFetch, user } = useAuth();
  const { addToast } = useToast();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKeyData, setCreatedKeyData] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/api-keys');
      if (res.ok) {
        const body = await res.json();
        setKeys(body.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to create API key');
      }

      setCreatedKeyData(body.data);
      setNewKeyName('');
      addToast('API key generated successfully!');
      fetchKeys();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Services using it will receive 401.')) {
      return;
    }

    try {
      const res = await authFetch(`/api/v1/api-keys/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast('API key revoked');
        fetchKeys();
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const copyRawKey = () => {
    if (createdKeyData?.apiKey) {
      navigator.clipboard.writeText(createdKeyData.apiKey);
      setCopied(true);
      addToast('Raw API Key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Key className="w-6 h-6 text-indigo-400" /> API Keys
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authenticate webhook event ingestion requests (`X-API-Key` header). Only SHA-256 hashes are stored in MySQL.
          </p>
        </div>
        <button
          onClick={() => {
            setCreatedKeyData(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/25 transition"
        >
          <Plus className="w-4 h-4" /> Generate New Key
        </button>
      </div>

      {keys.length === 0 && !loading ? (
        <div className="glass-card rounded-2xl border border-slate-800">
          <EmptyState
            icon={Key}
            title="No API keys active"
            description="Generate an API key to authenticate external systems sending events to HookRelay."
            actionLabel="Generate Key"
            onAction={() => setModalOpen(true)}
          />
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                  <th className="py-3.5 pl-4">Name</th>
                  <th className="py-3.5">Key Prefix</th>
                  <th className="py-3.5">Rate Limit</th>
                  <th className="py-3.5">Created</th>
                  <th className="py-3.5">Last Used</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 pl-4 font-semibold text-slate-200">{k.name}</td>
                    <td className="py-3.5 font-mono text-indigo-300">
                      {k.prefix}••••••••••••
                    </td>
                    <td className="py-3.5 text-slate-300">
                      <span className="font-semibold text-slate-100">{k.rateLimit}</span> req / min
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="py-3.5">
                      {k.revokedAt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Revoked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      {!k.revokedAt && (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="Revoke key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Key Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-5">
            {!createdKeyData ? (
              <>
                <div>
                  <h2 className="text-lg font-bold text-white">Generate API Key</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Your account tier ({user?.plan || 'FREE'}) grants {user?.plan === 'PRO' ? '300' : '60'} requests/min on our custom Token Bucket.
                  </p>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Key Name / Service</label>
                    <input
                      type="text"
                      required
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. Production Ingest, Stripe Webhooks"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/25 transition"
                    >
                      Generate Key
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Save your secret API key</h2>
                <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Copy this key now. For your security, HookRelay stores only the SHA-256 hash and this key will never be shown again!
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2 font-mono text-xs text-indigo-300">
                  <span className="truncate select-all">{createdKeyData.apiKey}</span>
                  <button
                    onClick={copyRawKey}
                    className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 transition shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={() => setModalOpen(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
                >
                  I have saved this key safely
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

