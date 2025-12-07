import { User } from "@/types/wejay";
import { UserBadge } from "./UserBadge";
import { Users } from "lucide-react";

interface OnlineUsersProps {
  users: User[];
  currentUserId: string;
}

export function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
  const onlineUsers = users.filter(u => u.isOnline);

  return (
    <div className="neumorphic p-4">
      <div className="flex items-center gap-2 mb-3 uppercase">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-sm">
          ONLINE ({onlineUsers.length})
        </h3>
      </div>
      <div className="space-y-2">
        {onlineUsers.map(user => (
          <UserBadge 
            key={user.id} 
            user={user} 
            isCurrentUser={user.id === currentUserId}
          />
        ))}
      </div>
    </div>
  );
}
