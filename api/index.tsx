import { Button, Frog, TextInput } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';

import { Profile } from '../components/Profile.js';
import { getIcebreakerbyFid, getIcebreakerbyFname } from '../lib/icebreaker.js';
import { posthog } from '../lib/posthog.js';
import { type RenderedProfile } from '../lib/types.js';
import { Box, vars, Image } from '../ui.js';
import {
  compressProfile,
  decompressProfile,
  toRenderedProfile,
} from '../utils.js';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;

type FrogEnv = {
  State: {
    profile: string | undefined;
  };
};

export const app = new Frog<FrogEnv>({
  ui: { vars },
  basePath: '/api',
  assetsPath: '/',
  hub: neynar({ apiKey: NEYNAR_API_KEY }),
  title: 'Icebreaker Lookup Frame',
  initialState: {
    profile: undefined,
  },
});

app.frame(
  '/',
  async ({ buttonValue, inputText, frameData, status, previousState, res }) => {
    const fid = frameData?.fid;

    if (fid) {
      if (inputText) {
        await posthog.capture({
          distinctId: fid.toString(),
          event: 'search',
          properties: { username: inputText },
        });
        await posthog.shutdown();
      } else if (buttonValue === 'mine') {
        await posthog.capture({
          distinctId: fid.toString(),
          event: 'view_mine',
        });
        await posthog.shutdown();
      } else {
        await posthog.identify({
          distinctId: fid.toString(),
          properties: { fid },
        });
        await posthog.shutdown();
      }
    }

    const profile =
      buttonValue === 'mine' && fid
        ? await getIcebreakerbyFid(fid)
        : inputText
          ? await getIcebreakerbyFname(inputText)
          : undefined;

    if (!profile) {
      return res({
        image: '/image.png',
        intents: [
          <TextInput placeholder="Enter farcaster username..." />,
          <Button value="search">Search</Button>,
          <Button value="mine">View mine</Button>,
          status === 'response' && <Button.Reset>Reset</Button.Reset>,
          <Button.AddCastAction action="/add">Add</Button.AddCastAction>,
        ],
      });
    }

    const renderedProfile = toRenderedProfile(profile);

    previousState.profile = compressProfile(renderedProfile);

    return res({
      image: '/profile_img',
      intents: [
        <TextInput placeholder="Enter farcaster username..." />,
        <Button value="search">Search</Button>,
        <Button.Link
          href={`https://app.icebreaker.xyz/profiles/${profile.profileID}`}
        >
          View
        </Button.Link>,
        <Button.Reset>Reset</Button.Reset>,
      ],
    });
  },
);

app.frame('/profile', async ({ frameData, res }) => {
  const fid = frameData?.fid;

  const profile = await getIcebreakerbyFid(fid);

  if (!profile) {
    return res({
      image: '/profile_img',
      headers: {
        'cache-control': 'max-age=0',
      },
      intents: [
        <TextInput placeholder="Enter farcaster username..." />,
        <Button value="search">Search</Button>,
        <Button value="mine">View mine</Button>,
        <Button.Reset>Reset</Button.Reset>,
      ],
    });
  }

  const renderedProfile = toRenderedProfile(profile);

  return res({
    image: (
      <Box grow backgroundColor="background" padding="60">
        <Profile {...renderedProfile} />
      </Box>
    ),
    headers: {
      'cache-control': 'max-age=0',
    },
    intents: [
      <TextInput placeholder="Enter farcaster username..." />,
      <Button value="search">Search</Button>,
      <Button.Link
        href={`https://app.icebreaker.xyz/profiles/${profile.profileID}`}
      >
        View
      </Button.Link>,
      <Button.Reset>Reset</Button.Reset>,
    ],
  });
});

app.image('/profile_img', async ({ previousState, res }) => {
  let renderedProfile: RenderedProfile | undefined;

  if (previousState.profile) {
    try {
      renderedProfile = decompressProfile(previousState.profile);
    } catch {
      renderedProfile = undefined;
    }
  }

  if (!renderedProfile) {
    return res({
      image: (
        <Box grow backgroundColor="background">
          <Image src="/image.png" />
        </Box>
      ),
    });
  }

  return res({
    image: (
      <Box grow backgroundColor="background" padding="60">
        <Profile {...renderedProfile} />
      </Box>
    ),
  });
});

app.castAction(
  '/add',
  async ({ actionData: { castId, fid }, res }) => {
    console.log(`Cast Action to ${JSON.stringify(castId)} from ${fid}`);

    return res({ type: 'frame', path: '/profile' });
  },
  {
    name: 'Icebreaker Lookup',
    icon: 'globe',
  },
);

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined';
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development';

devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
