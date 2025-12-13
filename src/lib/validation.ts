import { z } from 'zod';

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  userId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  userName: z.string().min(1).max(100).optional(),
});

export const roomCreateSchema = z.object({
  roomId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  roomName: z.string().min(1).max(100),
  isPrivate: z.boolean().optional().default(false),
  maxUsers: z.number().min(2).max(50).optional().default(20),
});

export const authVerifierSchema = z.object({
  verifier: z.string().min(43).max(128), // PKCE verifier length
  state: z.string().min(32).max(128),
});

export const spotifyCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(32).max(128),
});

export const trackVoteSchema = z.object({
  trackId: z.string().min(1),
  vote: z.enum(['up', 'down']),
});

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type AuthVerifierInput = z.infer<typeof authVerifierSchema>;
export type SpotifyCallbackInput = z.infer<typeof spotifyCallbackSchema>;
export type TrackVoteInput = z.infer<typeof trackVoteSchema>;