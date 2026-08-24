import { Room } from "@/types/wejay";

interface OnboardingBannerProps {
  room: Room;
  show: boolean;
}

export function OnboardingBanner({ room, show }: OnboardingBannerProps) {
  if (!show) return null;

  return (
    <div className="neumorphic p-6 border-2 border-primary/20 mb-6">
      <h2 className="text-lg font-bold mb-2 uppercase">Welcome to {room.name}!</h2>
      <p className="text-sm text-muted-foreground mb-4">
        This room is empty. Start by searching for a track and adding it to the queue.
        Everyone in the room can add tracks and they'll be fairly arranged using the D'Hondt
        method.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Step label="Search for music" />
        <span>→</span>
        <Step label="Add to queue" />
        <span>→</span>
        <Step label="Enjoy together!" />
      </div>
    </div>
  );
}

function Step({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 bg-primary rounded-full" />
      <span>{label}</span>
    </div>
  );
}
