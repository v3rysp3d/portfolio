import type { Experience } from '../models/Experience';
import type { Profile } from '../models/Profile';

/**
 * JSON-LD builders for search engines. Serialized with `<` escaped so the
 * payload can never terminate its own <script> block, even if profile text
 * one day contains markup.
 */
function serialize(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildPersonJsonLd(
  profile: Profile,
  work: Experience[],
  education: Experience[],
  url: string,
): string {
  const sameAs = [profile.githubUrl, profile.linkedinUrl, profile.websiteUrl].filter(Boolean);
  const currentJob = work.find((entry) => !entry.endDate) ?? work[0];

  return serialize({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.headline,
    url,
    ...(profile.email ? { email: `mailto:${profile.email}` } : {}),
    ...(profile.location ? { address: { '@type': 'PostalAddress', addressLocality: profile.location } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(currentJob ? { worksFor: { '@type': 'Organization', name: currentJob.company } } : {}),
    ...(education.length
      ? { alumniOf: education.map((entry) => ({ '@type': 'EducationalOrganization', name: entry.company })) }
      : {}),
  });
}

export function buildWebSiteJsonLd(profile: Profile, url: string): string {
  return serialize({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: `${profile.name} — ${profile.headline}`,
    url,
  });
}
