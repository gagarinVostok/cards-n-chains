import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths: the build works from any folder of any server (e.g. /cards-n-chains/ on GitHub Pages).
export default defineConfig({ base: './', plugins: [react()] })
