import { Request, Response, NextFunction } from 'express';

export const validateUsers = (req: Request, res: Response, next: NextFunction) => {
  next();
};
