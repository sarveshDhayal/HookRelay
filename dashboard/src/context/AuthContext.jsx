import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('hookrelay_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('hookrelay_refresh_token'));
  const [loading, setLoading] = useState(true);

  // Load user profile on initial load if token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const body = await res.json();
          setUser(body.data.user);
        } else {
          // Token invalid or expired, clear storage
          logout();
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Failed to login');
    }

    const { user, accessToken, refreshToken: newRefreshToken } = body.data;
    setUser(user);
    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    localStorage.setItem('hookrelay_token', accessToken);
    localStorage.setItem('hookrelay_refresh_token', newRefreshToken);
    return user;
  };

  const register = async (email, password, role = 'DEVELOPER') => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Registration failed');
    }

    const { user, accessToken, refreshToken: newRefreshToken } = body.data;
    setUser(user);
    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    localStorage.setItem('hookrelay_token', accessToken);
    localStorage.setItem('hookrelay_refresh_token', newRefreshToken);
    return user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('hookrelay_token');
    localStorage.removeItem('hookrelay_refresh_token');
  };

  // Helper fetch with automatic auth header injection
  const authFetch = useCallback(
    async (url, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let res = await fetch(url, { ...options, headers });

      // If token expired (401), attempt silent refresh
      if (res.status === 401 && refreshToken) {
        try {
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData.data.accessToken;
            setToken(newToken);
            localStorage.setItem('hookrelay_token', newToken);

            // Retry original request with fresh token
            headers['Authorization'] = `Bearer ${newToken}`;
            res = await fetch(url, { ...options, headers });
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }

      return res;
    },
    [token, refreshToken]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
