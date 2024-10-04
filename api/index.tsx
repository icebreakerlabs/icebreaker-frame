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
    profileID: string | undefined;
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
    profileID: undefined,
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

async function capture(fid?: number, buttonValue?: string, inputText?: string) {
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
}

app.frame(
  '/',
  async ({ buttonValue, inputText, frameData, deriveState, status, res }) => {
    const { profileID } = await deriveState(async (previousState) => {
      const profile =
        status === 'initial'
          ? undefined
          : buttonValue === 'mine'
            ? await getIcebreakerbyFid(frameData?.fid)
            : inputText
              ? await getIcebreakerbyFname(inputText)
              : undefined;

      previousState.profileID =
        (profile?.profileID ?? profile?.walletAddress)
          ? `wallet-${profile.walletAddress}`
          : '';
      previousState.profile = compressProfile(toRenderedProfile(profile)) ?? '';
    });

    await capture(frameData?.fid, buttonValue, inputText);

    return res({
      image: '/profile_img',
      intents:
        status === 'initial' || !profileID
          ? [
              <TextInput placeholder="Enter farcaster username..." />,
              <Button value="search">Search</Button>,
              <Button value="mine">View mine</Button>,
              <Button.AddCastAction action="/add">Add</Button.AddCastAction>,
            ]
          : [
              <Button.Link
                href={`https://app.icebreaker.xyz/profiles/${profileID}`}
              >
                View
              </Button.Link>,
              <Button.Reset>Reset</Button.Reset>,
            ],
      headers: {
        'cache-control': 'max-age=0',
      },
    });
  },
);

app.frame('/cast-action', async ({ frameData, deriveState, res }) => {
  const { profileID } = await deriveState(async (previousState) => {
    const profile = await getIcebreakerbyFid(frameData?.castId.fid);

    previousState.profileID =
      (profile?.profileID ?? profile?.walletAddress)
        ? `wallet-${profile.walletAddress}`
        : '';
    previousState.profile = compressProfile(toRenderedProfile(profile)) ?? '';
  });

  await capture(frameData?.fid);

  return res({
    image: '/profile_img',
    intents: profileID
      ? [
          <Button.Link
            href={`https://app.icebreaker.xyz/profiles/${profileID}`}
          >
            View
          </Button.Link>,
          <Button.Redirect location="/">Reset</Button.Redirect>,
        ]
      : [
          <TextInput placeholder="Enter farcaster username..." />,
          <Button value="search">Search</Button>,
          <Button value="mine">View mine</Button>,
        ],
    headers: {
      'cache-control': 'max-age=0',
    },
  });
});

app.image('/profile_img', async ({ previousState, res }) => {
  const renderedProfile = decompressProfile(previousState.profile);

  return res({
    image: renderedProfile ? (
      <Box grow backgroundColor="background" padding="60">
        <Profile {...renderedProfile} />
      </Box>
    ) : (
      <Box grow backgroundColor="background">
        <Image src="/image.png" />
      </Box>
    ),
    headers: {
      'cache-control': 'max-age=0',
    },
  });
});

app.castAction(
  '/add',
  async ({ actionData: { castId, fid }, res }) => {
    console.log(`Cast Action to ${JSON.stringify(castId)} from ${fid}`);

    return res({ type: 'frame', path: '/cast-action' });
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
