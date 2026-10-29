import * as metricsService from '../services/metrics.service.js';

export async function getOverview(req, res, next) {
  try {
    const data = await metricsService.getOverviewMetrics(
      req.user.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getEndpoints(req, res, next) {
  try {
    const data = await metricsService.getEndpointHealthMetrics(
      req.user.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

