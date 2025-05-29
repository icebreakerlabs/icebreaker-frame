import { inflateSync, deflateSync } from 'node:zlib';

import {
  type RenderedProfile,
  type IcebreakerProfile,
  type Channel,
  type Credential,
} from './lib/types.js';
import { CLOUDINARY_AVATAR_URL } from './constants.js';

export function truncateAddress(address: string | undefined) {
  return address?.replace(address.slice(6, -4), '...') ?? '';
}

const CLOUDINARY_AVATAR_MATCHER =
  /^https:\/\/res\.cloudinary\.com\/merkle-manufactory\/image\/fetch\/.*?\//;

const CITY_ATTESTATIONS = ['New Yorker', 'Chicagoan', 'Londoner', 'Bostonian'];

export const HIGH_SIGNAL_ATTESTATIONS = [
  'qBuilder',
  'Non Sibi',
  'Mens et Manus',
  'Interoperators',
  'lux sub rosa',
  ...CITY_ATTESTATIONS,
];

const HIGHLIGHTED_CREDENTIALS_LIST = [
  'Feather Ice',
  'Human',
  ...HIGH_SIGNAL_ATTESTATIONS,
];

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

export function getVerifiedDomains(credentials: Credential[]) {
  const verifiedDomains = credentials.reduce((verifiedDomains, { name }) => {
    if (name.startsWith('Verified:')) {
      verifiedDomains.add(name.replace('Verified: ', ''));
    }

    return verifiedDomains;
  }, new Set<string>());

  return [...verifiedDomains];
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
    verifiedDomains: getVerifiedDomains(profile.credentials ?? []),
    highlightedCredentials: [
      ...new Set(
        profile.credentials?.flatMap(({ name }) =>
          HIGHLIGHTED_CREDENTIALS_LIST.includes(name) ? name : [],
        ) ?? [],
      ),
    ],
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
