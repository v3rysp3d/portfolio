/** Domain representation of a portfolio project (clean types for the app to use). */
export interface Project {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  role: string | null;
  period: string | null;
  techStack: string[];
  category: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  featured: boolean;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Raw row shape as stored in SQLite. */
export interface ProjectRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  role: string | null;
  period: string | null;
  tech_stack: string;
  category: string | null;
  repo_url: string | null;
  demo_url: string | null;
  image_url: string | null;
  featured: number;
  visible: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Fields an admin can set when creating or editing a project. */
export interface ProjectInput {
  slug: string;
  title: string;
  summary: string;
  description: string;
  role: string | null;
  period: string | null;
  techStack: string[];
  category: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  featured: boolean;
  visible: boolean;
  sortOrder: number;
}

export function mapProjectRow(row: ProjectRow): Project {
  let techStack: string[] = [];
  try {
    const parsed = JSON.parse(row.tech_stack);
    if (Array.isArray(parsed)) techStack = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    techStack = [];
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    role: row.role,
    period: row.period,
    techStack,
    category: row.category,
    repoUrl: row.repo_url,
    demoUrl: row.demo_url,
    imageUrl: row.image_url,
    featured: row.featured === 1,
    visible: row.visible === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
