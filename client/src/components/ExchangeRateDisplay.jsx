import { useState, useEffect } from 'react';
import api from '../api/client.js';

export default function ExchangeRateDisplay({ onRate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/exchange-rate')
      .then(res => {
        setData(res.data);
        onRate?.(res.data.rate);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <span className="text-xs text-gray-400">Loading rate...</span>;
  if (error)   return <span className="text-xs text-red-500">Rate unavailable</span>;

  const sourceLabel = { live: '🟢 Live', cache: '🟡 Cached', fallback: '🔴 Fallback' }[data?.source] || '';

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-gray-700">1 AUD = {data?.rate?.toFixed(2)} PHP</span>
      <span className="text-xs text-gray-400">{sourceLabel}</span>
    </div>
  );
}
