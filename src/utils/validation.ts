import { z } from 'zod';
import { config } from '../config/env';

/**
 * Form/validation schemas. These accept raw HTML-form values (everything arrives
 * as strings; checkboxes are absent when unchecked) and coerce them into the
 * typed domain inputs, rejecting anything malformed before it reaches the DB.
 */

const emptyToNull = (v: unknown): unknown => {
  if (v === undefined || v === null) return null; // tolerate missing optional fields
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
};

const toBool = (v: unknown): boolean => v === 'on' || v === 'true' || v === '1' || v === true;

const toInt = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : 0;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const splitList = (v: unknown): string[] => {
  const parts =
    Array.isArray(v)
      ? v.map((x) => String(x))
      : typeof v === 'string'
        ? v.split(/[\n,]/)
        : [];
  const cleaned = parts.map((s) => s.trim()).filter((s) => s.length > 0);
  return Array.from(new Set(cleaned)); // de-duplicate, preserve order
};

/** Only http(s) URLs are allowed, blocking `javascript:`/`data:` href injection. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable());

const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().max(2000).refine(isHttpUrl, 'Must be a valid http or https URL').nullable(),
);

export const projectSchema = z.object({
  slug: z.preprocess(
    emptyToNull,
    z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
      .nullable(),
  ),
  title: z.string().trim().min(1, 'Title is required').max(200),
  summary: z.string().trim().min(1, 'Summary is required').max(600),
  description: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().max(20000)),
  role: optionalText(200),
  period: optionalText(100),
  techStack: z.preprocess(splitList, z.array(z.string().max(60)).max(60)),
  category: optionalText(100),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  imageUrl: optionalUrl,
  featured: z.preprocess(toBool, z.boolean()),
  visible: z.preprocess(toBool, z.boolean()),
  sortOrder: z.preprocess(toInt, z.number().int().min(0).max(1_000_000)),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  headline: z.string().trim().min(1, 'Headline is required').max(200),
  location: optionalText(120),
  email: z.preprocess(
    emptyToNull,
    z.string().email('Must be a valid email').max(254).nullable(),
  ),
  bio: optionalText(8000),
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
  resumeUrl: optionalUrl,
});

export const experienceSchema = z.object({
  kind: z.preprocess(
    (v) => (v === 'education' || v === 'certification' ? v : 'work'),
    z.enum(['work', 'education', 'certification']),
  ),
  company: z.string().trim().min(1, 'Organisation is required').max(160),
  role: z.string().trim().min(1, 'Title is required').max(160),
  location: optionalText(120),
  startDate: optionalText(40),
  endDate: optionalText(40),
  summary: optionalText(2000),
  url: optionalUrl,
  sortOrder: z.preprocess(toInt, z.number().int().min(0).max(1_000_000)),
});

export const skillSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  category: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : 'General'),
    z.string().max(80),
  ),
  sortOrder: z.preprocess(toInt, z.number().int().min(0).max(1_000_000)),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(120),
  password: z.string().min(1, 'Password is required').max(1024),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(1024),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters')
      .max(1024),
    confirmPassword: z.string().min(1, 'Please confirm the new password').max(1024),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  });

/**
 * A would-be interviewer requesting access. `purpose` is free text shown to
 * Nathan when he decides whether to approve. The hidden `website` field is a
 * honeypot — real users never fill it; bots that do are rejected by the
 * controller.
 */
export const accessRequestSchema = z.object({
  email: z.preprocess(
    emptyToNull,
    z.string().email('Please enter a valid email address').max(254),
  ),
  name: optionalText(120),
  purpose: optionalText(1000),
  website: optionalText(200), // honeypot
});

/** A single chat turn from an interviewer. Length is capped by config. */
export const interviewMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Please type a question.')
    .max(config.interview.maxInputChars, `Please keep it under ${config.interview.maxInputChars} characters.`),
});

/** Inferred input types produced by the schemas after coercion. */
export type ProjectFormData = z.infer<typeof projectSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type ExperienceFormData = z.infer<typeof experienceSchema>;
export type SkillFormData = z.infer<typeof skillSchema>;
export type AccessRequestData = z.infer<typeof accessRequestSchema>;
export type InterviewMessageData = z.infer<typeof interviewMessageSchema>;

/** Flattens a ZodError into a simple { field: message } map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
