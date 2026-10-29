import React from 'react';
import { Settings as SettingsIcon, Cpu, Database, Network, ShieldCheck, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const { user } = useAuth();

  const courses = [
    {
      course: 'DSA & DAA',
      implementation: 'Custom array-backed binary Min-Heap priority queue for retry scheduling O(log N). Custom TokenBucket rate limiter O(1).',
    },
    {
      course: 'DBMS',
      implementation: 'MySQL 8 3NF normalized schema, composite index (status, nextAttemptAt), ACID transactions for event fan-out, EXPLAIN queries.',
    },
    {
      course: 'Computer Networks',
      implementation: 'SSRF protection with recursive DNS lookup and CIDR subnet blocking, HMAC-SHA256 request signing, 10s AbortController timeouts.',
    },
    {
      course: 'System Design & SE',
      implementation: 'Strategy pattern for backoff jitter, Observer pattern EventEmitter for telemetry, Circuit Breaker auto-pause after 5 failures.',
    },
    {
      course: 'Prob & Stats / ML',
      implementation: 'Percentiles (p50, p95), success rate KPIs, and Z-Score outlier detector (z > 2.0) identifying anomalous subscriber failure rates.',
    },
    {
      course: 'Web App Programming',
      implementation: 'React 18 with hooks (useState, useEffect, useReducer, useContext, useMemo, useCallback), Tailwind CSS, Recharts, dark/light theme.',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-400" /> Platform Architecture & Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Technical specifications, rate limit configuration, and university coursework alignment.
        </p>
      </div>

      {/* Account Specs */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Account Tier & Limits
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block mb-1">User Email</span>
            <span className="font-semibold text-slate-200">{user?.email}</span>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block mb-1">Assigned Role</span>
            <span className="font-semibold text-indigo-300 font-mono">{user?.role}</span>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block mb-1">Rate Limit Capacity</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {user?.plan === 'PRO' ? '300 req/min (5 tokens/s)' : '60 req/min (1 token/s)'}
            </span>
          </div>
        </div>
      </div>

      {/* Coursework Alignment Card */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" /> University Course Alignment Map
        </h2>
        <div className="space-y-3">
          {courses.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/60 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-xs"
            >
              <span className="font-bold text-indigo-300 shrink-0 w-48 font-mono">{item.course}</span>
              <span className="text-slate-300 leading-relaxed">{item.implementation}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Circuit Breaker & Worker Config */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3 text-xs">
        <h2 className="text-sm font-bold text-white">Runtime Worker Parameters</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Poll Interval</span>
            <span className="font-mono font-bold text-slate-100">1000 ms</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Batch Size</span>
            <span className="font-mono font-bold text-slate-100">20 jobs</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">HTTP Timeout</span>
            <span className="font-mono font-bold text-slate-100">10,000 ms</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Circuit Breaker</span>
            <span className="font-mono font-bold text-amber-400">5 failures</span>
          </div>
        </div>
      </div>
    </div>
  );
}
