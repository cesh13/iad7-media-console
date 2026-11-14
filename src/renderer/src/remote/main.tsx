import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../theme.css'
import './remote.css'
import { Remote } from './Remote'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Remote />
  </StrictMode>
)
