/** A single skill, grouped under a category. */
export interface Skill {
  id: number;
  name: string;
  category: string;
  sortOrder: number;
}

export interface SkillRow {
  id: number;
  name: string;
  category: string;
  sort_order: number;
}

export interface SkillInput {
  name: string;
  category: string;
  sortOrder: number;
}

/** Skills bucketed by category, for rendering grouped lists. */
export interface SkillGroup {
  category: string;
  skills: Skill[];
}

export function mapSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sortOrder: row.sort_order,
  };
}
