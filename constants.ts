export const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;

export const EXISTING_CHANNEL_ICONS = [
  'calendar',
  'ens',
  'email',
  'farcaster',
  'github',
  'linkedin',
  'telegram',
  'twitter',
  'wallet',
];

export const APP_URL = 'https://app.icebreaker.xyz';

export const PORT = process.env.PORT ? +process.env.PORT : 5173;

export const FRAME_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${PORT}`;

export const CLOUDINARY_AVATAR_URL =
  'https://res.cloudinary.com/merkle-manufactory';
