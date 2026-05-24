import { Request, Response, NextFunction } from 'express';

export const validateChat = (req: Request, res: Response, next: NextFunction) => {
  next();
};
