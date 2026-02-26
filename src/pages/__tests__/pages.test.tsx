/**
 * Page smoke tests
 *
 * Verifies every page renders without crashing and shows key content.
 * All API calls and Firebase are mocked.
 */

import { render, screen, act } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../../contexts/AuthContext';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

// Mock firebase
vi.mock('../../lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token'),
    },
  },
  firestore: {},
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
}));

// Mock firebase/app
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

// Mock api client
vi.mock('../../lib/api', () => {
  // Smart mock: returns appropriate data for known endpoints,
  // rejects others so pages fall through to error handling.
  function mockGet(endpoint: string) {
    // Simple list endpoints - return arrays
    if (
      endpoint === '/clients' ||
      endpoint.startsWith('/clients?') ||
      endpoint === '/tasks' ||
      endpoint.startsWith('/tasks?') ||
      endpoint === '/time-logs/' ||
      endpoint.startsWith('/time-logs?') ||
      endpoint === '/time-logs'
    ) {
      return Promise.resolve({ success: true, data: [] });
    }
    // Allocation endpoint
    if (endpoint.includes('/allocation')) {
      return Promise.resolve({
        success: true,
        data: {
          total_hours: 0,
          groups: [],
          date_from: '2024-01-01',
          date_to: '2024-01-31',
        },
      });
    }
    // Utilization endpoint
    if (endpoint.includes('/utilization')) {
      return Promise.resolve({
        success: true,
        data: {
          utilization: {
            total_logged_hours: 0,
            billable_hours: 0,
            non_billable_hours: 0,
            utilization_pct: 0,
            target_hours: 160,
          },
          daily_trend: [],
          by_client: [],
          date_from: '2024-01-01',
          date_to: '2024-01-31',
        },
      });
    }
    // OpsAI alerts
    if (endpoint.includes('/opsai/alerts')) {
      return Promise.resolve({
        success: true,
        data: {
          alerts: [],
          summary: { total: 0, high: 0, medium: 0 },
        },
      });
    }
    // OpsAI conversations and chat
    if (endpoint.includes('/opsai')) {
      return Promise.resolve({ success: true, data: { conversations: [], messages: [], response: '' } });
    }
    // For all other endpoints (financial-data, reports, integrations, sage, etc.)
    // reject so pages stay in their loading/null/error state
    return Promise.reject(new Error('Mock: endpoint not configured'));
  }

  const mockApiClient = {
    get: vi.fn().mockImplementation(mockGet),
    post: vi.fn().mockResolvedValue({ success: true, data: {} }),
    put: vi.fn().mockResolvedValue({ success: true, data: {} }),
    delete: vi.fn().mockResolvedValue({ success: true, data: {} }),
  };
  return {
    apiClient: mockApiClient,
    default: mockApiClient,
    ApiError: class ApiError extends Error {
      status: number;
      data?: unknown;
      constructor(msg: string, status: number, data?: unknown) {
        super(msg);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
      }
    },
  };
});

// Mock date-fns format
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Wednesday, 1 Jan 2025'),
}));

// ---------------------------------------------------------------------------
// Auth wrapper
// ---------------------------------------------------------------------------

const mockUser = {
  uid: 'test-uid',
  email: 'test@fable.co',
  displayName: 'Test User',
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
} as unknown as import('firebase/auth').User;

const authValue: AuthContextType = {
  user: mockUser,
  loading: false,
  error: null,
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
};

const unauthValue: AuthContextType = {
  user: null,
  loading: false,
  error: null,
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getIdToken: vi.fn().mockResolvedValue(null),
};

function renderPage(Page: React.ComponentType, auth = authValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Page />
      </BrowserRouter>
    </AuthContext.Provider>,
  );
}

function renderPageWithParams(
  Page: React.ComponentType,
  path: string,
  routePath: string,
  auth = authValue,
) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={<Page />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Import all pages
// ---------------------------------------------------------------------------

import LoginPage from '../LoginPage';
import DashboardPage from '../DashboardPage';
import ClientsPage from '../ClientsPage';
import ClientDetailPage from '../ClientDetailPage';
import TasksPage from '../TasksPage';
import TaskDetailPage from '../TaskDetailPage';
import TimePage from '../TimePage';
import TimeLogListPage from '../TimeLogListPage';
import TimeAllocationPage from '../TimeAllocationPage';
import UtilizationPage from '../UtilizationPage';
import FinancesPage from '../FinancesPage';
import FinancialOverviewPage from '../FinancialOverviewPage';
import RevenueTrackingPage from '../RevenueTrackingPage';
import CostBenefitPage from '../CostBenefitPage';
import CashPositionPage from '../CashPositionPage';
import VolumeRatePage from '../VolumeRatePage';
import MeetingsPage from '../MeetingsPage';
import MeetingDetailPage from '../MeetingDetailPage';
import AgentsPage from '../AgentsPage';
import AgentDetailPage from '../AgentDetailPage';
import AgentChatPage from '../AgentChatPage';
import OpsAIPage from '../OpsAIPage';
import ReportsPage from '../ReportsPage';
import HealthReportPage from '../HealthReportPage';
import ComparisonReportPage from '../ComparisonReportPage';
import IntegrationsPage from '../IntegrationsPage';
import NotFoundPage from '../NotFoundPage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
  it('renders login form', async () => {
    await act(async () => {
      renderPage(LoginPage, unauthValue);
    });
    expect(screen.getByText('FableDash')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('renders email and password fields', async () => {
    await act(async () => {
      renderPage(LoginPage, unauthValue);
    });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});

describe('DashboardPage', () => {
  it('renders dashboard heading', async () => {
    await act(async () => {
      renderPage(DashboardPage);
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders welcome message', async () => {
    await act(async () => {
      renderPage(DashboardPage);
    });
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });
});

describe('ClientsPage', () => {
  it('renders page heading', async () => {
    await act(async () => {
      renderPage(ClientsPage);
    });
    expect(screen.getByText('Clients')).toBeInTheDocument();
  });

  it('renders New Client button', async () => {
    await act(async () => {
      renderPage(ClientsPage);
    });
    expect(screen.getByText('New Client')).toBeInTheDocument();
  });
});

describe('ClientDetailPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPageWithParams(ClientDetailPage, '/clients/123', '/clients/:id');
    });
    // Should render something (loading or content)
    expect(document.body).toBeTruthy();
  });
});

describe('TasksPage', () => {
  it('renders page heading', async () => {
    await act(async () => {
      renderPage(TasksPage);
    });
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('renders New Task button', async () => {
    await act(async () => {
      renderPage(TasksPage);
    });
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });
});

describe('TaskDetailPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPageWithParams(TaskDetailPage, '/tasks/123', '/tasks/:id');
    });
    expect(document.body).toBeTruthy();
  });
});

describe('TimePage', () => {
  it('renders page heading', async () => {
    await act(async () => {
      renderPage(TimePage);
    });
    expect(screen.getByText('Time Tracking')).toBeInTheDocument();
  });

  it('renders manual entry section', async () => {
    await act(async () => {
      renderPage(TimePage);
    });
    expect(screen.getByText('Manual Entry')).toBeInTheDocument();
  });
});

describe('TimeLogListPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(TimeLogListPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('TimeAllocationPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(TimeAllocationPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('UtilizationPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(UtilizationPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('FinancesPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(FinancesPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('FinancialOverviewPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(FinancialOverviewPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('RevenueTrackingPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(RevenueTrackingPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('CostBenefitPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(CostBenefitPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('CashPositionPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(CashPositionPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('VolumeRatePage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(VolumeRatePage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('MeetingsPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(MeetingsPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('MeetingDetailPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPageWithParams(MeetingDetailPage, '/meetings/123', '/meetings/:id');
    });
    expect(document.body).toBeTruthy();
  });
});

describe('AgentsPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(AgentsPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('AgentDetailPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPageWithParams(AgentDetailPage, '/agents/123', '/agents/:id');
    });
    expect(document.body).toBeTruthy();
  });
});

describe('AgentChatPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPageWithParams(AgentChatPage, '/agents/123/chat', '/agents/:id/chat');
    });
    expect(document.body).toBeTruthy();
  });
});

describe('OpsAIPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(OpsAIPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('ReportsPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(ReportsPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('HealthReportPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(HealthReportPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('ComparisonReportPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(ComparisonReportPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('IntegrationsPage', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderPage(IntegrationsPage);
    });
    expect(document.body).toBeTruthy();
  });
});

describe('NotFoundPage', () => {
  it('renders 404 text', async () => {
    await act(async () => {
      renderPage(NotFoundPage);
    });
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders Page Not Found message', async () => {
    await act(async () => {
      renderPage(NotFoundPage);
    });
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('renders quick links', async () => {
    await act(async () => {
      renderPage(NotFoundPage);
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('OpsAI')).toBeInTheDocument();
  });

  it('renders Go Back button', async () => {
    await act(async () => {
      renderPage(NotFoundPage);
    });
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });
});
