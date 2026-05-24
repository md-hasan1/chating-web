import { Request, Response, NextFunction } from 'express';

export const validateMessage = (req: Request, res: Response, next: NextFunction) => {
  next();
};
