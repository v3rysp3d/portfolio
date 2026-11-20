import type { SqliteConnection } from '../db/Database';
import { mapProjectRow, type Project, type ProjectInput, type ProjectRow } from '../models/Project';

/**
 * Data-access for projects. Every query is a prepared statement bound with
 * parameters, so user input is never concatenated into SQL.
 */
export class ProjectRepository {
  constructor(private readonly db: SqliteConnection) {}

  findAll(): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects ORDER BY sort_order ASC, id ASC')
      .all() as ProjectRow[];
    return rows.map(mapProjectRow);
  }

  findVisible(): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects WHERE visible = 1 ORDER BY sort_order ASC, id ASC')
      .all() as ProjectRow[];
    return rows.map(mapProjectRow);
  }

  findFeatured(): Project[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM projects WHERE visible = 1 AND featured = 1 ORDER BY sort_order ASC, id ASC',
      )
      .all() as ProjectRow[];
    return rows.map(mapProjectRow);
  }

  findById(id: number): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | ProjectRow
      | undefined;
    return row ? mapProjectRow(row) : null;
  }

  findBySlug(slug: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as
      | ProjectRow
      | undefined;
    return row ? mapProjectRow(row) : null;
  }

  /** True if the slug is already taken (optionally ignoring one project id). */
  slugExists(slug: string, exceptId?: number): boolean {
    const row =
      exceptId === undefined
        ? this.db.prepare('SELECT 1 FROM projects WHERE slug = ?').get(slug)
        : this.db.prepare('SELECT 1 FROM projects WHERE slug = ? AND id != ?').get(slug, exceptId);
    return row !== undefined;
  }

  maxSortOrder(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max FROM projects').get() as {
      max: number;
    };
    return row.max;
  }

  create(input: ProjectInput): Project {
    const info = this.db
      .prepare(
        `INSERT INTO projects
           (slug, title, summary, description, role, period, tech_stack, category,
            repo_url, demo_url, image_url, featured, visible, sort_order)
         VALUES
           (@slug, @title, @summary, @description, @role, @period, @techStack, @category,
            @repoUrl, @demoUrl, @imageUrl, @featured, @visible, @sortOrder)`,
      )
      .run(this.toParams(input));

    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) throw new Error('Failed to load project immediately after insert');
    return created;
  }

  update(id: number, input: ProjectInput): Project | null {
    this.db
      .prepare(
        `UPDATE projects SET
           slug = @slug, title = @title, summary = @summary, description = @description,
           role = @role, period = @period, tech_stack = @techStack, category = @category,
           repo_url = @repoUrl, demo_url = @demoUrl, image_url = @imageUrl,
           featured = @featured, visible = @visible, sort_order = @sortOrder,
           updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ ...this.toParams(input), id });

    return this.findById(id);
  }

  delete(id: number): boolean {
    const info = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /** Maps a domain input onto the named bind parameters used by the statements. */
  private toParams(input: ProjectInput): Record<string, string | number | null> {
    return {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      description: input.description,
      role: input.role,
      period: input.period,
      techStack: JSON.stringify(input.techStack ?? []),
      category: input.category,
      repoUrl: input.repoUrl,
      demoUrl: input.demoUrl,
      imageUrl: input.imageUrl,
      featured: input.featured ? 1 : 0,
      visible: input.visible ? 1 : 0,
      sortOrder: input.sortOrder,
    };
  }
}
