/**
 * API utility functions for making HTTP requests to the backend
 */

// Get the API URL from environment variables or use localhost for development
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Ensure HTTPS is used in production
export const apiUrl = rawApiUrl.replace(/^http:\/\//i, 'https://');

/**
 * Make a GET request to the API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @returns Promise with the JSON response
 */
export const apiGet = async (endpoint: string) => {
  try {
    const response = await fetch(`${apiUrl}${endpoint}`);
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
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
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
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
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
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
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
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
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
