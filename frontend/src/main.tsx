import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { SidebarLayout } from './App'

// Route-level code splitting: recharts (Dashboard) and the tool pages load on
// demand instead of bloating the initial bundle.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const BoxLookupPage = lazy(() =>
  import('./pages/BoxLookupPage').then((m) => ({ default: m.BoxLookupPage }))
)
const QcSamplerPage = lazy(() =>
  import('./pages/QcSamplerPage').then((m) => ({ default: m.QcSamplerPage }))
)
const AliquotFinderPage = lazy(() =>
  import('./pages/AliquotFinderPage').then((m) => ({ default: m.AliquotFinderPage }))
)
const ScanReconcilePage = lazy(() =>
  import('./pages/ScanReconcilePage').then((m) => ({ default: m.ScanReconcilePage }))
)
const DataFeedsPage = lazy(() =>
  import('./pages/DataFeedsPage').then((m) => ({ default: m.DataFeedsPage }))
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense
        fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}
      >
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
      </Suspense>
    </BrowserRouter>
  </StrictMode>
)
