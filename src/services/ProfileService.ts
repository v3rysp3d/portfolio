import type { Profile, ProfileInput } from '../models/Profile';
import type { ProfileRepository } from '../repositories/ProfileRepository';

export class ProfileService {
  constructor(private readonly profiles: ProfileRepository) {}

  get(): Profile | null {
    return this.profiles.get();
  }

  /** Returns the profile, or a safe empty default if none has been seeded yet. */
  getOrDefault(): Profile {
    return (
      this.profiles.get() ?? {
        name: 'Your Name',
        headline: 'Software Engineer',
        location: null,
        email: null,
        bio: null,
        githubUrl: null,
        linkedinUrl: null,
        websiteUrl: null,
        resumeUrl: null,
        updatedAt: '',
      }
    );
  }

  update(input: ProfileInput): Profile {
    return this.profiles.upsert(input);
  }
}
