import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// DEPLOY_TARGET env var controls base path:
//   DEPLOY_TARGET=github  -> base '/LIfeliNE/' (GitHub Pages subpath)
//   DEPLOY_TARGET=vercel  -> base '/'          (Vercel root)
//   (default)             -> base './'         (local dev, relative)
const isGitHubPages = process.env.DEPLOY_TARGET === 'github';
const isVercel = process.env.DEPLOY_TARGET === 'vercel';

export default defineConfig({
  base: isGitHubPages ? '/LIfeliNE/' : isVercel ? '/' : './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true
  }
});