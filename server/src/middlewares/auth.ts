import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';

import prisma from '../shared/prisma';

type VerifiedTokenPayload = JwtPayload & {
  id?: string;
  userId?: string;
  role?: string;
  email?: string;
};

type AuthenticatedRequest = Request & {
  user?: VerifiedTokenPayload & { id: string };
  userId?: string;
};

const auth = (...roles: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const createHttpError = (statusCode: number, message: string) =>
        Object.assign(new Error(message), { statusCode });

      const authorization = req.headers.authorization;
      const token = authorization?.startsWith('Bearer ')
        ? authorization.split(' ')[1]
        : authorization;

      if (!token) {
        throw createHttpError(401, 'You are not authorized!');
      }

      const verifiedUser = jwt.verify(
        token,
        (process.env.JWT_SECRET || 'secret') as Secret,
      ) as VerifiedTokenPayload;

      const userId = verifiedUser.id || verifiedUser.userId;
      const role = verifiedUser.role;

      if (!userId) {
        throw createHttpError(401, 'Invalid token payload!');
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw createHttpError(404, 'User not found!');
      }

      const userStatus = (user as { status?: string }).status;
      if (userStatus === 'BLOCKED') {
        throw createHttpError(403, 'Your account is blocked!');
      }

      authenticatedReq.user = {
        ...verifiedUser,
        id: userId,
      };
      authenticatedReq.userId = userId;

      if (roles.length && (!role || !roles.includes(role))) {
        throw createHttpError(403, 'Forbidden!');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const authMiddleware = auth;

export default auth;
