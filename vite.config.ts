import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  // FIX: Load VITE_ prefixed variables from .env file
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose environment variables to the client-side code
      // This makes process.env.API_KEY available in the app
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    }
  }
})
