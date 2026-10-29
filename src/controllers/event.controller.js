import * as eventService from '../services/event.service.js';

export async function ingest(req, res, next) {
  try {
    const { type, payload, idempotencyKey } = req.body;
    const userId = req.user.id;

    const result = await eventService.ingestEvent({
      userId,
      type,
      payload,
      idempotencyKey,
    });

    if (result.isDuplicate) {
      return res.status(200).json({
        success: true,
        message: 'Idempotent request: Event already processed',
        data: result.event,
        duplicate: true,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Event ingested and delivery jobs queued',
      data: {
        event: result.event,
        deliveriesCreated: result.deliveriesCreated,
        deliveries: result.deliveries,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const events = await eventService.listEvents(req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const event = await eventService.getEventById(
      req.user.id,
      req.params.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (err) {
    next(err);
  }
}
