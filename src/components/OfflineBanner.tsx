import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Show nothing when normally online
  if (isOnline && !wasOffline) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ease-out ${
      !isOnline
        ? 'translate-y-0'
        : wasOffline
          ? 'translate-y-0'
          : '-translate-y-full'
    }`}>
      <div className={`flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium backdrop-blur-xl ${
        !isOnline
          ? 'bg-amber-500/90 text-white'
          : 'bg-emerald-500/90 text-white'
      }`}>
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>You're offline — cached data is available</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            <span>Back online ✓</span>
          </>
        )}
      </div>
    </div>
  );
}
