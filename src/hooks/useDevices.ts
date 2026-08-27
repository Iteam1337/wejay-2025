import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAvailableDevices, type SpotifyDevice } from '@/lib/spotify';

const STORAGE_KEY = 'wejay_selected_device';
const REFRESH_INTERVAL = 15000;

export function getDeviceIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('speaker') || t.includes('sonos')) return 'Speaker';
  if (t.includes('computer')) return 'Monitor';
  if (t.includes('phone') || t.includes('smartphone')) return 'Smartphone';
  if (t.includes('tv')) return 'Tv';
  return 'Speaker';
}

export function useDevices() {
  const { isAuthenticated } = useAuth();
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await getAvailableDevices();
      setDevices(list);
      if (list.length > 0) {
        const active = list.find((d) => d.is_active);
        if (active && !selectedDeviceId) {
          setSelectedDeviceId(active.id);
          localStorage.setItem(STORAGE_KEY, active.id);
        } else if (!selectedDeviceId) {
          setSelectedDeviceId(list[0].id);
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      }
    } catch (err) {
      console.error('[Devices] Failed to fetch:', err);
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, selectedDeviceId]);

  useEffect(() => {
    fetchDevices();
    if (!isAuthenticated) return;
    const id = setInterval(fetchDevices, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchDevices, isAuthenticated]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(STORAGE_KEY, deviceId);
  }, []);

  return {
    devices,
    selectedDeviceId,
    selectDevice,
    isLoading,
    error,
    refresh: fetchDevices,
  };
}
