/**
 * API utility functions for making HTTP requests to the backend
 */

// Determine API URL: Prioritize runtime ENV, then build-time ENV, then hardcoded default
// Ensure window.ENV is checked safely as it's injected at runtime
const runtimeApiUrl = typeof window !== 'undefined' && window.ENV && window.ENV.API_URL ? window.ENV.API_URL : null;
const buildtimeApiUrl = process.env.VITE_API_URL;
const defaultApiUrl = 'https://fabledash-backend-73351471156.us-central1.run.app'; // Fallback

export const apiUrl = runtimeApiUrl || buildtimeApiUrl || defaultApiUrl;

// Log the API URL and its source for debugging
if (runtimeApiUrl) {
  console.log('Using runtime API URL (from env-config.js):', apiUrl);
} else if (buildtimeApiUrl) {
  console.log('Using build-time API URL (from Vite .env):', apiUrl);
} else {
  console.log('Using default hardcoded API URL:', apiUrl);
}
console.log('Final API URL being used:', apiUrl);

/**
 * Make a GET request to the API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @returns Promise with the JSON response
 */
export const apiGet = async (endpoint: string) => {
  const fullUrl = `${apiUrl}${endpoint}`;
  console.log(`apiGet: Attempting to fetch ${fullUrl} (derived from apiUrl: ${apiUrl})`);
  try {
    const response = await fetch(fullUrl);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};

/**
 * Make a POST request to the API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @param data - The data to send in the request body
 * @returns Promise with the JSON response
 */
export const apiPost = async (endpoint: string, data: any) => {
  const fullUrl = `${apiUrl}${endpoint}`;
  console.log(`apiPost: Attempting to fetch ${fullUrl} (derived from apiUrl: ${apiUrl})`);
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.error(`Error posting to ${endpoint}:`, error);
    throw error;
  }
};

/**
 * Make a PUT request to the API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @param data - The data to send in the request body
 * @returns Promise with the JSON response
 */
export const apiPut = async (endpoint: string, data: any) => {
  const fullUrl = `${apiUrl}${endpoint}`;
  console.log(`apiPut: Attempting to fetch ${fullUrl} (derived from apiUrl: ${apiUrl})`);
  try {
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.error(`Error putting to ${endpoint}:`, error);
    throw error;
  }
};

/**
 * Make a DELETE request to the API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @returns Promise with the JSON response
 */
export const apiDelete = async (endpoint: string) => {
  const fullUrl = `${apiUrl}${endpoint}`;
  console.log(`apiDelete: Attempting to fetch ${fullUrl} (derived from apiUrl: ${apiUrl})`);
  try {
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error(`Error deleting ${endpoint}:`, error);
    throw error;
  }
};

/**
 * Upload a file to the API using FormData
 * @param endpoint - The API endpoint to call (without the base URL)
 * @param formData - The FormData object containing the file and other data
 * @returns Promise with the JSON response
 */
export const apiUploadFile = async (endpoint: string, formData: FormData) => {
  const fullUrl = `${apiUrl}${endpoint}`;
  console.log(`apiUploadFile: Attempting to fetch ${fullUrl} (derived from apiUrl: ${apiUrl})`);
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      body: formData,
    });
    return await response.json();
  } catch (error) {
    console.error(`Error uploading to ${endpoint}:`, error);
    throw error;
  }
};

export default {
  apiUrl,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUploadFile,
};
