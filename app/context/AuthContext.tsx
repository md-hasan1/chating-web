'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  isGuest?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, name: string, googleId: string, image: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

const setCookie = (name: string, value: string, days = 7) => {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
};

const eraseCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  });

  const checkAuth = useCallback(async () => {
    try {
      const guestMode = localStorage.getItem('guestMode') || getCookie('guestMode');
      const storedToken = localStorage.getItem('token') || getCookie('token');

      if (!storedToken) {
        localStorage.removeItem('guestMode');
        localStorage.removeItem('token');
        eraseCookie('guestMode');
        eraseCookie('token');
        setIsLoading(false);
        return;
      }

      // Sync storage mechanisms
      localStorage.setItem('token', storedToken);
      setCookie('token', storedToken);
      if (guestMode === 'true') {
        localStorage.setItem('guestMode', 'true');
        setCookie('guestMode', 'true');
      } else {
        localStorage.removeItem('guestMode');
        eraseCookie('guestMode');
      }

      const response = await apiClient.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` }
      });

      setToken(storedToken);
      setUser({ ...response.data, isGuest: guestMode === 'true' });
      setIsGuest(guestMode === 'true');
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('guestMode');
      eraseCookie('token');
      eraseCookie('guestMode');
      setToken(null);
      setUser(null);
      setIsGuest(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, name: string, googleId: string, image: string) => {
    try {
      const response = await apiClient.post('/api/auth/google-login', {
        email,
        name,
        googleId,
        image
      });

      const { user: userData, token: newToken } = response.data;
      setUser(userData);
      setToken(newToken);
      setIsGuest(false);
      localStorage.removeItem('guestMode');
      localStorage.setItem('token', newToken);
      eraseCookie('guestMode');
      setCookie('token', newToken);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    try {
      const response = await apiClient.post('/api/auth/guest-login');
      const { user: userData, token: newToken } = response.data;

      setUser({ ...userData, isGuest: true });
      setToken(newToken);
      setIsGuest(true);
      localStorage.setItem('guestMode', 'true');
      localStorage.setItem('token', newToken);
      setCookie('guestMode', 'true');
      setCookie('token', newToken);
    } catch (error) {
      console.error('Guest login failed:', error);
      throw error;
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/api/auth/login', { email, password });
      const { user: userData, token: newToken } = response.data;
      setUser(userData);
      setToken(newToken);
      setIsGuest(false);
      localStorage.removeItem('guestMode');
      localStorage.setItem('token', newToken);
      eraseCookie('guestMode');
      setCookie('token', newToken);
    } catch (error) {
      console.error('Email login failed:', error);
      throw error;
    }
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await apiClient.post('/api/auth/register', { email, password, name });
      const { user: userData, token: newToken } = response.data;
      setUser(userData);
      setToken(newToken);
      setIsGuest(false);
      localStorage.removeItem('guestMode');
      localStorage.setItem('token', newToken);
      eraseCookie('guestMode');
      setCookie('token', newToken);
    } catch (error) {
      console.error('Email registration failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsGuest(false);
    localStorage.removeItem('token');
    localStorage.removeItem('guestMode');
    eraseCookie('token');
    eraseCookie('guestMode');
  }, []);

  const updateName = useCallback(async (newName: string) => {
    if (!token) return;
    try {
      const response = await apiClient.put('/api/users/profile', { name: newName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => prev ? { ...prev, name: response.data.name } : null);
    } catch (error) {
      console.error('Failed to update name:', error);
      throw error;
    }
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isGuest, login, loginAsGuest, loginWithEmail, registerWithEmail, logout, checkAuth, updateName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
