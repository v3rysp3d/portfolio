import type { Project } from '../models/Project';
import type { ProjectRepository } from '../repositories/ProjectRepository';
import type { ProjectFormData } from '../utils/validation';
import { FieldValidationError } from '../utils/errors';
import { slugify } from '../utils/slug';

/**
 * Project business logic. Knows nothing about HTTP or SQL — it orchestrates the
 * repository and enforces invariants such as unique slugs.
 */
export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  listAll(): Project[] {
    return this.projects.findAll();
  }

  listVisible(): Project[] {
    return this.projects.findVisible();
  }

  listFeatured(): Project[] {
    return this.projects.findFeatured();
  }

  getById(id: number): Project | null {
    return this.projects.findById(id);
  }

  getBySlug(slug: string): Project | null {
    return this.projects.findBySlug(slug);
  }

  /** Default sort order for a brand-new project: appended after the last one. */
  nextSortOrder(): number {
    return this.projects.maxSortOrder() + 1;
  }

  create(data: ProjectFormData): Project {
    const slug = this.resolveSlug(data.slug, data.title);
    return this.projects.create({ ...data, slug });
  }

  update(id: number, data: ProjectFormData): Project {
    const slug = this.resolveSlug(data.slug, data.title, id);
    const updated = this.projects.update(id, { ...data, slug });
    if (!updated) throw new FieldValidationError({ _: 'Project no longer exists' });
    return updated;
  }

  delete(id: number): boolean {
    return this.projects.delete(id);
  }

  /**
   * Determines the final slug. An explicitly-provided slug that collides is a
   * hard error; an auto-generated one (from the title) is made unique with a
   * numeric suffix so saving never silently fails.
   */
  private resolveSlug(rawSlug: string | null, title: string, exceptId?: number): string {
    const explicit = !!rawSlug && rawSlug.trim() !== '';
    const base = (explicit ? rawSlug!.trim() : slugify(title)) || 'project';

    if (explicit) {
      if (this.projects.slugExists(base, exceptId)) {
        throw new FieldValidationError({ slug: 'This slug is already in use' });
      }
      return base;
    }

    let candidate = base;
    let n = 2;
    while (this.projects.slugExists(candidate, exceptId)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }
}
