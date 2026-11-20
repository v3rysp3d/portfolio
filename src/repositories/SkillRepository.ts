import type { SqliteConnection } from '../db/Database';
import { mapSkillRow, type Skill, type SkillInput, type SkillRow } from '../models/Skill';

/** Data-access for skills. */
export class SkillRepository {
  constructor(private readonly db: SqliteConnection) {}

  findAll(): Skill[] {
    const rows = this.db
      .prepare('SELECT * FROM skills ORDER BY category ASC, sort_order ASC, id ASC')
      .all() as SkillRow[];
    return rows.map(mapSkillRow);
  }

  findById(id: number): Skill | null {
    const row = this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as
      | SkillRow
      | undefined;
    return row ? mapSkillRow(row) : null;
  }

  create(input: SkillInput): Skill {
    const info = this.db
      .prepare(
        'INSERT INTO skills (name, category, sort_order) VALUES (@name, @category, @sortOrder)',
      )
      .run({ name: input.name, category: input.category, sortOrder: input.sortOrder });
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) throw new Error('Failed to load skill immediately after insert');
    return created;
  }

  update(id: number, input: SkillInput): Skill | null {
    this.db
      .prepare(
        'UPDATE skills SET name = @name, category = @category, sort_order = @sortOrder WHERE id = @id',
      )
      .run({ id, name: input.name, category: input.category, sortOrder: input.sortOrder });
    return this.findById(id);
  }

  delete(id: number): boolean {
    const info = this.db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return info.changes > 0;
  }
}
