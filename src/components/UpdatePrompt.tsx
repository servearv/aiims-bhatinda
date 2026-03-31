import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setShowPrompt(true);
    window.addEventListener('sw-update-available', handleUpdate);
    return () => window.removeEventListener('sw-update-available', handleUpdate);
  }, []);

  const handleUpdate = () => {
    const updateSW = (window as any).__updateSW;
    if (updateSW) {
      updateSW(true); // Calls skipWaiting + reload
    } else {
      window.location.reload();
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom duration-500">
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_40px_rgba(6,182,212,0.15)] max-w-sm">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm">Update Available</h4>
            <p className="text-slate-400 text-xs mt-0.5">
              A new version of AIIMS Bathinda is ready.
            </p>
            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={handleUpdate}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg"
              >
                Update Now
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowPrompt(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
