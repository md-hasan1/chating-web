import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const authService = {
  findUserByEmail: async (email: string) => {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserById: async (userId: string) => {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  hashPassword: async (password: string) => {
    return bcrypt.hash(password, 10);
  },

  comparePassword: async (password: string, hash: string) => {
    return bcrypt.compare(password, hash);
  },

  generateToken: (userId: string, email: string) => {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
  },

  verifyToken: (token: string) => {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  },

  createUser: async (data: { email: string; password?: string; name: string; image?: string }) => {
    return prisma.user.create({
      data,
    });
  },

  updateUserProfile: async (email: string, data: { name?: string; image?: string }) => {
    return prisma.user.update({
      where: { email },
      data,
    });
  },
};
