"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";
import type { AuthUser, TokenResponse } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
  authenticate: (payload: TokenResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
};

const AUTH_STORAGE_KEY = "capybara-coach/access-token";
const AuthContext = createContext<AuthContextValue | null>(null);

type AuthState = {
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
};

type AuthAction =
  | { type: "authenticate"; payload: TokenResponse }
  | { type: "logout" }
  | { type: "loading"; token: string }
  | { type: "user"; token: string; user: AuthUser };

const INITIAL_STATE: AuthState = {
  status: "loading",
  token: null,
  user: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "authenticate":
      return {
        status: "authenticated",
        token: action.payload.access_token,
        user: action.payload.user,
      };
    case "loading":
      return {
        ...state,
        status: "loading",
        token: action.token,
      };
    case "user":
      return {
        status: "authenticated",
        token: action.token,
        user: action.user,
      };
    case "logout":
      return {
        status: "unauthenticated",
        token: null,
        user: null,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ status, token, user }, dispatch] = useReducer(
    authReducer,
    INITIAL_STATE,
  );

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    dispatch({ type: "logout" });
  }, []);

  const authenticate = useCallback((payload: TokenResponse) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, payload.access_token);
    dispatch({ type: "authenticate", payload });
  }, []);

  const refreshUser = useCallback(async () => {
    const persistedToken = token ?? window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!persistedToken) {
      logout();
      return null;
    }

    try {
      const nextUser = await api.getMe(persistedToken);
      dispatch({ type: "user", token: persistedToken, user: nextUser });
      return nextUser;
    } catch {
      logout();
      return null;
    }
  }, [logout, token]);

  useEffect(() => {
    const persistedToken = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!persistedToken) {
      dispatch({ type: "logout" });
      return;
    }

    dispatch({ type: "loading", token: persistedToken });

    let isActive = true;

    const hydrate = async () => {
      try {
        const nextUser = await api.getMe(persistedToken);
        if (!isActive) {
          return;
        }
        dispatch({ type: "user", token: persistedToken, user: nextUser });
      } catch {
        if (!isActive) {
          return;
        }
        logout();
      }
    };

    void hydrate();

    return () => {
      isActive = false;
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      user,
      authenticate,
      logout,
      refreshUser,
    }),
    [authenticate, logout, refreshUser, status, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
