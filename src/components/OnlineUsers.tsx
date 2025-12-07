import { SpotifyUser } from "@/types/wejay";
import { Users } from "lucide-react";

interface OnlineUsersProps {
  users: SpotifyUser[];
  currentUserId: string;
}

export function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
  if (users.length === 0) {
    return (
      <div className="neumorphic p-4">
        <div className="flex items-center gap-2 mb-3 uppercase">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-medium text-sm">
            ONLINE (0)
          </h3>
        </div>
        <div className="text-center py-4 text-sm text-muted-foreground">
          No other users in room yet
        </div>
      </div>
    );
  }

  return (
    <div className="neumorphic p-4">
      <div className="flex items-center gap-2 mb-3 uppercase">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-sm">
          ONLINE ({users.length})
        </h3>
      </div>
      <div className="space-y-2">
        {users.map(user => (
          <div 
            key={user.id}
            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
              user.id === currentUserId 
                ? 'bg-primary/10 border border-primary/20' 
                : 'hover:bg-accent/50'
            }`}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-muted">
              <img 
                src={user.images[0]?.url || "/placeholder.svg"} 
                alt={user.display_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.display_name}
                {user.id === currentUserId && (
                  <span className="text-xs text-primary ml-1">(YOU)</span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
