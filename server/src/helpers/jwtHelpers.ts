import jwt, { Secret, SignOptions } from 'jsonwebtoken';

export const jwtHelpers = {
  verifyToken: (token: string, secret: Secret) => {
    return jwt.verify(token, secret);
  },
  createToken: (payload: string | Buffer | object, secret: Secret, options?: SignOptions) => {
    return jwt.sign(payload, secret, options);
  },
};
