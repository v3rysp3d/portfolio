import type { SqliteConnection } from '../db/Database';
import {
  mapExperienceRow,
  type Experience,
  type ExperienceInput,
  type ExperienceKind,
  type ExperienceRow,
} from '../models/Experience';

/** Data-access for the resume timeline (work / education / certifications). */
export class ExperienceRepository {
  constructor(private readonly db: SqliteConnection) {}

  findAll(): Experience[] {
    const rows = this.db
      .prepare('SELECT * FROM experiences ORDER BY kind ASC, sort_order ASC, id ASC')
      .all() as ExperienceRow[];
    return rows.map(mapExperienceRow);
  }

  findByKind(kind: ExperienceKind): Experience[] {
    const rows = this.db
      .prepare('SELECT * FROM experiences WHERE kind = ? ORDER BY sort_order ASC, id ASC')
      .all(kind) as ExperienceRow[];
    return rows.map(mapExperienceRow);
  }

  findById(id: number): Experience | null {
    const row = this.db.prepare('SELECT * FROM experiences WHERE id = ?').get(id) as
      | ExperienceRow
      | undefined;
    return row ? mapExperienceRow(row) : null;
  }

  maxSortOrder(): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max FROM experiences')
      .get() as { max: number };
    return row.max;
  }

  create(input: ExperienceInput): Experience {
    const info = this.db
      .prepare(
        `INSERT INTO experiences (kind, company, role, location, start_date, end_date, summary, url, sort_order)
         VALUES (@kind, @company, @role, @location, @startDate, @endDate, @summary, @url, @sortOrder)`,
      )
      .run(this.toParams(input));
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) throw new Error('Failed to load experience immediately after insert');
    return created;
  }

  update(id: number, input: ExperienceInput): Experience | null {
    this.db
      .prepare(
        `UPDATE experiences SET
           kind = @kind, company = @company, role = @role, location = @location,
           start_date = @startDate, end_date = @endDate, summary = @summary, url = @url,
           sort_order = @sortOrder
         WHERE id = @id`,
      )
      .run({ ...this.toParams(input), id });
    return this.findById(id);
  }

  delete(id: number): boolean {
    const info = this.db.prepare('DELETE FROM experiences WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private toParams(input: ExperienceInput): Record<string, string | number | null> {
    return {
      kind: input.kind,
      company: input.company,
      role: input.role,
      location: input.location,
      startDate: input.startDate,
      endDate: input.endDate,
      summary: input.summary,
      url: input.url,
      sortOrder: input.sortOrder,
    };
  }
}
