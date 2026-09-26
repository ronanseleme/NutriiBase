import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Commit de teste: valida que o Preview Deployment da branch `development`
// builda corretamente e conecta no banco de desenvolvimento isolado.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
