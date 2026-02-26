/**
 * API client tests
 *
 * We mock firebase and fetch to test the apiClient independently.
 */

// Mock firebase before importing api
vi.mock('../firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-firebase-token'),
    },
  },
}));

// Mock env
vi.mock('../../config/env', () => ({
  env: {
    API_URL: 'https://api.test.com',
  },
}));

import { apiClient, ApiError } from '../api';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds correct URL for GET request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiClient.get('/clients');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/clients',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('includes auth token in Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiClient.get('/test');

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBe('Bearer mock-firebase-token');
  });

  it('includes Content-Type JSON header for non-FormData', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiClient.post('/test', { name: 'test' });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['Content-Type']).toBe('application/json');
  });

  it('sends JSON body for POST', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const body = { name: 'test', value: 42 };
    await apiClient.post('/test', body);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].body).toBe(JSON.stringify(body));
  });

  it('uses PUT method', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiClient.put('/test/1', { name: 'updated' });

    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
  });

  it('uses DELETE method', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiClient.delete('/test/1');

    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('throws ApiError on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Not found' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiClient.get('/missing')).rejects.toThrow(ApiError);
  });

  it('ApiError includes status code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: 'Validation error' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await apiClient.get('/bad');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(422);
      expect((err as ApiError).message).toBe('Validation error');
    }
  });

  it('handles non-JSON error responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('Internal Server Error'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiClient.get('/error')).rejects.toThrow(ApiError);
  });
});
