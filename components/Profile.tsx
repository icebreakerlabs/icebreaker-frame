import { EXISTING_CHANNEL_ICONS } from '../constants.js';
import { type RenderedProfile } from '../lib/types.js';
import { Box, Heading, HStack, VStack, Image, Text } from '../ui.js';

export type ProfileProps = RenderedProfile;

export function Profile({
  avatarUrl,
  displayName,
  bio,
  jobTitle,
  location,
  networkingStatus,
  primarySkill,
  credentialsCount,
  verifiedChannels,
}: ProfileProps) {
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
