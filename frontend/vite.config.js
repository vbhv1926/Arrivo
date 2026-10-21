import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API runs separately (see ../backend). Proxying /api keeps it same-origin, so the
// device cookie and the live stream just work. PARKSEAT_API points it elsewhere.
const proxy = {
  '/api': {
    target: process.env.PARKSEAT_API || 'http://localhost:8787',
    // If the API dies mid-stream (say, a restart), Vite logs it but leaves the browser's
    // end of the live stream open, so the page never notices. Close it so it reconnects.
    configure: (p) =>
      p.on('error', (err, req, res) => {
        if (res?.headersSent && !res.writableEnded) res.end()
      }),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
