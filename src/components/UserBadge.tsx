import { User } from "@/types/wejay";
import { cn } from "@/lib/utils";

interface UserBadgeProps {
  user: User;
  isCurrentUser?: boolean;
}

export function UserBadge({ user, isCurrentUser = false }: UserBadgeProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 py-1",
      isCurrentUser && "text-primary"
    )}>
      <div className="relative">
        <img 
          src={user.avatar} 
          alt={user.name}
          className="w-8 h-8 rounded-full neumorphic"
        />
        {user.isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-card" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {isCurrentUser ? "You" : user.name}
        </p>
        {user.tracksAdded > 0 && (
          <p className="text-xs text-muted-foreground uppercase">
            {user.tracksAdded} {user.tracksAdded === 1 ? "TRACK" : "TRACKS"}
          </p>
        )}
      </div>
    </div>
  );
}
