import './app/boot'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/app'
import { attachOrchDebug } from './app/debug-orch'
import './index.css'
import '@xyflow/react/dist/style.css'

if (import.meta.env.DEV) {
  attachOrchDebug()
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
