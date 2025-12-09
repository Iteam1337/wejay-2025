import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, Copy, Check, Loader2 } from 'lucide-react';
import { Room } from '@/types/wejay';
import { toast } from '@/lib/toast';

const Rooms = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/');
      return;
    }

    // Load rooms from API
    const loadRooms = async () => {
      try {
        console.log('[Rooms] Fetching rooms for user:', user.id);
        const response = await fetch('/api/rooms');
        if (response.ok) {
          const data = await response.json();
          console.log('[Rooms] Got rooms from API:', data);
          console.log('[Rooms] Total rooms:', data.length);
          
          // Filter rooms where user is a member
          const userRooms = data.filter((room: Room & { users: string[] }) => {
            const isMember = room.users.includes(user.id);
            console.log(`[Rooms] Room ${room.name}: user is member?`, isMember, 'Users:', room.users);
            return isMember;
          });
          
          console.log('[Rooms] User rooms after filter:', userRooms.length);
          
          setRooms(userRooms.map((room: Room & { createdAt: string | Date }) => ({
            ...room,
            createdAt: new Date(room.createdAt),
            users: [user], // Simplified for now
          })));
        } else {
          console.error('[Rooms] API response not ok:', response.status);
        }
      } catch (error) {
        console.error('[Rooms] Failed to load rooms:', error);
        toast.error('Failed to load rooms');
      } finally {
        setIsLoading(false);
      }
    };

    loadRooms();
  }, [isAuthenticated, user, navigate]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Room name is required');
      return;
    }

    setIsCreating(true);
    
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          createdBy: user!.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const createdRoom = await response.json();
      const isExisting = response.status === 200; // 200 = joined existing, 201 = created new
      
      const newRoom: Room = {
        ...createdRoom,
        createdAt: new Date(createdRoom.createdAt),
        users: [user!],
      };

      // Update or add to rooms list
      setRooms(prev => {
        const existing = prev.find(r => r.id === newRoom.id);
        if (existing) {
          return prev.map(r => r.id === newRoom.id ? newRoom : r);
        }
        return [newRoom, ...prev];
      });
      
      setNewRoomName('');
      
      if (isExisting) {
        toast.success(`Joined existing room: ${newRoom.name}`, {
          description: `${createdRoom.users.length} people are already here!`,
        });
      } else {
        toast.success('Room created successfully!', {
          description: `${newRoom.name} is ready for friends to join.`,
        });
      }

      // Copy room link automatically
      await handleCopyRoomLink(newRoom.id);
      
      // Navigate to room
      navigate(`/room/${newRoom.id}`);
    } catch (error) {
      console.error('Failed to create room:', error);
      toast.error('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    // Navigate to main app with room ID
    navigate(`/room/${roomId}`);
  };

  const handleCopyRoomLink = async (roomId: string) => {
    const roomUrl = `${window.location.origin}/room/${roomId}`;
    
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopiedRoomId(roomId);
      toast.success('Room link copied!', {
        description: 'Share this link with friends to invite them.',
      });
      
      // Reset copied state after 3 seconds
      setTimeout(() => {
        setCopiedRoomId(null);
      }, 3000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground uppercase">Loading rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold uppercase">Wejay</h1>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <img 
                    src={user?.images[0]?.url || '/placeholder.svg'} 
                    alt={user?.display_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {user?.display_name}
                </span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="neumorphic"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Create Room Section */}
          <Card className="neumorphic p-6">
            <h2 className="text-xl font-semibold mb-4 uppercase">Create New Room</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="friday-vibes"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="neumorphic"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                />
                {newRoomName.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Room URL: <span className="text-primary font-mono">
                      /room/{newRoomName.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')}
                    </span>
                  </p>
                )}
              </div>
              <Button 
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim() || isCreating}
                className="neumorphic w-full"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Room
              </Button>
            </div>
          </Card>

          {/* Existing Rooms */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold uppercase">Your Rooms</h2>
            
            {rooms.length === 0 ? (
              <Card className="neumorphic p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground uppercase">No rooms yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your first room to start sharing music with friends
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {rooms.map((room) => (
                  <Card key={room.id} className="neumorphic p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{room.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {room.users.length} user{room.users.length !== 1 ? 's' : ''}
                          </span>
                          <span>Created {room.createdAt.toLocaleDateString()}</span>
                          {room.isActive && (
                            <span className="text-green-500">Active</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyRoomLink(room.id)}
                          className="neumorphic"
                        >
                          {copiedRoomId === room.id ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => handleJoinRoom(room.id)}
                          className="neumorphic"
                        >
                          Join Room
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Rooms;