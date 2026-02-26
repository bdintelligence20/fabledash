import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

// Mock firebase before anything imports it
vi.mock('../../lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
}));

import { useAuth } from '../useAuth';
import { AuthContext, type AuthContextType } from '../../contexts/AuthContext';

function createWrapper(value: AuthContextType) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
  };
}

describe('useAuth', () => {
  it('returns auth context values', () => {
    const mockAuth: AuthContextType = {
      user: null,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      getIdToken: vi.fn(),
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockAuth),
    });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.getIdToken).toBe('function');
  });

  it('throws when used outside AuthProvider', () => {
    // Suppress the error boundary console noise
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    vi.restoreAllMocks();
  });

  it('returns user when authenticated', () => {
    const mockUser = { uid: 'test-123', email: 'test@fable.co' } as import('firebase/auth').User;
    const mockAuth: AuthContextType = {
      user: mockUser,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      getIdToken: vi.fn(),
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockAuth),
    });

    expect(result.current.user?.uid).toBe('test-123');
    expect(result.current.user?.email).toBe('test@fable.co');
  });
});
