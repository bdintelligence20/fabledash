# Mixed Content Error Fix

## The Problem

Your frontend is being served over HTTPS, but it's trying to access the backend API over HTTP. This is causing mixed content errors in the browser, which blocks the requests for security reasons.

Error message:
```
Mixed Content: The page at 'https://fabledash-frontend-73351471156.us-central1.run.app/' was loaded over HTTPS, but requested an insecure resource 'http://fabledash-backend-73351471156.us-central1.run.app/tasks/'. This request has been blocked; the content must be served over HTTPS.
```

## The Solution

You need to update the `_API_URL` environment variable in your Cloud Build trigger to use HTTPS instead of HTTP.

### Steps to Fix:

1. **Go to Cloud Build > Triggers** in the Google Cloud Console
2. **Find your frontend trigger** (likely named `fabledash-frontend-deploy`)
3. **Click on the trigger** to edit it
4. **Scroll down to the Substitution variables** section
5. **Update the `_API_URL` variable** to use HTTPS:
   ```
   _API_URL: https://fabledash-backend-73351471156.us-central1.run.app
   ```
   Make sure it starts with `https://` and not `http://`
6. **Click Save**
7. **Run the trigger** to rebuild and redeploy your frontend

## Additional Recommendations

1. **Ensure your backend is properly configured for HTTPS**:
   - Cloud Run services are automatically configured with HTTPS
   - Make sure your backend is not redirecting to HTTP

2. **Update your local development environment**:
   - If you're using a local `.env` file, make sure it also uses HTTPS for the API URL

3. **Consider adding a fallback in your code**:
   - You could modify your frontend code to automatically use HTTPS even if the environment variable is set to HTTP:

   ```javascript
   // In your API utility file or component
   const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
   
   // Ensure HTTPS is used in production
   const secureApiUrl = apiUrl.replace(/^http:\/\//i, 'https://');
   ```

This should resolve the mixed content errors and allow your frontend to communicate with your backend properly.
