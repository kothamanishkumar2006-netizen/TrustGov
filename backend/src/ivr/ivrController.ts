/**
 * TRUSTGOV - PHASE 10: IVR API CONTROLLER
 * 
 * Exposes telephony endpoints for IVR session lifecycle, DTMF input, and simulation.
 * Never leaks database errors, stack traces, private keys, or caller phone numbers.
 */

import { Request, Response } from 'express';
import { ivrService } from './ivrService';

export async function startCallHandler(req: Request, res: Response) {
  try {
    const { callerId, language } = req.body || {};
    const result = await ivrService.startCall({ callerId, language });
    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'IVR_ERROR',
        message: 'We could not complete your request. Please try again later.'
      }
    });
  }
}

export async function processInputHandler(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { inputType, value, digits } = req.body || {};
    const effectiveValue = value !== undefined && value !== null ? value : digits;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { code: 'SESSION_ID_REQUIRED', message: 'Session ID is required.' }
      });
    }

    const result = await ivrService.processInput(sessionId, {
      inputType: inputType || 'DTMF',
      value: String(effectiveValue ?? '')
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    const message = status === 404
      ? 'The requested IVR verification session was not found.'
      : 'We could not complete your request. Please try again later.';

    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'IVR_ERROR',
        message
      }
    });
  }
}

export async function repeatHandler(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const result = await ivrService.processInput(sessionId, { inputType: 'DTMF', value: '0' });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'IVR_ERROR',
        message: 'We could not complete your request. Please try again later.'
      }
    });
  }
}

export async function endCallHandler(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const result = await ivrService.endCall(sessionId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'IVR_ERROR',
        message: 'We could not complete your request. Please try again later.'
      }
    });
  }
}

export async function statusHandler(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const result = await ivrService.getStatus(sessionId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'IVR_ERROR',
        message: 'We could not complete your request. Please try again later.'
      }
    });
  }
}

export async function resetSimulatorHandler(_req: Request, res: Response) {
  try {
    const result = await ivrService.resetSimulator();
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'RESET_FAILED', message: 'Failed to reset IVR simulator state.' }
    });
  }
}

export async function expireSimulatorHandler(req: Request, res: Response) {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, error: { code: 'SESSION_ID_REQUIRED', message: 'Session ID is required' } });
    }
    const result = await ivrService.expireSimulatorSession(sessionId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'IVR_ERROR', message: err.message || 'Failed to expire session' }
    });
  }
}
