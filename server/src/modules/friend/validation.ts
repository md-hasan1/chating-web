import { Request, Response, NextFunction } from 'express';

export const validateFriend = (req: Request, res: Response, next: NextFunction) => {
  next();
};
