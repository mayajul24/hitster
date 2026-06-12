import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getMe, refreshToken as doRefresh } from '../lib/spotify.js';

const Ctx = createContext(null);

export function SpotifyProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('sp_access') || null);
  const [refresh, setRefresh] = useState(() => localStorage.getItem('sp_refresh') || null);
  const [expiry, setExpiry] = useState(() => Number(localStorage.getItem('sp_expiry')) || 0);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const refreshing = useRef(false);

  const saveTokens = useCallback((tokens) => {
    const exp = Date.now() + tokens.expires_in * 1000;
    setAccessToken(tokens.access_token);
    setExpiry(exp);
    localStorage.setItem('sp_access', tokens.access_token);
    localStorage.setItem('sp_expiry', exp);
    if (tokens.refresh_token) {
      setRefresh(tokens.refresh_token);
      localStorage.setItem('sp_refresh', tokens.refresh_token);
    }
  }, []);

  const getToken = useCallback(async () => {
    if (accessToken && Date.now() < expiry - 60_000) return accessToken;
    if (!refresh) throw new Error('Not logged in');
    if (refreshing.current) {
      await new Promise((r) => setTimeout(r, 500));
      return localStorage.getItem('sp_access');
    }
    refreshing.current = true;
    try {
      const tokens = await doRefresh(refresh);
      saveTokens(tokens);
      return tokens.access_token;
    } finally {
      refreshing.current = false;
    }
  }, [accessToken, expiry, refresh, saveTokens]);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefresh(null);
    setExpiry(0);
    setUser(null);
    setAuthError(null);
    localStorage.removeItem('sp_access');
    localStorage.removeItem('sp_refresh');
    localStorage.removeItem('sp_expiry');
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const token = await getToken();
      const me = await getMe(token);
      setUser(me);
      setAuthError(null);
    } catch (e) {
      if (e.status === 403) {
        setAuthError(
          "This Spotify account isn't authorized for the app yet. Add it under " +
            'Spotify Dashboard → User Management, then log in again.'
        );
      } else if (e.status === 401) {
        logout();
        setAuthError('Your Spotify session expired — please log in again.');
      } else {
        setAuthError("Couldn't load your Spotify profile. Please try logging in again.");
      }
    }
  }, [getToken, logout]);

  useEffect(() => {
    if (accessToken && !user) loadProfile();
  }, [accessToken]);

  return (
    <Ctx.Provider
      value={{
        user,
        authError,
        getToken,
        saveTokens,
        logout,
        retryProfile: loadProfile,
        isLoggedIn: !!accessToken,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSpotify() {
  return useContext(Ctx);
}
