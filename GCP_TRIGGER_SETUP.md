# Google Cloud Platform (GCP) Trigger Setup

This document explains how to set up Cloud Build triggers in Google Cloud Platform for deploying both the frontend and backend of the FableDash application to Cloud Run.

## Prerequisites

1. A Google Cloud Platform account
2. A GCP project with billing enabled
3. The following APIs enabled:
   - Cloud Build API
   - Cloud Run API
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
   - **Cloud Build configuration file location**: `backend-cloudbuild.yaml` (in the root directory)
   - **Service account**: Use the default Cloud Build service account or a custom one with appropriate permissions

### 3. Set Substitution Variables

Click "Add variable" to add the following substitution variables:

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `_SUPABASE_URL` | Your Supabase project URL | `https://your-project.supabase.co` |
| `_SUPABASE_KEY` | Your Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `_OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `_CORS_ORIGINS` | Comma-separated list of allowed origins | `https://fabledash-frontend-xxxxxxxx-uc.a.run.app` |

### 4. Set Service Account Permissions

Ensure the service account used by Cloud Build has the following roles:
- Cloud Run Admin
- Service Account User
- Storage Admin
- Security Admin (needed to set IAM policies)

To add these roles to your Cloud Build service account:

1. Go to IAM & Admin > IAM in the Google Cloud Console
2. Find the Cloud Build service account (usually named `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`)
3. Click the pencil icon to edit the permissions
4. Click "Add another role" and add each of the roles listed above
5. Click "Save"

Without the Security Admin role, the automatic IAM policy binding in the cloudbuild.yaml files will fail, but the deployment will still succeed with a warning.

## Setting Up the Frontend Trigger

### 1. Create a New Trigger

1. Click "Create Trigger"
2. Fill in the following details:
   - **Name**: `fabledash-frontend-deploy`
   - **Description**: `Deploy FableDash React frontend to Cloud Run`
   - **Event**: Choose "Push to a branch"
   - **Repository**: Same repository as the backend
   - **Branch**: `^main$` (or your preferred branch using regex)
   - **Included files filter**: `src/**` or `public/**` or `package.json` or `vite.config.ts` (only trigger when frontend files change)
   - **Excluded files filter**: `python-backend/**` (don't trigger on backend changes)
   - **Build configuration**: "Cloud Build configuration file (yaml or json)"
   - **Cloud Build configuration file location**: `frontend-cloudbuild.yaml` (root directory)
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
- Cloud Run Admin
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
5. **"Forbidden" error when accessing the service**: Check the IAM permissions for the Cloud Run service

### Viewing Logs

1. Go to Cloud Build > History
2. Click on the build that failed
3. Click on the step that failed to see the logs

### Fixing "Forbidden" Errors

The cloudbuild.yaml files have been updated to automatically set the IAM permissions to allow public access to the Cloud Run services. This is done using the `gcloud run services add-iam-policy-binding` command in the deployment step.

If you still encounter a "Forbidden" error when accessing your Cloud Run service, you can manually set the permissions:

1. Go to the Cloud Run service in the Google Cloud Console
2. Click on the service name (e.g., `fabledash-frontend` or `fabledash-backend`)
3. Go to the "Permissions" tab
4. Click "Add Principal" and add the following:
   - **New Principal**: `allUsers`
   - **Role**: `Cloud Run Invoker`
5. Click "Save"

This will make your Cloud Run service publicly accessible. If you need more restricted access, you can use Identity-Aware Proxy (IAP) or other authentication methods.

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

Do the same for the fabledash-frontend Cloud Run service.

## Important Notes About Deployment

### Backend Deployment

The backend deployment uses a special configuration:

1. We use `backend-cloudbuild.yaml` in the root directory (not inside python-backend)
2. This file is configured to build the Docker image using the correct context: `./python-backend`
3. The backend application must listen on port 8080, which is the default port for Cloud Run
4. This approach solves common issues with Cloud Build triggers:
   - It ensures the Docker build has the correct context
   - It avoids path confusion when running from the repository root
   - It prevents "file not found" errors during the build process

If you encounter build errors like "Could not find Dockerfile" or "Context directory does not exist", make sure:
1. The `backend-cloudbuild.yaml` file is in the root directory
2. The Docker build command uses `./python-backend` as the context
3. The trigger is configured to use `backend-cloudbuild.yaml` (not `python-backend/cloudbuild.yaml`)

If you encounter runtime errors or the service fails to start, check:
1. The application is listening on port 8080 (Cloud Run's default port)
2. The environment variables are correctly set in the Cloud Run service
3. The Supabase credentials are valid and properly formatted

### Frontend Deployment

The frontend deployment also uses Cloud Run instead of App Engine:

1. We build the React app with Vite and then serve it using Nginx in a Docker container
2. The `frontend-cloudbuild.yaml` file handles:
   - Installing dependencies
   - Building the React app
   - Building a Docker image with Nginx to serve the static files
   - Deploying to Cloud Run
3. This approach has several advantages:
   - No need to enable the App Engine API
   - Consistent deployment platform for both frontend and backend
   - Better scalability and cost control with Cloud Run's scale-to-zero capability
   - Simplified configuration and deployment process

The frontend Docker setup includes:
1. `Dockerfile.frontend` - Configures the Nginx container to serve the static files
2. `nginx.conf` - Configures Nginx to handle SPA routing and static file serving

This setup ensures that both the frontend and backend are deployed to Cloud Run, making it easier to manage and monitor the entire application.
