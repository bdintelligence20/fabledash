# Google Cloud Platform (GCP) Trigger Setup

This document explains how to set up Cloud Build triggers in Google Cloud Platform for deploying both the frontend and backend of the FableDash application.

## Prerequisites

1. A Google Cloud Platform account
2. A GCP project with billing enabled
3. The following APIs enabled:
   - Cloud Build API
   - Cloud Run API
   - App Engine API
   - Container Registry API
   - Cloud Storage API

## Setting Up the Backend Trigger

### 1. Navigate to Cloud Build

1. Go to the Google Cloud Console: https://console.cloud.google.com/
2. Select your project
3. In the navigation menu, go to "Cloud Build" > "Triggers"

### 2. Create a New Trigger

1. Click "Create Trigger"
2. Fill in the following details:
   - **Name**: `fabledash-backend-deploy`
   - **Description**: `Deploy FableDash Python backend to Cloud Run`
   - **Event**: Choose "Push to a branch"
   - **Repository**: Connect to your GitHub/Bitbucket/GitLab repository
   - **Branch**: `^main$` (or your preferred branch using regex)
   - **Included files filter**: `python-backend/**` (only trigger when files in the python-backend directory change)
   - **Build configuration**: "Cloud Build configuration file (yaml or json)"
   - **Cloud Build configuration file location**: `python-backend/cloudbuild.yaml`
   - **Service account**: Use the default Cloud Build service account or a custom one with appropriate permissions

### 3. Set Substitution Variables

Click "Add variable" to add the following substitution variables:

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `_SUPABASE_URL` | Your Supabase project URL | `https://your-project.supabase.co` |
| `_SUPABASE_KEY` | Your Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `_OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `_CORS_ORIGINS` | Comma-separated list of allowed origins | `https://fabledash-frontend-dot-your-project-id.uc.r.appspot.com` |

### 4. Set Service Account Permissions

Ensure the service account used by Cloud Build has the following roles:
- Cloud Run Admin
- Service Account User
- Storage Admin

## Setting Up the Frontend Trigger

### 1. Create a New Trigger

1. Click "Create Trigger"
2. Fill in the following details:
   - **Name**: `fabledash-frontend-deploy`
   - **Description**: `Deploy FableDash React frontend to App Engine`
   - **Event**: Choose "Push to a branch"
   - **Repository**: Same repository as the backend
   - **Branch**: `^main$` (or your preferred branch using regex)
   - **Included files filter**: `src/**` or `public/**` or `package.json` or `vite.config.ts` (only trigger when frontend files change)
   - **Excluded files filter**: `python-backend/**` (don't trigger on backend changes)
   - **Build configuration**: "Cloud Build configuration file (yaml or json)"
   - **Cloud Build configuration file location**: `cloudbuild.yaml` (root directory)
   - **Service account**: Use the default Cloud Build service account or a custom one with appropriate permissions

### 2. Set Substitution Variables

Click "Add variable" to add the following substitution variables:

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `_API_URL` | URL of the backend API | `https://fabledash-backend-xxxxxxxx-uc.a.run.app` |
| `_SUPABASE_URL` | Your Supabase project URL | `https://your-project.supabase.co` |
| `_SUPABASE_KEY` | Your Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### 3. Set Service Account Permissions

Ensure the service account used by Cloud Build has the following roles:
- App Engine Admin
- Service Account User
- Storage Admin

## Trigger Order and Dependencies

For the initial deployment, you should:

1. Deploy the backend first
2. Once the backend is deployed, get the Cloud Run URL
3. Update the frontend trigger's `_API_URL` variable with the backend URL
4. Deploy the frontend

For subsequent deployments, the triggers will work independently based on which files change.

## Testing the Triggers

After setting up the triggers:

1. Make a small change to a file in the python-backend directory
2. Commit and push the change to your repository
3. Go to Cloud Build > History to see if the backend trigger fired
4. Make a small change to a file in the src directory
5. Commit and push the change to your repository
6. Go to Cloud Build > History to see if the frontend trigger fired

## Troubleshooting

### Common Issues

1. **Trigger not firing**: Check the included/excluded files filters
2. **Build failing**: Check the Cloud Build logs for error messages
3. **Deployment failing**: Ensure the service account has the necessary permissions
4. **Environment variables not working**: Verify the substitution variables are correctly set in the trigger

### Viewing Logs

1. Go to Cloud Build > History
2. Click on the build that failed
3. Click on the step that failed to see the logs

## Updating Trigger Settings

You can update trigger settings at any time:

1. Go to Cloud Build > Triggers
2. Click on the trigger you want to update
3. Make your changes
4. Click "Save"

## Automatic Rollbacks

If a deployment fails, you can set up automatic rollbacks:

1. Go to Cloud Run > Services > fabledash-backend
2. Click "Edit & Deploy New Revision"
3. Under "Rollbacks", enable "Automatic rollbacks"
4. Click "Deploy"

Do the same for the App Engine service.
