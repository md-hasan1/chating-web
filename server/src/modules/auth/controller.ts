import { Request, Response } from 'express';
import { authService } from './service';

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const hashedPassword = await authService.hashPassword(password);

      const user = await authService.createUser({
        email,
        password: hashedPassword,
        name,
      });

      const token = authService.generateToken(user.id, user.email);

      res.status(201).json({ user, token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const user = await authService.findUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isMatch = await authService.comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = authService.generateToken(user.id, user.email);

      res.json({ user, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },

  googleLogin: async (req: Request, res: Response) => {
    try {
      const { email, name, image } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let user = await authService.findUserByEmail(email);

      if (!user) {
        user = await authService.createUser({
          email,
          name: name || 'Google User',
          image,
        });
      } else {
        user = await authService.updateUserProfile(email, { name, image });
      }

      const token = authService.generateToken(user.id, user.email);

      res.json({ user, token });
    } catch (error) {
      console.error('Google login error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  },

  guestLogin: async (req: Request, res: Response) => {
    try {
      const guestId = `guest-${Date.now()}`;
      const email = `${guestId}@chatapp.local`;

      const user = await authService.createUser({
        email,
        name: 'Guest User',
      });

      const token = authService.generateToken(user.id, user.email);

      res.json({ user, token });
    } catch (error) {
      console.error('Guest login error:', error);
      res.status(500).json({ error: 'Guest login failed' });
    }
  },

  getCurrentUser: async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = authService.verifyToken(token);
      const user = await authService.findUserById(decoded.userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  },

  logout: (req: Request, res: Response) => {
    res.json({ message: 'Logged out successfully' });
  },
};
