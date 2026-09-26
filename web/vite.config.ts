import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')) as {
  version: string
}
const buildTime = new Date().toISOString()

// Admin > Ambientes precisa saber, de fora, qual versão e build cada
// ambiente (PRD/DEV) está rodando — emitimos um version.json público ao
// lado do bundle pra isso, sem precisar de outro processo/script.
function emitVersionJson(): Plugin {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: pkg.version, buildTime }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), emitVersionJson()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
})
