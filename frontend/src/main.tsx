import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { SidebarLayout } from './App'
import { DataFeedsPage } from './pages/DataFeedsPage'
import { DashboardPage } from './pages/DashboardPage'
import { BoxLookupPage } from './pages/BoxLookupPage'
import { QcSamplerPage } from './pages/QcSamplerPage'
import { AliquotFinderPage } from './pages/AliquotFinderPage'
import { ScanReconcilePage } from './pages/ScanReconcilePage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/box-lookup" element={<BoxLookupPage />} />
          <Route path="/qc-sampler" element={<QcSamplerPage />} />
          <Route path="/aliquot-finder" element={<AliquotFinderPage />} />
          <Route path="/scan-reconcile" element={<ScanReconcilePage />} />
          <Route path="/feeds" element={<DataFeedsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
