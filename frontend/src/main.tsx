import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { AppLayout } from './App'
import { UploadPage } from './pages/UploadPage'
import { ViewerPage } from './pages/ViewerPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<UploadPage />} />
          <Route path="/files/:id" element={<ViewerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
