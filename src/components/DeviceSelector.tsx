import { useState } from 'react';
import { useDevices, getDeviceIcon } from '@/hooks/useDevices';
import { useAuth } from '@/contexts/AuthContext';
import { transferPlayback } from '@/lib/spotify';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Speaker, Monitor, Smartphone, Tv, RefreshCw, Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeviceSelectorProps {
  onDeviceChange?: (deviceId: string | null) => void;
}

export function DeviceSelector({ onDeviceChange }: DeviceSelectorProps) {
  const { isAuthenticated, isPremium } = useAuth();
  const { devices, selectedDeviceId, selectDevice, refresh, isLoading } = useDevices();
  const [isTransferring, setIsTransferring] = useState(false);

  if (!isAuthenticated || !isPremium) return null;

  const handleSelect = async (deviceId: string) => {
    setIsTransferring(true);
    try {
      await transferPlayback(deviceId, false);
      selectDevice(deviceId);
      onDeviceChange?.(deviceId);
    } catch (err) {
      console.error('[DeviceSelector] Failed to transfer:', err);
    } finally {
      setIsTransferring(false);
    }
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="neumorphic-button px-3 h-10 flex items-center gap-2 flex-shrink-0 text-sm font-medium"
          disabled={isTransferring || isLoading}
          title="Välj uppfelningsenhet"
        >
          {isTransferring ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <DeviceTypeIcon type={selectedDevice?.type || 'Speaker'} />
          )}
          <span className="hidden sm:inline max-w-[120px] truncate">
            {selectedDevice?.name || 'Välj enhet'}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase">
          Uppspelningsenheter
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {devices.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            {isLoading ? 'Laddar...' : 'Inga enheter hittades'}
          </div>
        )}
        {devices.map((device) => (
          <DropdownMenuItem
            key={device.id}
            onClick={() => handleSelect(device.id)}
            className={cn(
              'cursor-pointer flex items-center gap-2',
              device.id === selectedDeviceId && 'bg-accent'
            )}
          >
            <DeviceTypeIcon type={device.type} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{device.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{device.type}</div>
            </div>
            {device.is_active && (
              <Volume2 className="w-3 h-3 text-[#1DB954] flex-shrink-0" />
            )}
            {device.id === selectedDeviceId && (
              <Check className="w-3 h-3 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        {devices.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            refresh();
          }}
          className="cursor-pointer text-xs text-muted-foreground"
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Uppdatera enheter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeviceTypeIcon({ type }: { type: string }) {
  const icon = getDeviceIcon(type);
  const icons = {
    Speaker: <Speaker className="w-4 h-4" />,
    Monitor: <Monitor className="w-4 h-4" />,
    Smartphone: <Smartphone className="w-4 h-4" />,
    Tv: <Tv className="w-4 h-4" />,
  };
  return icons[icon as keyof typeof icons] || <Speaker className="w-4 h-4" />;
}
