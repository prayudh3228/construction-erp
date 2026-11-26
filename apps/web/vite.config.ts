import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// In Docker the API is reachable as http://api:3000; locally as http://localhost:3000.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig(({ mode }) => {
  // Demo mode (fake data, one-click demo sign-in) is on for dev and tests unless set otherwise,
  // and OFF for production builds unless VITE_DEMO_MODE=true is passed (the local Docker stack
  // does pass it). See src/lib/env.ts.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const demoMode = env.VITE_DEMO_MODE ?? (mode === 'production' ? 'false' : 'true');

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // Tests get the flag as a real env value (below) so a test can switch it with vi.stubEnv.
    define: mode === 'test' ? {} : { 'import.meta.env.VITE_DEMO_MODE': JSON.stringify(demoMode) },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
    preview: { port: 4173, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test-setup.ts'],
      env: { VITE_DEMO_MODE: demoMode },
    },
  };
});
