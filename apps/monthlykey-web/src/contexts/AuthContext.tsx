/**
 * AuthContext — MonthlyKey Authentication State
 *
 * Manages JWT token, user profile, and auth lifecycle.
 * Persists token in localStorage; user data refreshed on mount.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  preferred_locale: "ar" | "en";
  email: string;
  phone: string;
  phone_e164: string | null;
  role: string;
  zones: string[];
  verification_state: "PENDING_VERIFICATION" | "VERIFIED";
  email_verified: boolean;
  phone_verified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isPendingVerification: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setAuthData: (token: string, user: AuthUser) => void;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  preferred_locale: "ar" | "en";
  full_name_ar?: string;
  full_name_en?: string;
  email: string;
  phone_e164: string;
  password: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isPendingVerification: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
  setAuthData: () => {},
  refreshUser: async () => {},
});

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const TOKEN_KEY = "mk_token";
const USER_KEY = "mk_user";

// ─── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Persist changes
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  const setAuthData = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || "Login failed" };
        }
        setAuthData(data.token, data.user);
        return { success: true };
      } catch {
        return { success: false, error: "Network error" };
      }
    },
    [setAuthData],
  );

  const register = useCallback(
    async (body: RegisterData) => {
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || "Registration failed" };
        }
        setAuthData(data.token, data.user);
        return { success: true };
      } catch {
        return { success: false, error: "Network error" };
      }
    },
    [setAuthData],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const status = await res.json();
        setUser((prev) =>
          prev
            ? {
                ...prev,
                phone_verified: status.phone_verified,
                email_verified: status.email_verified,
                verification_state: status.verification_state,
              }
            : prev,
        );
      }
    } catch {
      // Silently fail — user data stays stale
    }
  }, [token]);

  const isAuthenticated = !!token && !!user;
  const isPendingVerification =
    isAuthenticated && user?.verification_state === "PENDING_VERIFICATION";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isPendingVerification,
        login,
        register,
        logout,
        setAuthData,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
