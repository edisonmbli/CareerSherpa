import {
  Github,
  Linkedin,
  Twitter,
  Dribbble,
  Palette,
  Globe,
  LucideIcon,
} from 'lucide-react'

export type SocialPlatformKey =
  | 'github'
  | 'linkedin'
  | 'twitter'
  | 'dribbble'
  | 'behance'
  | 'website'

export interface SocialPlatformConfig {
  key: SocialPlatformKey
  label: string
  icon: LucideIcon
  domainDisplay: string
  urlPrefix: string
  placeholder: string
}

export const SOCIAL_PLATFORMS: Record<SocialPlatformKey, SocialPlatformConfig> =
{
  github: {
    key: 'github',
    label: 'GitHub',
    icon: Github,
    domainDisplay: 'github.com/',
    urlPrefix: 'https://github.com/',
    placeholder: 'username',
  },
  linkedin: {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    domainDisplay: 'linkedin.com/in/',
    urlPrefix: 'https://www.linkedin.com/in/',
    placeholder: 'username',
  },
  website: {
    key: 'website',
    label: 'Personal Website',
    icon: Globe,
    domainDisplay: 'https://',
    urlPrefix: '', // No prefix for website as it varies
    placeholder: 'your-portfolio.com',
  },
  twitter: {
    key: 'twitter',
    label: 'Twitter / X',
    icon: Twitter,
    domainDisplay: 'twitter.com/',
    urlPrefix: 'https://twitter.com/',
    placeholder: 'username',
  },
  behance: {
    key: 'behance',
    label: 'Behance',
    icon: Palette, // Fallback to Palette as Behance icon is not available
    domainDisplay: 'behance.net/',
    urlPrefix: 'https://www.behance.net/',
    placeholder: 'username',
  },
  dribbble: {
    key: 'dribbble',
    label: 'Dribbble',
    icon: Dribbble,
    domainDisplay: 'dribbble.com/',
    urlPrefix: 'https://dribbble.com/',
    placeholder: 'username',
  },
}

export function getSocialPlatform(
  key: string
): SocialPlatformConfig | undefined {
  return SOCIAL_PLATFORMS[key as SocialPlatformKey]
}
