import { render, screen, act } from '@testing-library/react';
import { AuthProvider, AuthContext } from '../AuthContext';
import { useContext } from 'react';

// Mock firebase
vi.mock('../../lib/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
  },
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    // Simulate firebase initializing with no user
    callback(null);
    return vi.fn(); // unsubscribe
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

function AuthConsumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div>No context</div>;
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user">{ctx.user ? 'authenticated' : 'unauthenticated'}</span>
      <span data-testid="error">{ctx.error || 'none'}</span>
      <button onClick={() => ctx.login('test@test.com', 'pass')}>Login</button>
      <button onClick={() => ctx.logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  it('provides auth state to children', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('user')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('renders children', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <div>Child content</div>
        </AuthProvider>,
      );
    });
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('initializes with loading false after auth check', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });
    // After onAuthStateChanged callback fires, loading should be false
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('provides login function', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('provides logout function', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('context is null when no provider', () => {
    render(<AuthConsumer />);
    expect(screen.getByText('No context')).toBeInTheDocument();
  });
});
