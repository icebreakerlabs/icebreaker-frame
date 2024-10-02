import { Button, Frog, TextInput } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';

import { getIcebreakerbyFid, getIcebreakerbyFname } from '../lib/icebreaker.js';
import { posthog } from '../lib/posthog.js';
import { Box, Heading, HStack, vars, VStack, Image, Text } from '../ui.js';
import { type IcebreakerProfile } from '../lib/types.js';
import { EXISTING_CHANNEL_ICONS } from '../constants.js';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;

export const app = new Frog({
  ui: { vars },
  basePath: '/api',
  assetsPath: '/',
  hub: neynar({ apiKey: NEYNAR_API_KEY }),
  title: 'Icebreaker Lookup Frame',
});

app.frame('/', async ({ buttonValue, inputText, frameData, status, res }) => {
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

  return res({
    image: (
      <Box grow backgroundColor="background" padding="60">
        <Profile profile={profile} />
      </Box>
    ),
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

app.frame('/profile', async ({ frameData, res }) => {
  const fid = frameData?.fid;

  const profile = await getIcebreakerbyFid(fid);

  if (!profile) {
    return res({
      image: '/image.png',
      intents: [
        <TextInput placeholder="Enter farcaster username..." />,
        <Button value="search">Search</Button>,
        <Button value="mine">View mine</Button>,
        <Button.Reset>Reset</Button.Reset>,
      ],
    });
  }

  return res({
    image: (
      <Box grow backgroundColor="background" padding="60">
        <Profile profile={profile} />
      </Box>
    ),
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

function truncateAddress(address: string | undefined) {
  return address?.replace(address.slice(6, -4), '...') ?? '';
}

type ProfileProps = {
  profile: IcebreakerProfile;
};

function Profile({ profile }: ProfileProps) {
  const verifiedChannels =
    profile.channels?.filter(({ isVerified }) => isVerified) ?? [];

  return (
    <VStack gap="4" width="100%">
      <Box position="absolute" left="0" right="0">
        <Image
          src={profile.avatarUrl ?? ''}
          width="64"
          height="64"
          borderRadius="32"
        />
      </Box>

      <VStack gap="4" marginLeft="16" paddingLeft="64">
        <Heading size="20" color="text" weight="500">
          {profile.displayName || truncateAddress(profile.walletAddress)}
        </Heading>

        <Text size="14" color="muted" weight="600">
          {profile.jobTitle}
        </Text>

        <Text size="14" color="text" weight="500">
          {profile.bio}
        </Text>

        {!!profile.location && (
          <HStack gap="4">
            <Image src="/location.png" width="16" height="16" />

            <Text size="12" color="text" weight="600">
              {profile.location}
            </Text>
          </HStack>
        )}

        <Text size="14" color="muted" weight="600">
          {profile.credentials?.length ?? 0} credentials
        </Text>

        {verifiedChannels.length > 0 && (
          <HStack gap="4">
            {verifiedChannels.map((channel) => (
              <Image
                src={
                  EXISTING_CHANNEL_ICONS.includes(channel.type)
                    ? `/${channel.type}.png`
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