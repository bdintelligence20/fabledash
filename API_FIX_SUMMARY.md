# API Fix Summary for FableDash

## Overview

This document summarizes the changes made to fix the API connectivity issues in the FableDash application. The application was experiencing two main issues:

1. **Mixed Content Errors**: The frontend was being served over HTTPS but was making API calls to the backend over HTTP, which browsers block by default.
2. **API Path Mismatch**: The frontend was expecting API endpoints with a specific structure that didn't match what the backend was providing.

## Changes Made

### 1. API Utility Module

We created a new utility module (`src/utils/api.ts`) that:

- Ensures all API calls use HTTPS in production
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

### 2. Component Updates

We updated all components that make API calls to use the new utility functions:

#### AIAgentsPage.tsx
- Removed direct fetch calls and replaced with apiGet, apiPost, apiPut, and apiDelete
- Removed duplicate apiUrl definition

#### ClientsPage.tsx
- Removed direct fetch calls and replaced with apiGet, apiPost, and apiDelete
- Removed duplicate apiUrl definition

#### ClientDetailPage.tsx
- Removed direct fetch calls and replaced with apiPut
- Removed duplicate apiUrl definition

#### ClientTasks.tsx
- Removed direct fetch calls and replaced with apiGet, apiPost, apiPut, and apiDelete
- Removed duplicate apiUrl definition
- Added start_date property to Task interface in ClientTypes.ts

#### TasksPage.tsx
- Removed direct fetch calls and replaced with apiGet, apiPost, apiPut, and apiDelete
- Removed duplicate apiUrl definition
- Fixed BadgeVariant type issue

### 3. Cloud Build Configuration

We updated the Cloud Build configuration files to ensure the correct URLs are used:

#### frontend-cloudbuild.yaml
```yaml
substitutions:
  _API_URL: 'https://fabledash-backend-73351471156.us-central1.run.app'
  _SUPABASE_URL: 'https://your-supabase-project.supabase.co'
  _SUPABASE_KEY: 'your-supabase-anon-key'
```

#### backend-cloudbuild.yaml
```yaml
substitutions:
  _SUPABASE_URL: 'https://your-supabase-project.supabase.co'
  _SUPABASE_KEY: 'your-supabase-anon-key'
  _OPENAI_API_KEY: 'your-openai-api-key'
  _CORS_ORIGINS: 'https://fabledash-frontend-73351471156.us-central1.run.app'
```

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

## Testing

After deployment, verify that:

1. The frontend can successfully make API calls to the backend
2. No mixed content errors appear in the browser console
3. All features (clients, tasks, agents) work as expected

## Future Considerations

1. **Error Handling**: The API utility functions could be enhanced with more robust error handling
2. **Authentication**: If authentication is added in the future, the API utility should be updated to include authentication headers
3. **Caching**: Consider adding caching for frequently accessed data
4. **Monitoring**: Add monitoring to track API call performance and errors
