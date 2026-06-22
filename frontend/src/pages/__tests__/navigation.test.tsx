import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SidebarLayout } from '@/App'
import { DashboardPage } from '@/pages/DashboardPage'

const getActiveFeed = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { getActiveFeed: () => getActiveFeed() },
}))

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route path={path} element={element} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('SidebarLayout', () => {
  it('renders Dashboard and Data Feeds nav links', () => {
    renderAt('/dashboard', <div />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Data Feeds' })).toBeInTheDocument()
  })
})

describe('DashboardPage', () => {
  beforeEach(() => getActiveFeed.mockReset())

  it('shows an empty state when there is no active feed', async () => {
    getActiveFeed.mockResolvedValue({ active: null })
    renderAt('/dashboard', <DashboardPage />)
    expect(
      await screen.findByRole('heading', { name: 'No active data feed' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to Data Feeds' })
    ).toBeInTheDocument()
  })
})
