import {
  Button,
  CastActionContext,
  ComposerActionContext,
  type FrameContext,
  Frog,
  TextInput,
} from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';

import {
  APP_URL,
  EXISTING_CHANNEL_ICONS,
  FRAME_URL,
  NEYNAR_API_KEY,
} from '../constants.js';
import { getIcebreakerbyFid, getIcebreakerbyFname } from '../lib/icebreaker.js';
import { posthog } from '../lib/posthog.js';
import { type IcebreakerProfile, type RenderedProfile } from '../lib/types.js';
import { Box, vars, Heading, HStack, VStack, Image, Text } from '../ui.js';
import {
  compressProfile,
  decompressProfile,
  getFIDFromChannels,
  toRenderedProfile,
} from '../utils.js';

type FrogEnv = {
  State: {
    profile: string | undefined;
  };
};

type Context =
  | FrameContext<FrogEnv>
  | CastActionContext<FrogEnv>
  | ComposerActionContext<FrogEnv>;

export const app = new Frog<FrogEnv>({
  ui: { vars },
  basePath: '/api',
  assetsPath: '/',
  hub: neynar({ apiKey: NEYNAR_API_KEY }),
  title: 'Icebreaker Lookup Frame',
  initialState: {
    profile: undefined,
  },
  headers: {
    'cache-control': 'no-cache, no-store, max-age=0',
  },
  imageOptions: {
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
    },
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
  verifiedChannels,
  verifiedCompanies,
  highlightedCredentials,
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

        {!!verifiedCompanies.length && (
          <HStack gap="8" marginTop="6">
            {verifiedCompanies.map((company) => (
              <HStack
                background="bg-emphasized"
                gap="4"
                paddingBottom="4"
                paddingTop="4"
                paddingLeft="12"
                paddingRight="12"
                borderRadius="48"
                alignSelf="flex-start"
                fontSize="16"
                fontWeight="900"
                color="white"
                alignItems="center"
              >
                {company} <Image src="/verified.png" width="12" height="12" />
              </HStack>
            ))}
          </HStack>
        )}

        {!!highlightedCredentials.length && (
          <HStack gap="8">
            {highlightedCredentials.map((credential) => (
              <HStack
                background="bg-emphasized"
                gap="4"
                paddingBottom="4"
                paddingTop="4"
                paddingLeft="12"
                paddingRight="12"
                borderRadius="48"
                alignSelf="flex-start"
                fontSize="16"
                fontWeight="900"
                color="white"
                alignItems="center"
              >
                {credential}{' '}
                <Image
                  src={
                    credential === 'Feather Ice'
                      ? '/warning.png'
                      : '/verified.png'
                  }
                  width="12"
                  height="12"
                />
              </HStack>
            ))}
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
      </VStack>
    </VStack>
  );
}

async function capture(
  context: Context,
  { fid, fname }: { fid?: number; fname?: string } = {},
) {
  const viewerFID =
    'frameData' in context
      ? context.frameData?.fid
      : 'actionData' in context
        ? context.actionData.fid
        : undefined;

  if (!viewerFID) {
    return;
  }

  if ('inputText' in context && context.inputText) {
    await posthog.capture({
      distinctId: viewerFID.toString(),
      event: 'search',
      properties: { username: context.inputText },
    });
  } else if ('buttonValue' in context && context.buttonValue === 'mine') {
    await posthog.capture({
      distinctId: viewerFID.toString(),
      event: 'view_mine',
    });
  } else if (fname) {
    await posthog.capture({
      distinctId: viewerFID.toString(),
      event: 'view',
      properties: { username: fname },
    });
  } else if (fid) {
    await posthog.capture({
      distinctId: viewerFID.toString(),
      event: 'view',
      properties: { fid },
    });
  }

  await posthog.shutdown();
}

function render(context: FrameContext<FrogEnv>, profile?: IcebreakerProfile) {
  const fid = getFIDFromChannels(profile?.channels);
  const url = fid
    ? encodeURIComponent(`${FRAME_URL}/api/composer?fid=${fid}`)
    : undefined;

  context.previousState.profile =
    compressProfile(toRenderedProfile(profile)) ?? '';

  if (fid && profile && context.buttonValue !== 'reset-search') {
    return context.res({
      image: `/profile/${fid}`,
      browserLocation: `${APP_URL}/fid/${fid}`,
      intents: [
        <Button.Link href={`https://warpcast.com/~/composer-action?url=${url}`}>
          View
        </Button.Link>,
        <Button.Link href={`${APP_URL}/fid/${fid}`}>Icebreaker</Button.Link>,
        <Button value="reset-search">Back</Button>,
      ],
      headers: {
        'cache-control': 'no-cache, no-store, max-age=0',
      },
    });
  }

  return context.res({
    image: '/default',
    browserLocation: APP_URL,
    intents: [
      <TextInput placeholder="Enter farcaster username..." />,
      <Button value="search">Search</Button>,
      <Button value="mine">View mine</Button>,
      <Button.AddCastAction action="/add">Install action</Button.AddCastAction>,
    ],
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
    },
  });
}

function getIcebreaker(
  context: Context,
  { fid, fname }: { fid?: number; fname?: string } = {},
) {
  const buttonValue =
    'buttonValue' in context ? context.buttonValue : undefined;
  const inputText = 'inputText' in context ? context.inputText : undefined;
  const frameData = 'frameData' in context ? context.frameData : undefined;

  console.log(frameData);

  if (buttonValue === 'reset-search') {
    return;
  }
  if (buttonValue === 'mine') {
    return getIcebreakerbyFid(frameData?.fid);
  }
  if (inputText) {
    return getIcebreakerbyFname(inputText);
  }
  if (fname) {
    return getIcebreakerbyFname(fname);
  }
  if (fid) {
    return getIcebreakerbyFid(fid);
  }
}

app.frame('/', async (context) => {
  await capture(context);

  const profile = await getIcebreaker(context);

  return render(context, profile);
});

app.frame('/fname/:fname', async (context) => {
  const { fname } = context.req.param();

  await capture(context, { fname });

  const profile = await getIcebreaker(context, { fname });

  return render(context, profile);
});

app.frame('/fid/:fid', async (context) => {
  const fid = +context.req.param().fid;

  await capture(context, { fid });

  const profile = await getIcebreaker(context, { fid });

  return render(context, profile);
});

app.frame('/cast-action', async (context) => {
  const fid = context.frameData?.castId.fid;

  await capture(context, { fid });

  const profile = await getIcebreaker(context, { fid });

  return render(context, profile);
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

app.composerAction(
  '/composer',
  async (context) => {
    const fidParam = context.req.query().fid;

    if (!fidParam) {
      return context.error({
        message: 'FID is required',
        statusCode: 400,
      });
    }

    const fid = +fidParam;

    console.log(`Composer Action to ${fid} from ${context.actionData.fid}`);

    await capture(context, { fid });

    return context.res({
      title: 'View Icebreaker',
      url: `${APP_URL}/fid/${fid}`,
    });
  },
  {
    name: 'Icebreaker',
    description: 'View Icebreaker',
    icon: 'search',
    imageUrl: `${APP_URL}/icon-256x256.png`,
  },
);

app.image('/default', async (context) => {
  return context.res({
    image: (
      <Box grow backgroundColor="background">
        <Image src="/image.png" />
      </Box>
    ),
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
    },
    imageOptions: {
      headers: {
        'cache-control': 'no-cache, no-store, max-age=0',
      },
    },
  });
});

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
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
    },
    imageOptions: {
      headers: {
        'cache-control': 'no-cache, no-store, max-age=0',
      },
    },
  });
});

app.image('/profile/:fid', async (context) => {
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
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
    },
    imageOptions: {
      headers: {
        'cache-control': 'no-cache, no-store, max-age=0',
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
