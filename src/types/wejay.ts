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

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
  country: string;
  product: string; // 'premium' or 'free'
}

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  users: SpotifyUser[];
  isActive: boolean;
}
