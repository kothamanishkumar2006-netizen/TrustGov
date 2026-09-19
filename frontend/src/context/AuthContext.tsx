import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OFFICER' | 'CITIZEN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface OfficerDetails {
  officer_id: string;
  officer_code: string;
  department: string;
  designation: string;
  jurisdiction: string;
  did: string;
  public_key: string;
  key_type?: string;
  did_status?: string;
  credential_status: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  officerDetails: OfficerDetails | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerCitizen: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  clearError: () => void;
  isAdmin: boolean;
  isOfficer: boolean;
  isCitizen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [officerDetails, setOfficerDetails] = useState<OfficerDetails | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tg_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (authToken: string) => {
    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.data.success) {
        setUser(res.data.data.user);
        if (res.data.data.officerDetails) {
          setOfficerDetails(res.data.data.officerDetails);
        } else {
          setOfficerDetails(null);
        }
      } else {
        // Token invalid or user deactivated
        handleLogoutState();
      }
    } catch (err: any) {
      console.error('Failed to retrieve user profile:', err);
      handleLogoutState();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleLogoutState = () => {
    localStorage.removeItem('tg_token');
    setToken(null);
    setUser(null);
    setOfficerDetails(null);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.success) {
        const { token: receivedToken, user: receivedUser } = res.data.data;
        localStorage.setItem('tg_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        // Profile will be checked again on mount/effect to fetch officerDetails if role matches
        return true;
      }
      return false;
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Login failed due to server error.';
      setError(errMsg);
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post('/api/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      handleLogoutState();
    }
  };

  const registerCitizen = async (name: string, email: string, phone: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', { name, email, phone, password });
      if (res.data.success) {
        const { token: receivedToken, user: receivedUser } = res.data.data;
        localStorage.setItem('tg_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        return true;
      }
      return false;
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Registration failed.';
      setError(errMsg);
      setLoading(false);
      return false;
    }
  };

  const clearError = () => setError(null);

  const isAdmin = user?.role === 'ADMIN';
  const isOfficer = user?.role === 'OFFICER';
  const isCitizen = user?.role === 'CITIZEN';

  return (
    <AuthContext.Provider value={{
      user,
      officerDetails,
      token,
      loading,
      error,
      login,
      logout,
      registerCitizen,
      clearError,
      isAdmin,
      isOfficer,
      isCitizen
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
