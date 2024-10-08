import { APP_URL } from '../constants.js';
import { type IcebreakerProfile } from './types.js';

const API_URL = `${APP_URL}/api/v1`;

async function request<T>(path: string, options?: RequestInit) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        accept: 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching profile: ${response.statusText}`);
    }

    const data: T = await response.json();

    return data;
  } catch (err) {
    console.error(err);
    return;
  }
}

type ProfileResponse = {
  profiles: IcebreakerProfile[];
};

export async function getIcebreakerbyFname(fname?: string) {
  if (!fname) {
    return;
  }

  const response = await request<ProfileResponse>(`/fname/${fname}`);

  return response?.profiles[0];
}

export async function getIcebreakerbyFid(fid?: number) {
  if (!fid) {
    return;
  }

  const response = await request<ProfileResponse>(`/fid/${fid}`);

  return response?.profiles[0];
}
