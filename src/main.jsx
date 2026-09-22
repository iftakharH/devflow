import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { ConvexClientProvider } from './components/ConvexClientProvider'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexClientProvider>
        <App />
      </ConvexClientProvider>
    </ClerkProvider>
  </StrictMode>,
)
