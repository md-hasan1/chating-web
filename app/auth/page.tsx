'use client';

import React, { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useToast } from '@/app/context/ToastContext';

interface GoogleTokenPayload {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loginAsGuest, loginWithEmail, registerWithEmail } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/chat');
    }
  }, [user, router]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setAuthLoading(true);
    setErrorMsg('');
    try {
      const decoded: GoogleTokenPayload = jwtDecode(credentialResponse.credential);

      await login(
        decoded.email,
        decoded.name,
        decoded.sub,
        decoded.picture
      );
      showToast('Welcome!', 'Signed in successfully with Google.', 'success');
      router.push('/chat');
    } catch (error: any) {
      console.error('Google login failed:', error);
      setErrorMsg('Google login failed. Please try again.');
      showToast('Login Failed', 'Google login failed.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setAuthLoading(true);
    setErrorMsg('');
    try {
      await loginAsGuest();
      showToast('Welcome!', 'Logged in as Guest.', 'success');
      router.push('/chat');
    } catch (error: any) {
      console.error('Guest login failed:', error);
      setErrorMsg('Guest login failed. Please try again.');
      showToast('Login Failed', 'Guest login failed.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === 'register' && !name)) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setAuthLoading(true);
    setErrorMsg('');

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        showToast('Welcome Back!', 'Logged in successfully.', 'success');
      } else {
        await registerWithEmail(email, password, name);
        showToast('Registration Successful', 'Your account has been created.', 'success');
      }
      router.push('/chat');
    } catch (error: any) {
      console.error('Authentication error:', error);
      const apiError = error.response?.data?.error || 'Authentication failed. Please check your credentials.';
      setErrorMsg(apiError);
      showToast('Authentication Error', apiError, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-violet-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md transition-all duration-300">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-3">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">ChatApp</h1>
            <p className="text-slate-400 mt-2 text-sm">
              {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 transition-all text-sm mt-2"
            >
              {authLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="text-center mt-5">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrorMsg('');
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="px-3 bg-slate-900 text-slate-500 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-center w-full">
              <div className="w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    setErrorMsg('Google login failed.');
                    showToast('Login Failed', 'Google login failed.', 'error');
                  }}
                  text="signin_with"
                  theme="filled_black"
                  shape="rectangular"
                  width="384"
                />
              </div>
            </div>

            <button
              onClick={handleGuestLogin}
              disabled={authLoading}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-semibold hover:bg-slate-750 transition-all text-sm shadow hover:shadow-slate-800/50"
            >
              Continue as Guest
            </button>
          </div>

          <div className="border-t border-slate-800/80 pt-5 mt-6">
            <p className="text-center text-[10px] leading-relaxed text-slate-500">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
