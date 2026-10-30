import { useEffect, useState } from 'react'
import { AlertTriangle, HardDrive, RefreshCw } from 'lucide-react'
import { AppStoreProvider, useStore } from './store/AppStore'
import { UiProvider, useUi } from './components/UiProvider'
import { Button } from './components/ui'
import { Layout, PAGE_META, type PageKey } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Positions } from './pages/Positions'
import { Trades } from './pages/Trades'
import { Reviews } from './pages/Reviews'
import { Analytics } from './pages/Analytics'
import { Calendar } from './pages/Calendar'
import { Watchlist } from './pages/Watchlist'
import { Tools } from './pages/Tools'
import { Learning } from './pages/Learning'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'

function parseHash(): { page: PageKey; hash: string } {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [path] = hash.split('?')
  const page = (path || 'dashboard') as PageKey
  return { page: page in PAGE_META ? page : 'dashboard', hash }
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img src="./logo.svg" alt="Goden Egg" />
      <div className="loading-ring" />
      <strong>Goden Egg</strong>
      <span>正在读取本地数据文件…</span>
    </div>
  )
}

function LoadErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="loading-screen error-screen">
      <div className="load-error-icon"><AlertTriangle size={26} /></div>
      <strong>无法打开本地数据</strong>
      <p>{error}</p>
      <p className="load-error-help">
        请确认 Goden Egg 是通过 <code>npm start</code> 或「启动 Goden Egg.bat」打开的，
        而不是直接双击 dist/index.html。
      </p>
      <div className="load-error-actions">
        <Button icon={<RefreshCw size={15} />} onClick={onRetry}>重试连接</Button>
      </div>
      <span className="load-error-path"><HardDrive size={13} /> 数据应位于 data/state.json</span>
    </div>
  )
}

function AppContent() {
  const { state, hydrated, loadError, retryHydrate, migrationNotice, clearMigrationNotice } = useStore()
  const { toast } = useUi()
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    if (!migrationNotice) return
    toast('已把旧版浏览器数据迁移到本地 data/state.json', 'success')
    clearMigrationNotice()
  }, [migrationNotice, clearMigrationNotice, toast])

  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    if (!window.location.hash) window.location.hash = '#/dashboard'
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    const content = document.querySelector('.content')
    if (content) content.scrollTop = 0
    document.title = `Goden Egg · ${PAGE_META[route.page].title}`
  }, [route.page, route.hash])

  const navigate = (page: PageKey) => {
    if (route.page === page) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.location.hash = `#/${page}`
  }

  if (!hydrated) {
    return loadError ? <LoadErrorScreen error={loadError} onRetry={retryHydrate} /> : <LoadingScreen />
  }

  if (!state.onboarded) {
    return <Onboarding />
  }

  return (
    <Layout page={route.page} onNavigate={navigate}>
      {route.page === 'dashboard' ? <Dashboard onNavigate={navigate} /> : null}
      {route.page === 'positions' ? <Positions /> : null}
      {route.page === 'trades' ? <Trades /> : null}
      {route.page === 'reviews' ? <Reviews key={route.hash} /> : null}
      {route.page === 'analytics' ? <Analytics /> : null}
      {route.page === 'calendar' ? <Calendar /> : null}
      {route.page === 'watchlist' ? <Watchlist /> : null}
      {route.page === 'tools' ? <Tools /> : null}
      {route.page === 'learning' ? <Learning /> : null}
      {route.page === 'settings' ? <Settings /> : null}
    </Layout>
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      <UiProvider>
        <AppContent />
      </UiProvider>
    </AppStoreProvider>
  )
}
