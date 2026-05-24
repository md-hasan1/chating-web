import { Request, Response, NextFunction } from 'express';

export const validateAuth = (req: Request, res: Response, next: NextFunction) => {
  // simple passthrough for now
  next();
};
