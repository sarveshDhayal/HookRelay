import { prisma } from '../db.js';
import { eventBus } from '../utils/eventBus.js';

// In-memory rolling metrics updated via Observer pattern (EventEmitter)
const liveMetrics = {
  liveSuccess: 0,
  liveFailure: 0,
  liveDead: 0,
  recentLatencies: [],
};

// Observer Pattern: Metrics module subscribes to worker event bus
eventBus.on('delivery.succeeded', ({ latencyMs }) => {
  liveMetrics.liveSuccess++;
  liveMetrics.recentLatencies.push(latencyMs);
  if (liveMetrics.recentLatencies.length > 500) {
    liveMetrics.recentLatencies.shift();
  }
});

eventBus.on('delivery.failed', () => {
  liveMetrics.liveFailure++;
});

eventBus.on('delivery.dead', () => {
  liveMetrics.liveDead++;
});

// Helper: Calculate percentile from a sorted array of numbers (Prob & Stats)
export function calculatePercentile(sortedValues, percentile) {
  if (!sortedValues || sortedValues.length === 0) return 0;
  const index = Math.min(
    Math.floor((percentile / 100) * sortedValues.length),
    sortedValues.length - 1
  );
  return sortedValues[index];
}

// Helper: Statistical Outlier Detector using Z-Score (Prob & Stats / ML Bonus)
// Formula: z = (x - \mu) / \sigma
// A z-score > 2 indicates an observation more than 2 standard deviations above the mean
// representing an anomaly in the top 2.5% tail of a normal distribution.
// For small sample sizes (N < 8), sample-size bounds (Thompson's rule) limit max z-score,
// so we use sample standard deviation (Bessel's correction N - 1) and adaptive threshold.
export function computeZScores(endpointsData) {
  const n = endpointsData.length;
  if (n < 2) {
    return endpointsData.map((ep) => ({
      ...ep,
      zScore: 0,
      isAnomaly: false,
      healthStatus: ep.isPaused ? 'PAUSED' : 'HEALTHY',
    }));
  }

  // 1. Calculate sample mean of failure rates
  const mean = endpointsData.reduce((acc, ep) => acc + ep.failureRate, 0) / n;

  // 2. Calculate sample standard deviation (Bessel's correction: N - 1)
  const sumSquaredDiff = endpointsData.reduce(
    (acc, ep) => acc + Math.pow(ep.failureRate - mean, 2),
    0
  );
  const stdDev = Math.sqrt(sumSquaredDiff / (n - 1));

  // Threshold: standard z > 2.0, or for small samples (N < 8) z >= 1.6
  const threshold = n < 8 ? 1.6 : 2.0;

  // 3. Compute z-score for each endpoint
  return endpointsData.map((ep) => {
    const rawZ = stdDev > 0 ? (ep.failureRate - mean) / stdDev : 0;
    const zScore = Number(rawZ.toFixed(2));
    
    // An endpoint is flagged as an anomaly if z-score exceeds threshold and has failures
    const isAnomaly = zScore >= threshold && ep.totalDeliveries >= 3 && ep.failedDeliveries > 0;

    let healthStatus = 'HEALTHY';
    if (ep.isPaused) {
      healthStatus = 'PAUSED';
    } else if (isAnomaly) {
      healthStatus = 'ANOMALY';
    } else if (ep.failureRate >= 0.2) {
      healthStatus = 'DEGRADED';
    }

    return {
      ...ep,
      zScore,
      isAnomaly,
      healthStatus,
    };
  });
}

// Get high-level KPI metrics & chart data for dashboard overview
export async function getOverviewMetrics(userId, userRole) {
  const whereEndpoint = userRole === 'ADMIN' ? {} : { userId };
  const whereDelivery = userRole === 'ADMIN' ? {} : { endpoint: { userId } };

  // 1. Run database aggregation queries concurrently
  const [
    totalDeliveries,
    completedCount,
    failedCount,
    deadCount,
    pendingCount,
    processingCount,
    attempts,
    pausedEndpointsCount,
    recentDeliveries,
  ] = await Promise.all([
    prisma.delivery.count({ where: whereDelivery }),
    prisma.delivery.count({ where: { ...whereDelivery, status: 'COMPLETED' } }),
    prisma.delivery.count({ where: { ...whereDelivery, status: 'FAILED' } }),
    prisma.delivery.count({ where: { ...whereDelivery, status: 'DEAD' } }),
    prisma.delivery.count({ where: { ...whereDelivery, status: 'PENDING' } }),
    prisma.delivery.count({ where: { ...whereDelivery, status: 'PROCESSING' } }),
    prisma.deliveryAttempt.findMany({
      where: userRole === 'ADMIN' ? {} : { delivery: { endpoint: { userId } } },
      select: { latencyMs: true },
      take: 1000,
      orderBy: { attemptedAt: 'desc' },
    }),
    prisma.webhookEndpoint.count({ where: { ...whereEndpoint, isPaused: true } }),
    // Last 24 hours of deliveries for time-series grouping
    prisma.delivery.findMany({
      where: {
        ...whereDelivery,
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // 2. Success and failure rate KPIs
  const resolvedCount = completedCount + failedCount + deadCount;
  const successRate = resolvedCount > 0 ? (completedCount / resolvedCount) * 100 : 100;
  const failureRate = resolvedCount > 0 ? ((failedCount + deadCount) / resolvedCount) * 100 : 0;

  // 3. Compute p50 and p95 latency percentiles
  const sortedLatencies = attempts.map((a) => a.latencyMs).sort((a, b) => a - b);
  const p50LatencyMs = calculatePercentile(sortedLatencies, 50);
  const p95LatencyMs = calculatePercentile(sortedLatencies, 95);

  // 4. Generate hourly buckets for area chart (24 hours)
  const hourlyBuckets = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const bucketTime = new Date(now.getTime() - i * 3600 * 1000);
    const hourLabel = bucketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    hourlyBuckets.push({
      hour: hourLabel,
      timestamp: bucketTime.toISOString(),
      deliveries: 0,
      successful: 0,
      failed: 0,
    });
  }

  // Populate hourly counts
  for (const del of recentDeliveries) {
    const delTime = new Date(del.createdAt).getTime();
    const hoursAgo = Math.floor((now.getTime() - delTime) / (3600 * 1000));
    if (hoursAgo >= 0 && hoursAgo < 24) {
      const bucketIdx = 23 - hoursAgo;
      if (hourlyBuckets[bucketIdx]) {
        hourlyBuckets[bucketIdx].deliveries++;
        if (del.status === 'COMPLETED') hourlyBuckets[bucketIdx].successful++;
        if (del.status === 'FAILED' || del.status === 'DEAD') hourlyBuckets[bucketIdx].failed++;
      }
    }
  }

  // 5. Status distribution for donut chart
  const statusDistribution = [
    { name: 'Completed', value: completedCount, color: '#10B981' }, // emerald
    { name: 'Retrying', value: failedCount, color: '#F59E0B' },     // amber
    { name: 'Dead (DLQ)', value: deadCount, color: '#EF4444' },     // red
    { name: 'Queued', value: pendingCount + processingCount, color: '#6366F1' }, // indigo
  ];

  return {
    kpis: {
      totalDeliveries,
      successRate: Number(successRate.toFixed(1)),
      failureRate: Number(failureRate.toFixed(1)),
      p50LatencyMs,
      p95LatencyMs,
      dlqSize: deadCount,
      pausedEndpoints: pausedEndpointsCount,
    },
    charts: {
      hourlyDeliveries: hourlyBuckets,
      statusDistribution,
    },
    liveObserverCounters: {
      liveSuccess: liveMetrics.liveSuccess,
      liveFailure: liveMetrics.liveFailure,
      liveDead: liveMetrics.liveDead,
    },
  };
}

// Get per-endpoint health metrics with z-score anomaly detector
export async function getEndpointHealthMetrics(userId, userRole) {
  const where = userRole === 'ADMIN' ? {} : { userId };

  const endpoints = await prisma.webhookEndpoint.findMany({
    where,
    include: {
      deliveries: {
        select: {
          id: true,
          status: true,
          attempts: {
            select: { latencyMs: true, statusCode: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rawEndpointData = endpoints.map((ep) => {
    const total = ep.deliveries.length;
    const completed = ep.deliveries.filter((d) => d.status === 'COMPLETED').length;
    const failed = ep.deliveries.filter((d) => d.status === 'FAILED' || d.status === 'DEAD').length;
    const dead = ep.deliveries.filter((d) => d.status === 'DEAD').length;

    const failureRate = total > 0 ? failed / total : 0;
    const successRate = total > 0 ? (completed / total) * 100 : 100;

    // Collect all attempt latencies
    const allLatencies = ep.deliveries
      .flatMap((d) => d.attempts.map((a) => a.latencyMs))
      .sort((a, b) => a - b);

    const avgLatency =
      allLatencies.length > 0
        ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
        : 0;

    return {
      id: ep.id,
      url: ep.url,
      description: ep.description,
      eventTypes: ep.eventTypes,
      isActive: ep.isActive,
      isPaused: ep.isPaused,
      consecutiveFailures: ep.consecutiveFailures,
      totalDeliveries: total,
      completedDeliveries: completed,
      failedDeliveries: failed,
      deadDeliveries: dead,
      failureRate,
      successRate: Number(successRate.toFixed(1)),
      avgLatencyMs: avgLatency,
      p95LatencyMs: calculatePercentile(allLatencies, 95),
    };
  });

  // Run statistical outlier detection on endpoints
  return computeZScores(rawEndpointData);
}
