# HTTPS Fix for FableDash

## Problem

The FableDash application was experiencing issues with mixed content when deployed to Google Cloud Run. The frontend was being served over HTTPS, but it was trying to make API calls to the backend over HTTP, which modern browsers block by default.

The error message in the browser console was:

```
Mixed Content: The page at 'https://fabledash-frontend-73351471156.us-central1.run.app/' was loaded over HTTPS, but requested an insecure resource 'http://fabledash-backend-73351471156.us-central1.run.app/...'. This request has been blocked; the content must be served over HTTPS.
```

## Solution

We implemented a two-part solution to fix this issue:

### 1. API Utility Module

We created a new utility module (`src/utils/api.ts`) that ensures all API calls use HTTPS in production, even if the environment variable is set to HTTP. This utility:

- Automatically converts HTTP URLs to HTTPS
- Provides standardized functions for API calls (GET, POST, PUT, DELETE)
- Centralizes error handling

```typescript
// src/utils/api.ts
export const apiUrl = (() => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // In production, ensure HTTPS is used
  if (import.meta.env.PROD && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  return url;
})();

export const apiGet = async (endpoint: string) => {
  const response = await fetch(`${apiUrl}${endpoint}`);
  return await response.json();
};

export const apiPost = async (endpoint: string, data: any) => {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

export const apiPut = async (endpoint: string, data: any) => {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

export const apiDelete = async (endpoint: string) => {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'DELETE',
  });
  return await response.json();
};
```

### 2. Updated Components

We updated all components that make API calls to use the new utility functions:

- `AIAgentsPage.tsx`
- `ClientsPage.tsx`
- `ClientDetailPage.tsx`
- `ClientTasks.tsx`
- `TasksPage.tsx`

### 3. Cloud Build Configuration

We updated the Cloud Build configuration files to ensure the correct URLs are used:

- `frontend-cloudbuild.yaml`: Updated the `_API_URL` substitution variable to use HTTPS
- `backend-cloudbuild.yaml`: Updated the `_CORS_ORIGINS` substitution variable to include the frontend URL

## Deployment Instructions

1. **Update the Cloud Build Service Account Permissions**:
   - Add the "Security Admin" role to your Cloud Build service account to allow it to set IAM policies

2. **Deploy the Backend First**:
   ```
   gcloud builds submit --config=backend-cloudbuild.yaml
   ```

3. **Deploy the Frontend**:
   ```
   gcloud builds submit --config=frontend-cloudbuild.yaml
   ```

## Troubleshooting

If you still encounter mixed content errors:

1. Check the browser console for specific error messages
2. Verify that the API URL in the frontend build is using HTTPS
3. Ensure the CORS settings in the backend allow requests from the frontend domain
4. Check that the Cloud Run services are properly configured to allow unauthenticated access
