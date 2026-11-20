import type { SqliteConnection } from '../db/Database';
import { mapProfileRow, type Profile, type ProfileInput, type ProfileRow } from '../models/Profile';

/** Data-access for the single-row profile. */
export class ProfileRepository {
  constructor(private readonly db: SqliteConnection) {}

  get(): Profile | null {
    const row = this.db.prepare('SELECT * FROM profile WHERE id = 1').get() as
      | ProfileRow
      | undefined;
    return row ? mapProfileRow(row) : null;
  }

  /** Inserts the profile row if missing, otherwise updates it. */
  upsert(input: ProfileInput): Profile {
    this.db
      .prepare(
        `INSERT INTO profile
           (id, name, headline, location, email, bio,
            github_url, linkedin_url, website_url, resume_url, updated_at)
         VALUES
           (1, @name, @headline, @location, @email, @bio,
            @githubUrl, @linkedinUrl, @websiteUrl, @resumeUrl, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = @name, headline = @headline, location = @location, email = @email,
           bio = @bio, github_url = @githubUrl, linkedin_url = @linkedinUrl,
           website_url = @websiteUrl, resume_url = @resumeUrl, updated_at = datetime('now')`,
      )
      .run({
        name: input.name,
        headline: input.headline,
        location: input.location,
        email: input.email,
        bio: input.bio,
        githubUrl: input.githubUrl,
        linkedinUrl: input.linkedinUrl,
        websiteUrl: input.websiteUrl,
        resumeUrl: input.resumeUrl,
      });

    const profile = this.get();
    if (!profile) throw new Error('Failed to load profile immediately after upsert');
    return profile;
  }
}
