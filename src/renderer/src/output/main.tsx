import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../theme.css'
import './output.css'
import { LiveOutput } from './LiveOutput'
import { TestScreen } from './TestScreen'

// The same page is used for test windows (?mode=test) and live output windows (?mode=live).
const mode = new URLSearchParams(location.search).get('mode')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{mode === 'test' ? <TestScreen /> : <LiveOutput />}</StrictMode>
)
