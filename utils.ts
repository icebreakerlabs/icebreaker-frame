import { inflateSync, deflateSync } from 'node:zlib';

import {
  type RenderedProfile,
  type IcebreakerProfile,
  type Channel,
} from './lib/types.js';
import { CLOUDINARY_AVATAR_URL } from './constants.js';

export function truncateAddress(address: string | undefined) {
  return address?.replace(address.slice(6, -4), '...') ?? '';
}

const PROTOCOL_MATCHER = /(^\w+:|^)\/\//;
const TRAILING_SLASH = /\/$/;
const CLOUDINARY_AVATAR_MATCHER =
  /^https:\/\/res\.cloudinary\.com\/merkle-manufactory\/image\/fetch\/.*?\//;
const HIGHLIGHTED_CREDENTIALS_LIST = ['qBuilder', 'Feather Ice'];

export function sanitizeAvatarURL(url?: string) {
  if (!url) {
    return url;
  }

  // Cloudinary URLs are broken
  if (url.startsWith(CLOUDINARY_AVATAR_URL)) {
    return decodeURIComponent(url.replace(CLOUDINARY_AVATAR_MATCHER, ''));
  }

  return url;
}

export function toRenderedProfile(
  profile?: IcebreakerProfile,
): RenderedProfile | undefined {
  if (!profile) {
    return;
  }

  return {
    avatarUrl: profile.avatarUrl
      ? profile.avatarUrl.endsWith('.webp')
        ? '/avatar_black.png'
        : (sanitizeAvatarURL(profile.avatarUrl) as string)
      : '/avatar_black.png',
    displayName: profile.displayName || truncateAddress(profile.walletAddress),
    bio: profile.bio,
    jobTitle: profile.jobTitle,
    location: profile.location,
    networkingStatus: profile.networkingStatus,
    primarySkill: profile.primarySkill,
    credentialsCount: profile.credentials?.length ?? 0,
    verifiedChannels:
      profile.channels?.flatMap(({ isVerified, type }) =>
        isVerified ? type : [],
      ) ?? [],
    verifiedCompanies:
      profile.workExperience?.flatMap(({ isVerified, orgWebsite }) =>
        isVerified && orgWebsite
          ? orgWebsite.replace(PROTOCOL_MATCHER, '').replace(TRAILING_SLASH, '')
          : [],
      ) ?? [],
    highlightedCredentials:
      profile.credentials?.flatMap(({ name }) =>
        HIGHLIGHTED_CREDENTIALS_LIST.includes(name) ? name : [],
      ) ?? [],
  };
}

export function compressProfile(profile?: RenderedProfile) {
  if (!profile) {
    return;
  }

  return deflateSync(JSON.stringify(profile)).toString('base64');
}

export function decompressProfile(
  compressedProfile?: string,
): RenderedProfile | undefined {
  if (!compressedProfile) {
    return;
  }

  try {
    return JSON.parse(
      inflateSync(Buffer.from(compressedProfile, 'base64')).toString(),
    );
  } catch {
    return;
  }
}

export function getFIDFromChannels(channels?: Channel[]) {
  return channels
    ?.find(({ type }) => type === 'farcaster')
    ?.metadata?.find(({ name }) => name === 'fid')
    ?.value.toString();
}
