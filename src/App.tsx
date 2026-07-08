import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureSeeded, getSettings } from './db/db'
import { NavBar } from './components/NavBar'
import { Onboarding } from './screens/Onboarding'
import { Today } from './screens/Today'
import { Review } from './screens/Review'
import { Read } from './screens/Read'
import { Speak } from './screens/Speak'
import { Words } from './screens/Words'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'

function Shell({ needsOnboarding }: { needsOnboarding: boolean }) {
  const location = useLocation()
  const inSession = ['/review', '/read', '/speak', '/onboarding'].some((p) =>
    location.pathname.startsWith(p),
  )
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (!needsOnboarding && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<Today />} />
        <Route path="/review" element={<Review />} />
        <Route path="/read" element={<Read />} />
        <Route path="/speak" element={<Speak />} />
        <Route path="/words" element={<Words />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!inSession && <NavBar />}
    </>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  // Live so finishing onboarding immediately unblocks the router.
  const settings = useLiveQuery(() => db.settings.get('settings'), [], undefined)

  useEffect(() => {
    ;(async () => {
      await ensureSeeded()
      await getSettings() // materialise the settings row
      setReady(true)
    })()
  }, [])

  if (!ready || !settings) return null

  return (
    <HashRouter>
      <Shell needsOnboarding={!settings.onboarded} />
    </HashRouter>
  )
}
