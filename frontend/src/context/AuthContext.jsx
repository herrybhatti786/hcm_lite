import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('hcm_token'));
  const [isInitialized, setIsInitialized] = useState(true);
  const [loading, setLoading] = useState(true);

  // Check system initialized status on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const status = await api.getSystemStatus();
        setIsInitialized(status.initialized);

        if (status.initialized && token) {
          try {
            const meData = await api.getMe();
            setUser(meData.user);
            setEmployee(meData.employee);
            setCompany(meData.company);
          } catch (err) {
            console.warn('Session expired or invalid, logging out.');
            logout();
          }
        }
      } catch (err) {
        console.error('Failed to query system status:', err);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, [token]);

  const login = (authToken, userData, companyData, employeeData) => {
    localStorage.setItem('hcm_token', authToken);
    setToken(authToken);
    setUser(userData);
    setCompany(companyData);
    setEmployee(employeeData || null);
    setIsInitialized(true);
  };

  const logout = () => {
    localStorage.removeItem('hcm_token');
    setToken(null);
    setUser(null);
    setEmployee(null);
  };

  const refreshUser = async () => {
    try {
      const meData = await api.getMe();
      setUser(meData.user);
      setEmployee(meData.employee);
      setCompany(meData.company);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        employee,
        company,
        token,
        isInitialized,
        loading,
        login,
        logout,
        refreshUser,
        setIsInitialized
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
