import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard',  label: 'Dashboard',  icon: '📊' },
  { to: '/products',   label: 'Products',   icon: '📦' },
  { to: '/batches',    label: 'Batches',    icon: '🛒' },
  { to: '/inventory',  label: 'Inventory',  icon: '🗃️' },
  { to: '/sales',      label: 'Sales',      icon: '💸' },
  { to: '/reports',    label: 'Reports',    icon: '📈' },
];

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-56 h-full bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-5 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Auskorphi</h1>
          <p className="text-xs text-gray-400 mt-0.5">Resell Tracker</p>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
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

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            </div>
            <NavLink
              to="/users"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-base leading-none">👥</span>
              Users
            </NavLink>
          </>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-gray-700 space-y-2">
        {user && (
          <p className="text-xs text-gray-400 truncate">
            Signed in as <span className="text-gray-200 font-medium">{user.username}</span>
          </p>
        )}
        <button
          onClick={logout}
          className="w-full text-left text-xs text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
