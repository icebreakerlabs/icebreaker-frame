export type Channel = {
  type: string;
  isVerified?: boolean;
  isLocked?: boolean;
  value?: string;
  url?: string;
};

export type Credential = {
  name: string;
  chain: string;
  source?: string;
  reference?: string;
};

export type Highlight = {
  title?: string;
  url?: string;
};

export type WorkExperience = {
  jobTitle?: string;
  orgWebsite?: string;
  employmentType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isVerified?: boolean;
};

export type IcebreakerProfile = {
  profileID?: string;
  walletAddress: string;
  avatarUrl?: string;
  displayName?: string;
  jobTitle?: string;
  bio?: string;
  location?: string;
  primarySkill?: string;
  networkingStatus?: string;
  channels?: Channel[];
  credentials?: Credential[];
  highlights?: Highlight[];
  workExperience?: WorkExperience[];
};

export type RenderedProfile = Required<
  Pick<IcebreakerProfile, 'avatarUrl' | 'displayName'>
> &
  Pick<
    IcebreakerProfile,
    'bio' | 'jobTitle' | 'location' | 'networkingStatus' | 'primarySkill'
  > & {
    credentialsCount: number;
    verifiedChannels: Channel['type'][];
  };
