import type { Experience, ExperienceInput, ExperienceKind } from '../models/Experience';
import type { Skill, SkillGroup, SkillInput } from '../models/Skill';
import type { ExperienceRepository } from '../repositories/ExperienceRepository';
import type { SkillRepository } from '../repositories/SkillRepository';

/** Business logic for the supporting profile content: experience and skills. */
export class ContentService {
  constructor(
    private readonly experiences: ExperienceRepository,
    private readonly skills: SkillRepository,
  ) {}

  // ── Experience ────────────────────────────────────────────────────────────
  listExperiences(): Experience[] {
    return this.experiences.findAll();
  }

  listByKind(kind: ExperienceKind): Experience[] {
    return this.experiences.findByKind(kind);
  }

  getExperience(id: number): Experience | null {
    return this.experiences.findById(id);
  }

  nextExperienceSortOrder(): number {
    return this.experiences.maxSortOrder() + 1;
  }

  createExperience(input: ExperienceInput): Experience {
    return this.experiences.create(input);
  }

  updateExperience(id: number, input: ExperienceInput): Experience | null {
    return this.experiences.update(id, input);
  }

  deleteExperience(id: number): boolean {
    return this.experiences.delete(id);
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  listSkills(): Skill[] {
    return this.skills.findAll();
  }

  /** Skills bucketed by category, preserving the stored ordering. */
  listSkillGroups(): SkillGroup[] {
    const groups = new Map<string, Skill[]>();
    for (const skill of this.skills.findAll()) {
      const bucket = groups.get(skill.category) ?? [];
      bucket.push(skill);
      groups.set(skill.category, bucket);
    }
    return Array.from(groups.entries()).map(([category, skills]) => ({ category, skills }));
  }

  getSkill(id: number): Skill | null {
    return this.skills.findById(id);
  }

  createSkill(input: SkillInput): Skill {
    return this.skills.create(input);
  }

  updateSkill(id: number, input: SkillInput): Skill | null {
    return this.skills.update(id, input);
  }

  deleteSkill(id: number): boolean {
    return this.skills.delete(id);
  }
}
