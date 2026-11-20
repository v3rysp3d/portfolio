import crypto from 'node:crypto';
import { config } from '../config/env';
import { Database } from './Database';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { ExperienceRepository } from '../repositories/ExperienceRepository';
import { SkillRepository } from '../repositories/SkillRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/AuthService';
import type { ProjectInput } from '../models/Project';
import type { SkillInput } from '../models/Skill';
import { RESUME_PROFILE, RESUME_TIMELINE } from './resumeData';

/* eslint-disable no-console */

/**
 * Idempotent seed. Each section only runs if its table is empty, so it is safe
 * to run repeatedly. All project copy is intentionally generic and
 * confidentiality-safe; refine everything from the admin panel.
 */
async function seed(): Promise<void> {
  const database = new Database(config.databasePath);
  const conn = database.connection;

  const projects = new ProjectRepository(conn);
  const profiles = new ProfileRepository(conn);
  const experiences = new ExperienceRepository(conn);
  const skills = new SkillRepository(conn);
  const users = new UserRepository(conn);
  const auth = new AuthService(users);

  await seedAdmin(auth);
  seedProfile(profiles);
  seedProjects(projects);
  seedExperience(experiences);
  seedSkills(skills);

  database.close();
  console.log('\n[seed] Done.');
}

async function seedAdmin(auth: AuthService): Promise<void> {
  const username = (process.env.ADMIN_USERNAME ?? 'nathan').trim() || 'nathan';
  let password = process.env.ADMIN_PASSWORD ?? '';
  let generated = false;

  if (!password) {
    password = crypto.randomBytes(15).toString('base64url'); // ~20 chars
    generated = true;
  }

  const created = await auth.ensureInitialAdmin(username, password);
  if (!created) {
    console.log('[seed] Admin account already exists — skipping.');
    return;
  }

  console.log('\n┌──────────────────────────────────────────────────────────┐');
  console.log('│  Admin account created                                     │');
  console.log('├──────────────────────────────────────────────────────────┤');
  console.log(`│  Username: ${username.padEnd(46)}│`);
  if (generated) {
    console.log(`│  Password: ${password.padEnd(46)}│`);
    console.log('│  (randomly generated — store it now; shown only once)      │');
  } else {
    console.log('│  Password: (from ADMIN_PASSWORD)                           │');
  }
  console.log('│  Change it after first login: /admin/account               │');
  console.log('└──────────────────────────────────────────────────────────┘');
}

function seedProfile(profiles: ProfileRepository): void {
  if (profiles.get()) {
    console.log('[seed] Profile already present — skipping.');
    return;
  }
  profiles.upsert(RESUME_PROFILE);
  console.log('[seed] Profile seeded.');
}

function seedProjects(projects: ProjectRepository): void {
  if (projects.findAll().length > 0) {
    console.log('[seed] Projects already present — skipping.');
    return;
  }

  const data: ProjectInput[] = [
    {
      slug: 'inveya-access-control',
      title: 'Automated Access-Control Platform',
      summary:
        'Embedded Rust firmware, native mobile apps, and AWS cloud for an automated pedestrian access system.',
      description:
        'An end-to-end platform for automated pedestrian access — spanning embedded firmware, native ' +
        'mobile apps, and cloud infrastructure.\n\n' +
        'The firmware is written in async Rust (Embassy) and runs across several microcontroller variants, ' +
        'driving motor control, a secure peripheral bus, and signed over-the-air updates, all backed by a ' +
        'hardware-in-the-loop regression suite. Companion iOS (SwiftUI) and Android (Jetpack Compose) apps ' +
        'provide offline-first control, backed by a Rust cloud service and Terraform-managed AWS infrastructure.',
      role: 'Designer & Developer',
      period: '2024 – 2025',
      techStack: [
        'Rust',
        'Embassy',
        'STM32',
        'SwiftUI',
        'Jetpack Compose',
        'AWS',
        'Terraform',
        'PostgreSQL',
      ],
      category: 'Embedded & Mobile',
      repoUrl: null,
      demoUrl: null,
      imageUrl: null,
      featured: true,
      visible: true,
      sortOrder: 1,
    },
    {
      slug: 'cross-platform-video-editor',
      title: 'Cross-Platform Video Editor',
      summary:
        'Electron + React desktop editor for short-form video, with an FFmpeg export pipeline and 500+ tests.',
      description:
        'A desktop video editor focused on short-form vertical video, built with Electron and React.\n\n' +
        'It features a multi-track timeline, clip trimming, transitions and effects, text overlays, and ' +
        'assisted captioning, with a custom FFmpeg filter-graph pipeline driving export and a real-time ' +
        'canvas preview. Editor state is managed with full undo/redo history, and the project ships with a ' +
        'comprehensive automated test suite of 500+ tests.',
      role: 'Creator & Developer',
      period: '2025',
      techStack: ['Electron', 'React', 'TypeScript', 'FFmpeg', 'Zustand', 'Tailwind CSS', 'Vitest'],
      category: 'Desktop App',
      repoUrl: null,
      demoUrl: null,
      imageUrl: null,
      featured: true,
      visible: true,
      sortOrder: 3,
    },
    {
      slug: 'realtime-automation-platform',
      title: 'Algorithmic Automation Engine',
      summary:
        'Algorithmic automation mod for a Java game client: native C++ A* pathfinding, human-like movement modelling, and real-time remote control with live streaming.',
      description:
        'An algorithmic automation mod for a Java game client, combining automated navigation, human-like ' +
        'movement modelling, real-time remote control, and live video streaming.\n\n' +
        'It embeds an HTTPS/WebSocket server with a browser control panel, secured by token-based ' +
        'authentication (Ed25519 JWTs) and Argon2id password hashing. A native C++ module implements A* ' +
        'pathfinding across the JNI boundary for performance, and a serverless AWS Lambda + DynamoDB backend ' +
        'handles account and licensing logic. Written primarily in Kotlin and Java.',
      role: 'Creator & Developer',
      period: '2024 – 2025',
      techStack: ['Kotlin', 'Java', 'C++', 'Ktor', 'JWT / Ed25519', 'Argon2id', 'AWS Lambda', 'DynamoDB'],
      category: 'Systems & Cloud',
      repoUrl: null,
      demoUrl: null,
      imageUrl: null,
      featured: true,
      visible: true,
      sortOrder: 4,
    },
    {
      slug: 'macromeals',
      title: 'MacroMeals — Nutrition Tracker',
      summary: 'A Kotlin + Jetpack Compose Android app for macro tracking and meal planning.',
      description:
        'A native Android app for tracking daily macronutrients and planning meals.\n\n' +
        'Built with Kotlin and Jetpack Compose following modern Android architecture and Material Design, ' +
        'with a focus on fast logging and a clean, responsive interface.',
      role: 'Creator & Developer',
      period: '2025',
      techStack: ['Kotlin', 'Jetpack Compose', 'Android', 'Material Design 3'],
      category: 'Mobile App',
      repoUrl: null,
      demoUrl: null,
      imageUrl: null,
      featured: false,
      visible: true,
      sortOrder: 5,
    },
  ];

  for (const project of data) projects.create(project);
  console.log(`[seed] ${data.length} projects seeded.`);
}

function seedExperience(experiences: ExperienceRepository): void {
  if (experiences.findAll().length > 0) {
    console.log('[seed] Experience already present — skipping.');
    return;
  }
  for (const entry of RESUME_TIMELINE) experiences.create(entry);
  console.log(`[seed] ${RESUME_TIMELINE.length} timeline entries seeded.`);
}

function seedSkills(skills: SkillRepository): void {
  if (skills.findAll().length > 0) {
    console.log('[seed] Skills already present — skipping.');
    return;
  }

  const groups: Record<string, string[]> = {
    Languages: ['TypeScript', 'Rust', 'Kotlin', 'Java', 'C++', 'C', 'Python', 'Swift', 'SQL'],
    'Frameworks & Libraries': [
      'Node.js',
      'Express',
      'Next.js',
      'React',
      'Electron',
      'Jetpack Compose',
      'SwiftUI',
      'Ktor',
    ],
    'Cloud & DevOps': ['AWS', 'Terraform', 'Docker', 'Vercel', 'Cloudflare', 'GitHub Actions'],
    'Data & Embedded': ['PostgreSQL', 'SQLite', 'DynamoDB', 'STM32', 'FFmpeg'],
    Practices: [
      'Real-time systems',
      'Cryptography & security',
      'Automated testing',
      'CI/CD',
      'OOP & architecture',
    ],
  };

  let count = 0;
  for (const [category, names] of Object.entries(groups)) {
    names.forEach((name, index) => {
      const input: SkillInput = { name, category, sortOrder: index };
      skills.create(input);
      count += 1;
    });
  }
  console.log(`[seed] ${count} skills seeded.`);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
