import { type CastParamType, NeynarAPIClient } from '@neynar/nodejs-sdk';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;

const neynar = new NeynarAPIClient(NEYNAR_API_KEY);

export async function validateFrameAction(messageBytes: string) {
  return neynar.validateFrameAction(messageBytes);
}

export async function lookupCastByHashOrWarpcastUrl(
  castHashOrUrl: string,
  type: CastParamType,
) {
  return neynar.lookUpCastByHashOrWarpcastUrl(castHashOrUrl, type);
}

export async function resolveFarcasterFid(fid: number) {
  try {
    const farcasterUsers = await neynar.fetchBulkUsers([fid]);

    return farcasterUsers.users[0] ?? undefined;
  } catch {
    return;
  }
}

export async function resolveFarcasterFname(fname: string, viewer = 2) {
  try {
    const farcasterUser = await neynar.searchUser(fname, viewer);

    return farcasterUser.result.users[0] ?? undefined;
  } catch {
    return;
  }
}
