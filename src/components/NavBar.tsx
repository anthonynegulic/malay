import { NavLink } from 'react-router-dom'
import { BookIcon, HillIcon, StonesIcon } from './ui'

const tabs = [
  { to: '/', label: 'Hari ini', sub: 'today', Icon: HillIcon },
  { to: '/words', label: 'Kata', sub: 'words', Icon: BookIcon },
  { to: '/progress', label: 'Bukit', sub: 'progress', Icon: StonesIcon },
]

export function NavBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-limewash/95 backdrop-blur border-t border-ink/10 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-mansion' : 'text-ink/50'
              }`
            }
          >
            <t.Icon className="w-5 h-5" />
            {t.label}
            <span className="text-[9px] font-normal opacity-60 -mt-0.5">{t.sub}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
