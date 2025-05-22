/// <reference types="vite/client" />

interface Window {
  ENV?: {
    API_URL?: string;
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
    // Add other environment variables here if needed
  };
}
