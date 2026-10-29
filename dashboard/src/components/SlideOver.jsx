import React, { useEffect } from 'react';
import { X, Clock, CheckCircle2, XCircle, AlertTriangle, Copy, Check } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function SlideOver({ isOpen, onClose, delivery }) {
  const { addToast } = useToast();
  const [copied, setCopied] = React.useState(false);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !delivery) return null;

  const copyPayload = () => {
    if (delivery.event?.payload) {
      navigator.clipboard.writeText(JSON.stringify(delivery.event.payload, null, 2));
      setCopied(true);
      addToast('Payload copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completed</span>;
      case 'DEAD':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Dead Letter</span>;
      case 'FAILED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Retrying</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Delivery Inspection</h2>
                {getStatusBadge(delivery.status)}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                ID: {delivery.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Destination & Meta */}
          <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Event Type:</span>
              <span className="font-semibold text-indigo-300 font-mono">
                {delivery.event?.type || 'unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Endpoint:</span>
              <span className="font-mono text-slate-200 truncate max-w-xs">
                {delivery.endpoint?.url || 'unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Retries:</span>
              <span className="text-slate-200">
                {delivery.retryCount} / {delivery.maxAttempts}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Created At:</span>
              <span className="text-slate-200">
                {new Date(delivery.createdAt).toLocaleString()}
              </span>
            </div>
            {delivery.nextAttemptAt && delivery.status !== 'COMPLETED' && delivery.status !== 'DEAD' && (
              <div className="flex justify-between text-amber-400">
                <span>Next Attempt:</span>
                <span>{new Date(delivery.nextAttemptAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Attempt Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" /> Attempt Timeline
            </h3>

            {(!delivery.attempts || delivery.attempts.length === 0) ? (
              <p className="text-xs text-slate-400 italic">No delivery attempts recorded yet.</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {delivery.attempts.map((att, idx) => {
                  const isSuccess = att.statusCode && att.statusCode >= 200 && att.statusCode < 300;
                  return (
                    <div key={att.id || idx} className="relative">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                          isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />

                      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            Attempt #{att.attemptNumber}
                          </span>
                          <span className="text-slate-400">
                            {new Date(att.attemptedAt).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                              isSuccess
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            HTTP {att.statusCode || 'ERR'}
                          </span>
                          <span className="text-xs text-slate-400">
                            Latency: {att.latencyMs}ms
                          </span>
                        </div>

                        {att.error && (
                          <div className="mt-2 text-xs text-rose-300 font-mono bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40">
                            {att.error}
                          </div>
                        )}

                        {att.responseBody && (
                          <div className="mt-2 text-xs text-slate-300 font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800 overflow-x-auto max-h-32">
                            {att.responseBody}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payload Inspection */}
          {delivery.event?.payload && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200">Webhook Payload</h3>
                <button
                  onClick={copyPayload}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-400 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-indigo-200 border border-slate-800 overflow-x-auto max-h-48">
                {JSON.stringify(delivery.event.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

