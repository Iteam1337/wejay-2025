export interface SearchTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
}

export interface Track extends SearchTrack {
  addedBy: string;
  addedAt: Date;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  tracksAdded: number;
}

export interface PlaylistEntry extends Track {
  position: number;
}
