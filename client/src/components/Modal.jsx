import { useEffect } from 'react';

export default function Modal({ title, onClose, children, size = 'md' }) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-2xl shadow-xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
