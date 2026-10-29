import * as endpointService from '../services/endpoint.service.js';

export async function create(req, res, next) {
  try {
    const { url, description, eventTypes } = req.body;
    const endpoint = await endpointService.createEndpoint({
      userId: req.user.id,
      url,
      description,
      eventTypes,
    });

    res.status(201).json({
      success: true,
      message: 'Webhook endpoint registered successfully',
      data: endpoint,
    });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const endpoints = await endpointService.listEndpoints(req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      data: endpoints,
    });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const endpoint = await endpointService.getEndpointById(
      req.user.id,
      req.params.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data: endpoint,
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const endpoint = await endpointService.updateEndpoint(
      req.user.id,
      req.params.id,
      req.user.role,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Endpoint updated successfully',
      data: endpoint,
    });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await endpointService.deleteEndpoint(req.user.id, req.params.id, req.user.role);
    res.status(200).json({
      success: true,
      message: 'Endpoint deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function resume(req, res, next) {
  try {
    const endpoint = await endpointService.resumeEndpoint(
      req.user.id,
      req.params.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: 'Endpoint resumed. Delivery worker will resume dispatching.',
      data: endpoint,
    });
  } catch (err) {
    next(err);
  }
}

export async function pause(req, res, next) {
  try {
    const endpoint = await endpointService.pauseEndpoint(
      req.user.id,
      req.params.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: 'Endpoint manually paused.',
      data: endpoint,
    });
  } catch (err) {
    next(err);
  }
}

