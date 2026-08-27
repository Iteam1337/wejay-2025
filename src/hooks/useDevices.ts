import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAvailableDevices, type SpotifyDevice } from '@/lib/spotify';

const STORAGE_KEY = 'wejay_selected_device';
const DEVICES_CACHE_KEY = 'wejay_known_devices';
const REFRESH_INTERVAL = 10000;

export function getDeviceIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('speaker') || t.includes('sonos')) return 'Speaker';
  if (t.includes('computer')) return 'Monitor';
  if (t.includes('phone') || t.includes('smartphone')) return 'Smartphone';
  if (t.includes('tv')) return 'Tv';
  return 'Speaker';
}

interface CachedDevice {
  id: string;
  name: string;
  type: string;
  lastSeen: number;
}

function loadCachedDevices(): CachedDevice[] {
  try {
    const raw = localStorage.getItem(DEVICES_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCachedDevices(devices: SpotifyDevice[]) {
  const cached = loadCachedDevices();
  const now = Date.now();
  const byId = new Map<string, CachedDevice>();
  for (const c of cached) byId.set(c.id, c);
  for (const d of devices) {
    byId.set(d.id, { id: d.id, name: d.name, type: d.type, lastSeen: now });
  }
  // Keep devices seen in the last 24h
  const cutoff = now - 24 * 60 * 60 * 1000;
  const filtered = Array.from(byId.values()).filter((d) => d.lastSeen > cutoff);
  localStorage.setItem(DEVICES_CACHE_KEY, JSON.stringify(filtered));
  return filtered;
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
      // Merge with cached devices so previously seen devices stay visible
      // even if Spotify API doesn't return them (common with Sonos/inactive)
      const cached = saveCachedDevices(list);
      const apiIds = new Set(list.map((d) => d.id));
      const merged = [
        ...list,
        ...cached
          .filter((c) => !apiIds.has(c.id))
          .map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            volume_percent: null,
            is_active: false,
            is_private_session: false,
            is_restricted: false,
            supports_volume: false,
          })),
      ];
      setDevices(merged);
      if (merged.length > 0) {
        const active = merged.find((d) => d.is_active);
        if (active && !selectedDeviceId) {
          setSelectedDeviceId(active.id);
          localStorage.setItem(STORAGE_KEY, active.id);
        } else if (!selectedDeviceId) {
          setSelectedDeviceId(merged[0].id);
          localStorage.setItem(STORAGE_KEY, merged[0].id);
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
