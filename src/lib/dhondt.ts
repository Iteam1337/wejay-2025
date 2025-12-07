import { Track, PlaylistEntry } from "@/types/wejay";

/**
 * D'Hondt method for proportional representation
 * Ensures fair distribution of tracks from different users
 */
export function arrangeTracks(tracks: Track[]): PlaylistEntry[] {
  if (tracks.length === 0) return [];

  // Group tracks by user
  const tracksByUser: Map<string, Track[]> = new Map();
  
  tracks.forEach(track => {
    const userTracks = tracksByUser.get(track.addedBy) || [];
    userTracks.push(track);
    tracksByUser.set(track.addedBy, userTracks);
  });

  // D'Hondt allocation
  const result: PlaylistEntry[] = [];
  const userQueues: Map<string, Track[]> = new Map();
  const userDivisors: Map<string, number> = new Map();

  // Initialize queues and divisors
  tracksByUser.forEach((userTracks, userId) => {
    // Sort by added time within each user's tracks
    userQueues.set(userId, [...userTracks].sort((a, b) => 
      new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
    ));
    userDivisors.set(userId, 1);
  });

  // Allocate tracks using D'Hondt
  while (result.length < tracks.length) {
    let maxQuotient = -1;
    let selectedUser = "";

    // Find user with highest quotient (tracks remaining / divisor)
    userQueues.forEach((queue, userId) => {
      if (queue.length > 0) {
        const divisor = userDivisors.get(userId) || 1;
        const quotient = queue.length / divisor;
        
        if (quotient > maxQuotient) {
          maxQuotient = quotient;
          selectedUser = userId;
        }
      }
    });

    if (selectedUser && userQueues.get(selectedUser)?.length) {
      const queue = userQueues.get(selectedUser)!;
      const track = queue.shift()!;
      
      result.push({
        ...track,
        position: result.length + 1
      });

      // Increase divisor for this user
      userDivisors.set(selectedUser, (userDivisors.get(selectedUser) || 1) + 1);
    } else {
      break;
    }
  }

  return result;
}
