import { config } from '../config/env';
import { Database } from './Database';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { ExperienceRepository } from '../repositories/ExperienceRepository';
import { RESUME_PROFILE, RESUME_TIMELINE } from './resumeData';

/* eslint-disable no-console */

/**
 * One-off loader: replaces the profile and the entire resume timeline (work,
 * education, certifications) with the canonical data in `resumeData.ts`.
 *
 * Unlike the seeder, this OVERWRITES existing content — run it to refresh the
 * live database after editing `resumeData.ts`. Projects and skills are left
 * untouched. Run with `npm run load:resume`.
 */
function loadResume(): void {
  const database = new Database(config.databasePath);
  const conn = database.connection;

  const profiles = new ProfileRepository(conn);
  const experiences = new ExperienceRepository(conn);

  profiles.upsert(RESUME_PROFILE);
  console.log('[load-resume] Profile updated.');

  const replaceTimeline = conn.transaction(() => {
    conn.prepare('DELETE FROM experiences').run();
    for (const entry of RESUME_TIMELINE) experiences.create(entry);
  });
  replaceTimeline();
  console.log(`[load-resume] Replaced timeline with ${RESUME_TIMELINE.length} entries.`);

  database.close();
  console.log('[load-resume] Done.');
}

loadResume();
