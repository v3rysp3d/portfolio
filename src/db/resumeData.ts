import type { ProfileInput } from '../models/Profile';
import type { ExperienceInput } from '../models/Experience';

/**
 * Nathan's real profile + resume timeline (work, education, certifications).
 * Company/client work is described generically on purpose — no specifics.
 * Shared by the seeder and the `load-resume` script so they never drift.
 */

export const RESUME_PROFILE: ProfileInput = {
  name: 'Nathan Burr',
  headline: 'Software Engineer & AI Implementation Specialist',
  location: 'Auckland, New Zealand',
  email: 'nateyburr@gmail.com',
  bio:
    'I’m a software engineer based in Auckland, New Zealand. I graduated from Massey University in ' +
    '2025 with a Bachelor of Science in Computer Science, finishing my final year with an A− average.\n\n' +
    'Professionally I work on AI implementation for software-development solutions. In my own time I ' +
    'build across the stack — desktop and mobile apps, game mods, and systems software — in everything ' +
    'from TypeScript and Kotlin to Rust and C++. The projects below are all personal builds.',
  githubUrl: 'https://github.com/v3rysp3d',
  linkedinUrl: 'https://www.linkedin.com/in/nathan-burr-028233193/',
  websiteUrl: null,
  resumeUrl: null,
};

export const RESUME_TIMELINE: ExperienceInput[] = [
  // ── Work ──────────────────────────────────────────────────────────────────
  {
    kind: 'work',
    role: 'AI Implementation Specialist',
    company: 'Integrated Control Technology (ICT)',
    location: 'Auckland, New Zealand',
    startDate: 'Apr 2026',
    endDate: null,
    summary:
      'Promoted to an intermediate-level role delivering AI-driven software-development solutions. ' +
      'Work includes autonomous AI agents built from the ground up, SAP integration, a ' +
      'Stripe-based e-commerce system that replaced Shopify, and custom-built replacements for ' +
      'Zendesk and Salesforce tooling.',
    url: null,
    sortOrder: 1,
  },
  {
    kind: 'work',
    role: 'Associate AI Software Engineer',
    company: 'Integrated Control Technology (ICT)',
    location: 'Auckland, New Zealand',
    startDate: 'Aug 2025',
    endDate: 'Apr 2026',
    summary:
      'Software engineering with Rust and AI-assisted development, including rewriting existing ' +
      'systems in Rust. Progressed from part-time to full-time.',
    url: null,
    sortOrder: 2,
  },
  {
    kind: 'work',
    role: 'Bartender',
    company: 'New Brew Bar & Restaurant',
    location: 'Auckland, New Zealand',
    startDate: 'Apr 2022',
    endDate: 'Mar 2023',
    summary: 'Customer service and bartending.',
    url: null,
    sortOrder: 3,
  },
  // ── Education ───────────────────────────────────────────────────────────────
  {
    kind: 'education',
    role: 'BSc, Computer Science',
    company: 'Massey University',
    location: 'New Zealand',
    startDate: 'Feb 2023',
    endDate: 'Oct 2025',
    summary: 'Bachelor of Science majoring in Computer Science. Final-year average: A−.',
    url: null,
    sortOrder: 1,
  },
  {
    kind: 'education',
    role: 'NCEA Level 3',
    company: 'Kristin School',
    location: 'Auckland, New Zealand',
    startDate: '2017',
    endDate: '2021',
    summary: 'Secondary education with a focus on computer science.',
    url: null,
    sortOrder: 2,
  },
  // ── Certifications ──────────────────────────────────────────────────────────
  // (none yet — add via the admin panel)
];
