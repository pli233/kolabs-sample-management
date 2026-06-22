import { Link, Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border bg-[var(--midnight)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary font-title text-sm font-bold text-primary-foreground">
              K
            </span>
            <span className="font-title text-lg font-semibold text-white">
              Kolabs 样本库管理
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
