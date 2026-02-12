import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { MapLayerProvider } from './contexts/MapLayerContext'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MapLayerProvider>
          <App />
        </MapLayerProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
