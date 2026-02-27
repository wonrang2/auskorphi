import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard',  label: 'Dashboard',  icon: '📊' },
  { to: '/products',   label: 'Products',   icon: '📦' },
  { to: '/batches',    label: 'Batches',    icon: '🛒' },
  { to: '/inventory',  label: 'Inventory',  icon: '🗃️' },
  { to: '/sales',      label: 'Sales',      icon: '💸' },
  { to: '/reports',    label: 'Reports',    icon: '📈' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-tight">Auskorphi</h1>
        <p className="text-xs text-gray-400 mt-0.5">Resell Tracker</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">AUD → PHP Tracker</p>
      </div>
    </aside>
  );
}
