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
        <Image src={avatarUrl} width="64" height="64" borderRadius="32" />
      </Box>

      <VStack gap="8" marginLeft="16" paddingLeft="64">
        <Heading size="20" color="text" weight="500">
          {displayName}
        </Heading>

        <Text size="14" color="muted" weight="600">
          {jobTitle}
        </Text>

        <Text size="14" color="text" weight="500">
          {bio}
        </Text>

        {!!location && (
          <HStack gap="4">
            <Image src="/location.png" width="16" height="16" />

            <Text size="12" color="text" weight="600">
              {location}
            </Text>
          </HStack>
        )}

        {!!(networkingStatus || primarySkill) && (
          <HStack gap="8">
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
                fontWeight="900"
                color="white"
                fontSize="12"
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
                fontWeight="900"
                color="white"
                fontSize="12"
              >
                {primarySkill}
              </Box>
            )}
          </HStack>
        )}

        <Text size="14" color="muted" weight="600">
          {credentialsCount} credentials
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
                width="16"
                height="16"
              />
            ))}
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}

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
  const fid = frameData?.castId.fid;

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
