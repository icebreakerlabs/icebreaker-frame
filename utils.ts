import { inflateSync, deflateSync } from 'node:zlib';

import { type RenderedProfile, type IcebreakerProfile } from './lib/types.js';

export function truncateAddress(address: string | undefined) {
  return address?.replace(address.slice(6, -4), '...') ?? '';
}

export function toRenderedProfile(
  profile?: IcebreakerProfile,
): RenderedProfile | undefined {
  if (!profile) {
    return;
  }

  return {
    avatarUrl:
      profile.avatarUrl ||
      'https://icebreaker-nft-images.s3.amazonaws.com/avatar_black_1.webp',
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
