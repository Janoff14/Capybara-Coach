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
import { useQueryClient } from "@tanstack/react-query";

import { api, isAuthenticationError } from "@/lib/api";
import type { AuthUser, TokenResponse } from "@/lib/types";

type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
  authError: string | null;
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
  authError: string | null;
};

type AuthAction =
  | { type: "authenticate"; payload: TokenResponse }
  | { type: "logout" }
  | { type: "loading"; token: string }
  | { type: "unavailable"; token: string; message: string }
  | { type: "user"; token: string; user: AuthUser };

const INITIAL_STATE: AuthState = {
  status: "loading",
  token: null,
  user: null,
  authError: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "authenticate":
      return {
        status: "authenticated",
        token: action.payload.access_token,
        user: action.payload.user,
        authError: null,
      };
    case "loading":
      return {
        ...state,
        status: "loading",
        token: action.token,
        authError: null,
      };
    case "user":
      return {
        status: "authenticated",
        token: action.token,
        user: action.user,
        authError: null,
      };
    case "unavailable":
      return {
        status: "unavailable",
        token: action.token,
        user: null,
        authError: action.message,
      };
    case "logout":
      return {
        status: "unauthenticated",
        token: null,
        user: null,
        authError: null,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [{ authError, status, token, user }, dispatch] = useReducer(
    authReducer,
    INITIAL_STATE,
  );

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    queryClient.clear();
    dispatch({ type: "logout" });
  }, [queryClient]);

  const authenticate = useCallback((payload: TokenResponse) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, payload.access_token);
    queryClient.clear();
    dispatch({ type: "authenticate", payload });
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const persistedToken = token ?? window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!persistedToken) {
      logout();
      return null;
    }

    dispatch({ type: "loading", token: persistedToken });

    try {
      const nextUser = await api.getMe(persistedToken);
      dispatch({ type: "user", token: persistedToken, user: nextUser });
      return nextUser;
    } catch (error) {
      if (isAuthenticationError(error)) {
        logout();
        return null;
      }

      dispatch({
        type: "unavailable",
        token: persistedToken,
        message:
          error instanceof Error
            ? error.message
            : "The study service is temporarily unavailable.",
      });
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
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAuthenticationError(error)) {
          logout();
          return;
        }

        dispatch({
          type: "unavailable",
          token: persistedToken,
          message:
            error instanceof Error
              ? error.message
              : "The study service is temporarily unavailable.",
        });
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
      authError,
      authenticate,
      logout,
      refreshUser,
    }),
    [authError, authenticate, logout, refreshUser, status, token, user],
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
