import { Button, Frog, TextInput } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';

import { EXISTING_CHANNEL_ICONS } from '../constants.js';
import { getIcebreakerbyFid, getIcebreakerbyFname } from '../lib/icebreaker.js';
import { posthog } from '../lib/posthog.js';
import { type RenderedProfile } from '../lib/types.js';
import { Box, vars, Heading, HStack, VStack, Image, Text } from '../ui.js';
import {
  compressProfile,
  decompressProfile,
  toRenderedProfile,
} from '../utils.js';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;

type FrogEnv = {
  State: {
    address: string | undefined;
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
    address: undefined,
    profile: undefined,
  },
  headers: {
    'cache-control': 'no-cache, no-store',
  },
});

function Profile({
  avatarUrl,
  displayName,
  bio,
  jobTitle,
  location,
  networkingStatus,
  primarySkill,
  credentialsCount,
  verifiedChannels,
}: RenderedProfile) {
  return (
    <VStack gap="8" width="100%">
      <Box position="absolute" left="0" right="0">
        <Image src={avatarUrl} width="96" height="96" borderRadius="48" />
      </Box>

      <VStack gap="8" marginLeft="16" paddingLeft="96">
        <Heading size="32" color="text" weight="500">
          {displayName}
        </Heading>

        <Text size="20" color="muted" weight="600">
          {jobTitle}
        </Text>

        <Text size="20" color="text" weight="500">
          {bio}
        </Text>

        {!!location && (
          <HStack gap="4">
            <Image src="/location.png" width="20" height="20" />

            <Text size="16" color="text" weight="600">
              {location}
            </Text>
          </HStack>
        )}

        {!!(networkingStatus || primarySkill) && (
          <HStack gap="8" paddingTop="6">
            {!!networkingStatus && (
              <Box
                background="bg-emphasized"
                paddingBottom="4"
                paddingTop="4"
                paddingLeft="12"
                paddingRight="12"
                borderRadius="48"
                textTransform="uppercase"
                alignSelf="flex-start"
                fontSize="16"
                fontWeight="900"
                color="white"
              >
                {networkingStatus}
              </Box>
            )}

            {!!primarySkill && (
              <Box
                background="bg-emphasized"
                paddingBottom="4"
                paddingTop="4"
                paddingLeft="12"
                paddingRight="12"
                borderRadius="48"
                textTransform="uppercase"
                alignSelf="flex-start"
                fontSize="16"
                fontWeight="900"
                color="white"
              >
                {primarySkill}
              </Box>
            )}
          </HStack>
        )}

        <Text size="20" color="muted" weight="600">
          {`${credentialsCount}`} credentials
        </Text>

        {verifiedChannels.length > 0 && (
          <HStack gap="8">
            {verifiedChannels.map((channelType) => (
              <Image
                src={
                  EXISTING_CHANNEL_ICONS.includes(channelType)
                    ? `/${channelType}.png`
                    : '/unknown.png'
                }
                width="20"
                height="20"
              />
            ))}
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}

async function capture(fid?: number, buttonValue?: string, inputText?: string) {
  if (!fid) {
    return;
  }

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

app.frame('/fname/:fname', async (context) => {
  const { fname } = context.req.param();

  const profile = await getIcebreakerbyFname(fname);

  context.previousState.address = profile?.walletAddress ?? '';
  context.previousState.profile =
    compressProfile(toRenderedProfile(profile)) ?? '';

  await capture(context.frameData?.fid, undefined, fname);

  return context.res({
    image: '/profile_img',
    intents: context.previousState.address
      ? [
          <Button.Link
            href={`https://app.icebreaker.xyz/eth/${context.previousState.address}`}
          >
            View
          </Button.Link>,
        ]
      : [
          <TextInput placeholder="Enter farcaster username..." />,
          <Button value="search">Search</Button>,
          <Button value="mine">View mine</Button>,
          <Button.AddCastAction action="/add">
            Install action
          </Button.AddCastAction>,
        ],
    headers: {
      'cache-control': 'no-cache, no-store',
    },
  });
});

app.frame('/fid/:fid', async (context) => {
  const { fid: fidParam } = context.req.param();
  const fid = +fidParam;

  const profile = await getIcebreakerbyFid(fid);

  context.previousState.address = profile?.walletAddress ?? '';
  context.previousState.profile =
    compressProfile(toRenderedProfile(profile)) ?? '';

  await capture(context.frameData?.fid);

  return context.res({
    image: '/profile_img',
    intents: context.previousState.address
      ? [
          <Button.Link
            href={`https://app.icebreaker.xyz/eth/${context.previousState.address}`}
          >
            View
          </Button.Link>,
        ]
      : [
          <TextInput placeholder="Enter farcaster username..." />,
          <Button value="search">Search</Button>,
          <Button value="mine">View mine</Button>,
          <Button.AddCastAction action="/add">
            Install action
          </Button.AddCastAction>,
        ],
    headers: {
      'cache-control': 'no-cache, no-store',
    },
  });
});

app.frame('/', async (context) => {
  const profile =
    context.status === 'initial'
      ? undefined
      : context.buttonValue === 'mine'
        ? await getIcebreakerbyFid(context.frameData?.fid)
        : context.inputText
          ? await getIcebreakerbyFname(context.inputText)
          : undefined;

  context.previousState.address = profile?.walletAddress ?? '';
  context.previousState.profile =
    compressProfile(toRenderedProfile(profile)) ?? '';

  await capture(context.frameData?.fid, context.buttonValue, context.inputText);

  return context.res({
    image: '/profile_img',
    intents:
      context.previousState.address && context.status !== 'initial'
        ? [
            <Button.Link
              href={`https://app.icebreaker.xyz/eth/${context.previousState.address}`}
            >
              View
            </Button.Link>,
            <Button.Reset>Back</Button.Reset>,
          ]
        : [
            <TextInput placeholder="Enter farcaster username..." />,
            <Button value="search">Search</Button>,
            <Button value="mine">View mine</Button>,
            <Button.AddCastAction action="/add">
              Install action
            </Button.AddCastAction>,
          ],
    headers: {
      'cache-control': 'no-cache, no-store',
    },
  });
});

app.frame('/cast-action', async (context) => {
  const profile =
    context.buttonValue === 'reset-search'
      ? undefined
      : context.buttonValue === 'mine'
        ? await getIcebreakerbyFid(context.frameData?.fid)
        : context.inputText
          ? await getIcebreakerbyFname(context.inputText)
          : await getIcebreakerbyFid(context.frameData?.castId.fid);

  context.previousState.address = profile?.walletAddress ?? '';
  context.previousState.profile =
    compressProfile(toRenderedProfile(profile)) ?? '';

  await capture(context.frameData?.fid);

  return context.res({
    image: '/profile_img',
    intents:
      context.previousState.address && context.buttonValue !== 'reset-search'
        ? [
            <Button.Link
              href={`https://app.icebreaker.xyz/eth/${context.previousState.address}`}
            >
              View
            </Button.Link>,
            <Button value="reset-search">Search</Button>,
          ]
        : [
            <TextInput placeholder="Enter farcaster username..." />,
            <Button value="search">Search</Button>,
            <Button value="mine">View mine</Button>,
          ],
    headers: {
      'cache-control': 'no-cache, no-store',
    },
  });
});

app.castAction(
  '/add',
  async (context) => {
    console.log(
      `Cast Action to ${JSON.stringify(context.actionData.castId)} from ${context.actionData.fid}`,
    );

    return context.res({ type: 'frame', path: '/cast-action' });
  },
  {
    name: 'Icebreaker Lookup',
    icon: 'search',
  },
);

app.image('/profile_img', async (context) => {
  const renderedProfile = decompressProfile(context.previousState.profile);

  return context.res({
    image: renderedProfile ? (
      <Box grow backgroundColor="background" padding="20">
        <Profile {...renderedProfile} />
      </Box>
    ) : (
      <Box grow backgroundColor="background">
        <Image src="/image.png" />
      </Box>
    ),
    imageOptions: {
      headers: {
        'cache-control': 'no-cache, no-store',
      },
    },
  });
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined';
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development';

devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
