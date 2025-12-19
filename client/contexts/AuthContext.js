'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import buildClient from '../app/api/build-client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get('/api/users/currentuser');
      setCurrentUser(data.currentUser);
    } catch (error) {
      console.error('Auth check error:', error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = () => {
    checkAuth();
  };

  const value = {
    currentUser,
    loading,
    isAuthenticated: !!currentUser,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
