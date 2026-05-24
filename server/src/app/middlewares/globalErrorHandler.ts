import { NextFunction, Request, Response } from 'express';
import ApiError from '../../errors/ApiErrors';
import parsePrismaValidationError from '../../errors/parsePrismaValidationError';

const GlobalErrorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  // ApiError (custom)
  if (err instanceof ApiError || typeof err?.statusCode === 'number') {
    const status = (err as any).statusCode || (err as any).status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }

  // Handle Prisma validation-ish errors
  if (err && typeof err.message === 'string' && err.message.includes('Argument')) {
    const parsed = parsePrismaValidationError(err.message);
    return res.status(400).json({ success: false, message: parsed || err.message });
  }

  // Fallback
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};

export default GlobalErrorHandler;
