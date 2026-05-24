import 'express';
import { JwtPayload } from 'jsonwebtoken';

type VerifiedTokenPayload = JwtPayload & {
  id: string;
  userId?: string;
  role?: string;
  email?: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    user?: VerifiedTokenPayload;
  }
}
