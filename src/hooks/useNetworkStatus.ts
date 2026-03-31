import { useState, useEffect, useRef } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Clear the "was offline" state after 4 seconds
      if (wasOfflineTimer.current) clearTimeout(wasOfflineTimer.current);
      wasOfflineTimer.current = setTimeout(() => setWasOffline(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
      if (wasOfflineTimer.current) clearTimeout(wasOfflineTimer.current);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (wasOfflineTimer.current) clearTimeout(wasOfflineTimer.current);
    };
  }, []);

  return { isOnline, wasOffline };
}
