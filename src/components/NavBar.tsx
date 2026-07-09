import { NavLink } from 'react-router-dom'
import { BookIcon, ChartIcon, TodayIcon } from './ui'

const tabs = [
  { to: '/', ms: 'Hari ini', en: 'today', Icon: TodayIcon },
  { to: '/words', ms: 'Kata', en: 'words', Icon: BookIcon },
  { to: '/progress', ms: 'Kemajuan', en: 'progress', Icon: ChartIcon },
]

/** Tab bar is indigo; active tab plaster, inactive indigo-lo (P1.5). */
export function NavBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-indigo pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 ${
                isActive ? 'text-plaster' : 'text-indigo-lo'
              }`
            }
          >
            <t.Icon className="w-5 h-5" />
            <span className="mono-sm">
              {t.ms}
              <span className="opacity-60"> · {t.en}</span>
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
