import { Request, Response } from 'express';
import { userService } from './service';

export const userController = {
  getUsers: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const userId = req.userId!;
      const includeSelf = req.query.includeSelf === 'true';

      const users = await userService.getUsers(userId, includeSelf);
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },

  updateProfile: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const userId = req.userId!;
      const { name } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }

      const updatedUser = await userService.updateProfile(userId, name);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  },
};
