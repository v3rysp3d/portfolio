/** Which timeline a row belongs to. */
export type ExperienceKind = 'work' | 'education' | 'certification';

export const EXPERIENCE_KINDS: ExperienceKind[] = ['work', 'education', 'certification'];

/** A work, education, or certification entry in the resume timeline. */
export interface Experience {
  id: number;
  kind: ExperienceKind;
  company: string;
  role: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  summary: string | null;
  url: string | null;
  sortOrder: number;
}

export interface ExperienceRow {
  id: number;
  kind: string;
  company: string;
  role: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
  url: string | null;
  sort_order: number;
}

export interface ExperienceInput {
  kind: ExperienceKind;
  company: string;
  role: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  summary: string | null;
  url: string | null;
  sortOrder: number;
}

function normaliseKind(value: string): ExperienceKind {
  return (EXPERIENCE_KINDS as string[]).includes(value) ? (value as ExperienceKind) : 'work';
}

export function mapExperienceRow(row: ExperienceRow): Experience {
  return {
    id: row.id,
    kind: normaliseKind(row.kind),
    company: row.company,
    role: row.role,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    summary: row.summary,
    url: row.url,
    sortOrder: row.sort_order,
  };
}
