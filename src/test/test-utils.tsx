/**
 * Test utilities for FableDash
 *
 * Custom render function, mock providers, and test data factories.
 */

import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../contexts/AuthContext';

/* -------------------------------------------------------------------------- */
/*  Default mock auth context                                                  */
/* -------------------------------------------------------------------------- */

export const mockUser = {
  uid: 'test-uid-123',
  email: 'test@fable.co',
  displayName: 'Test User',
  getIdToken: vi.fn().mockResolvedValue('mock-token-abc'),
} as unknown as import('firebase/auth').User;

export const defaultAuthContext: AuthContextType = {
  user: mockUser,
  loading: false,
  error: null,
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getIdToken: vi.fn().mockResolvedValue('mock-token-abc'),
};

/* -------------------------------------------------------------------------- */
/*  AllProviders wrapper                                                       */
/* -------------------------------------------------------------------------- */

interface ProvidersProps {
  children: ReactNode;
  authOverrides?: Partial<AuthContextType>;
}

function AllProviders({ children, authOverrides }: ProvidersProps) {
  const authValue = { ...defaultAuthContext, ...authOverrides };
  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter>{children}</BrowserRouter>
    </AuthContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom render                                                              */
/* -------------------------------------------------------------------------- */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authOverrides?: Partial<AuthContextType>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {},
) {
  const { authOverrides, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AllProviders authOverrides={authOverrides}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

/* -------------------------------------------------------------------------- */
/*  Mock API helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Create a mock apiClient that resolves with the given data.
 * Usage: vi.mock('../lib/api', () => mockApiModule({ data: [...] }))
 */
export function createMockApiResponse<T>(data: T) {
  return { success: true, data };
}

/* -------------------------------------------------------------------------- */
/*  Test data factories                                                        */
/* -------------------------------------------------------------------------- */

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `test-id-${idCounter}`;
}

export function createClient(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    name: 'Acme Corp',
    partner_group: 'collab',
    contact_email: 'acme@example.com',
    contact_phone: '+27 123 456 789',
    description: 'A test client',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'test-uid-123',
    ...overrides,
  };
}

export function createTask(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    title: 'Test Task',
    description: 'A test task description',
    client_id: 'client-1',
    status: 'todo' as const,
    priority: 'medium' as const,
    due_date: '2024-06-01',
    assigned_to: null,
    comments: [],
    attachments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'test-uid-123',
    ...overrides,
  };
}

export function createTimeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    date: '2024-06-01',
    client_id: 'client-1',
    task_id: null,
    description: 'Working on tests',
    start_time: '09:00',
    end_time: '10:30',
    duration_minutes: 90,
    is_billable: true,
    ...overrides,
  };
}

export function createAlert(overrides: Record<string, unknown> = {}) {
  return {
    type: 'over_servicing',
    severity: 'high' as const,
    message: 'Client X is being over-serviced',
    entity_id: 'entity-1',
    client_id: 'client-1',
    ...overrides,
  };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
