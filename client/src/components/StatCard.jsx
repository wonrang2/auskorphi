export default function StatCard({ label, value, sub, color = 'blue', icon }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    green:  'bg-green-50 text-green-700 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    red:    'bg-red-50 text-red-700 border-red-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };

  return (
    <div className={`card border ${colors[color] || colors.blue}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
        </div>
        {icon && <span className="text-2xl opacity-60">{icon}</span>}
      </div>
    </div>
  );
}
