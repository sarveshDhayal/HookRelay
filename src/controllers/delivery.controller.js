import * as deliveryService from '../services/delivery.service.js';

export async function list(req, res, next) {
  try {
    const { status, endpointId, page, limit } = req.query;
    const result = await deliveryService.listDeliveries({
      userId: req.user.id,
      userRole: req.user.role,
      status,
      endpointId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    res.status(200).json({
      success: true,
      data: result.deliveries,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const delivery = await deliveryService.getDeliveryById(
      req.user.id,
      req.params.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (err) {
    next(err);
  }
}

export async function listDeadLetters(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await deliveryService.listDeadLetters(
      req.user.id,
      req.user.role,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );

    res.status(200).json({
      success: true,
      data: result.deliveries,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function replay(req, res, next) {
  try {
    const replayed = await deliveryService.replayDelivery(
      req.user.id,
      req.params.id,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: 'Delivery re-queued for immediate dispatch',
      data: replayed,
    });
  } catch (err) {
    next(err);
  }
}
