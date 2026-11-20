/** The single "about me" profile shown across the site. */
export interface Profile {
  name: string;
  headline: string;
  location: string | null;
  email: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  resumeUrl: string | null;
  updatedAt: string;
}

export interface ProfileRow {
  id: number;
  name: string;
  headline: string;
  location: string | null;
  email: string | null;
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  resume_url: string | null;
  updated_at: string;
}

/** Fields an admin can edit on the profile. */
export interface ProfileInput {
  name: string;
  headline: string;
  location: string | null;
  email: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  resumeUrl: string | null;
}

export function mapProfileRow(row: ProfileRow): Profile {
  return {
    name: row.name,
    headline: row.headline,
    location: row.location,
    email: row.email,
    bio: row.bio,
    githubUrl: row.github_url,
    linkedinUrl: row.linkedin_url,
    websiteUrl: row.website_url,
    resumeUrl: row.resume_url,
    updatedAt: row.updated_at,
  };
}
