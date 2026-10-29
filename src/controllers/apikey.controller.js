import * as apiKeyService from '../services/apikey.service.js';

export async function create(req, res, next) {
  try {
    const { name } = req.body;
    const apiKey = await apiKeyService.createApiKey({
      userId: req.user.id,
      name,
      userPlan: req.user.plan,
    });

    res.status(201).json({
      success: true,
      message: 'API key created. Store this key safely as it will not be shown again.',
      data: apiKey,
    });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const keys = await apiKeyService.listApiKeys(req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      data: keys,
    });
  } catch (err) {
    next(err);
  }
}

export async function revoke(req, res, next) {
  try {
    const result = await apiKeyService.revokeApiKey(
      req.user.id,
      req.params.id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: 'API key revoked successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
