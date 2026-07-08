import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Hari ini', icon: '⛰' },
  { to: '/words', label: 'Kata', icon: '📖' },
  { to: '/progress', label: 'Bukit', icon: '🪨' },
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
            <span aria-hidden className="text-base leading-none">
              {t.icon}
            </span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
