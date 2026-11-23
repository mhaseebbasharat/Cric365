import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from any folder, including inside the Android app.
export default defineConfig({ base: './', plugins: [react()], server: { port: 3000 } });
