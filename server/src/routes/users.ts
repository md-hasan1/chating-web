import express, { Request, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const includeSelf = req.query.includeSelf === 'true';

    const users = await prisma.user.findMany({
      where: includeSelf
        ? undefined
        : {
            id: {
              not: userId
            }
          },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        lastActiveAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update profile name
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        lastActiveAt: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
