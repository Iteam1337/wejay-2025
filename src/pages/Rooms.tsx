import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, Copy, Check, Loader2 } from 'lucide-react';
import { Room } from '@/types/wejay';
import { toast } from 'sonner';

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

    // Mock loading rooms - in real app this would be from API
    const mockRooms: Room[] = [
      {
        id: 'room-1',
        name: 'Friday Vibes',
        createdBy: 'user-1',
        createdAt: new Date('2024-01-15'),
        users: [user],
        isActive: true,
      },
      {
        id: 'room-2',
        name: 'Study Session',
        createdBy: 'user-2',
        createdAt: new Date('2024-01-14'),
        users: [user],
        isActive: false,
      },
    ];

    setTimeout(() => {
      setRooms(mockRooms);
      setIsLoading(false);
    }, 1000);
  }, [isAuthenticated, user, navigate]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Room name is required');
      return;
    }

    setIsCreating(true);
    
    try {
      // Mock creating room - in real app this would be API call
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        name: newRoomName.trim(),
        createdBy: user!.id,
        createdAt: new Date(),
        users: [user!],
        isActive: true,
      };

      setRooms(prev => [newRoom, ...prev]);
      setNewRoomName('');
      
      toast.success('Room created successfully!', {
        description: `${newRoom.name} is ready for friends to join.`,
      });

      // Copy room link automatically
      await handleCopyRoomLink(newRoom.id);
    } catch (error) {
      toast.error('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    // Navigate to main app with room ID
    navigate(`/app/${roomId}`);
  };

  const handleCopyRoomLink = async (roomId: string) => {
    const roomUrl = `${window.location.origin}/app/${roomId}`;
    
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
              <div>
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="neumorphic"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                />
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