/**
 * API client with automatic Firebase auth token injection
 *
 * Every request automatically attaches the current user's Firebase ID token
 * as a Bearer token in the Authorization header. Supports JSON and FormData bodies.
 */

import { auth } from './firebase';
import { env } from '../config/env';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = {
    ...authHeaders,
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
  };

  const response = await fetch(`${env.API_URL}${endpoint}`, {
    method,
    headers,
    body: body
      ? isFormData
        ? (body as FormData)
        : JSON.stringify(body)
      : undefined,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    const message =
      errorData && typeof errorData === 'object' && 'detail' in errorData
        ? String((errorData as Record<string, unknown>).detail)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>('GET', endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>('POST', endpoint, body),
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>('PUT', endpoint, body),
  delete: <T>(endpoint: string) => request<T>('DELETE', endpoint),
};

export { ApiError };
export default apiClient;
