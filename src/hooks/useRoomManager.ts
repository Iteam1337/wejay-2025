import { useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";

export function useRoomManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { user, isAuthenticated } = useAuth();
  const { isConnected, currentRoom, joinRoom, leaveRoom } = useSocket();

  const roomId = urlRoomId || searchParams.get("room");

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate("/");
      return;
    }

    if (!roomId || currentRoom?.id === roomId) return;

    const loadAndJoinRoom = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
          toast.error("Room not found", {
            description: "This room may have been deleted or is invalid.",
          });
          navigate("/rooms");
          return;
        }

        const roomData = await response.json();

        await fetch(`/api/rooms/${roomId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });

        if (isConnected) {
          joinRoom(roomId);
        }

        toast.success(`Joined ${roomData.name}`, {
          description: "You can now share music with others!",
        });
      } catch (error) {
        console.error("Failed to join room:", error);
        toast.error("Failed to join room");
        navigate("/rooms");
      }
    };

    loadAndJoinRoom();
  }, [isAuthenticated, user, navigate, roomId, isConnected, joinRoom, currentRoom]);

  const handleLeaveRoom = useCallback(() => {
    if (currentRoom && user) {
      fetch(`/api/rooms/${currentRoom.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      }).catch(console.error);

      leaveRoom();
    }
  }, [currentRoom, user, leaveRoom]);

  return { currentRoom, isConnected, roomId, handleLeaveRoom };
}
