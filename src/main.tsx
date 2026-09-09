import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTeamFromQuery, bootstrapTeamConnection } from './lib/teamSync'

applyTeamFromQuery()

void bootstrapTeamConnection().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
