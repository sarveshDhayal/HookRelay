import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, ShieldCheck, Cpu, Database, Network } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      addToast('Welcome back to HookRelay!');
      navigate('/');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const prefill = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100">
      {/* Left split-screen brand hero */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-12 flex-col justify-between overflow-hidden border-r border-slate-800">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">HookRelay</span>
          </div>

          <div className="mt-20 max-w-md space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              Webhook delivery platform built with university CS fundamentals.
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Durable delivery retries, custom MinHeap priority queue, in-memory TokenBucket rate limiting, SSRF protection, and real-time observability.
            </p>
          </div>
        </div>

        {/* Course Alignment Badges */}
        <div className="relative z-10 grid grid-cols-2 gap-3 max-w-md">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs text-slate-300">MinHeap & TokenBucket</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
            <Database className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-slate-300">MySQL 3NF & ACID Queue</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
            <Network className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-300">SSRF & HMAC Signatures</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-slate-300">Z-Score Outlier Detector</span>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Sign in to your account</h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter your developer credentials or click a prefill button below.
            </p>
          </div>

          {/* Quick Demo Pre-fill Pills */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => prefill('student@hookrelay.dev')}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition text-center"
            >
              Prefill Developer
            </button>
            <button
              type="button"
              onClick={() => prefill('admin@hookrelay.dev')}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/60 transition text-center"
            >
              Prefill Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@hookrelay.dev"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:underline font-medium">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

