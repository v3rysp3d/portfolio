import type { Request, Response } from 'express';
import type { ProjectService } from '../services/ProjectService';
import type { ProfileService } from '../services/ProfileService';
import type { ContentService } from '../services/ContentService';
import type { AuthService } from '../services/AuthService';
import type { Project } from '../models/Project';
import type { Experience } from '../models/Experience';
import type { Skill } from '../models/Skill';
import { FieldValidationError, NotFoundError } from '../utils/errors';
import {
  experienceSchema,
  fieldErrors,
  passwordChangeSchema,
  profileSchema,
  projectSchema,
  skillSchema,
} from '../utils/validation';

/**
 * Admin panel controller. Each mutating action validates input, delegates to a
 * service, and re-renders the relevant form with field errors (preserving the
 * submitted values) when validation fails — so nothing is lost on a typo.
 */
export class AdminController {
  constructor(
    private readonly projects: ProjectService,
    private readonly profiles: ProfileService,
    private readonly content: ContentService,
    private readonly auth: AuthService,
  ) {}

  // ── Dashboard ───────────────────────────────────────────────────────────
  dashboard = (_req: Request, res: Response): void => {
    const allProjects = this.projects.listAll();
    res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: {
        projects: allProjects.length,
        visibleProjects: allProjects.filter((p) => p.visible).length,
        experiences: this.content.listExperiences().length,
        skills: this.content.listSkills().length,
      },
      recentProjects: allProjects.slice(0, 5),
    });
  };

  // ── Projects ──────────────────────────────────────────────────────────────
  listProjects = (_req: Request, res: Response): void => {
    res.render('admin/projects-index', {
      title: 'Manage projects',
      projects: this.projects.listAll(),
    });
  };

  newProjectForm = (_req: Request, res: Response): void => {
    res.render('admin/project-form', {
      title: 'New project',
      mode: 'new',
      actionUrl: '/admin/projects',
      form: {
        slug: '',
        title: '',
        summary: '',
        description: '',
        role: '',
        period: '',
        techStack: '',
        category: '',
        repoUrl: '',
        demoUrl: '',
        imageUrl: '',
        featured: false,
        visible: true,
        sortOrder: this.projects.nextSortOrder(),
      },
      errors: {} as Record<string, string>,
    });
  };

  createProject = (req: Request, res: Response): void => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderProjectForm(res, 'new', '/admin/projects', req.body, fieldErrors(parsed.error), 422);
      return;
    }
    try {
      const project = this.projects.create(parsed.data);
      req.session.flash = [{ type: 'success', message: `Project “${project.title}” created.` }];
      res.redirect('/admin/projects');
    } catch (err) {
      if (err instanceof FieldValidationError) {
        this.renderProjectForm(res, 'new', '/admin/projects', req.body, err.fields, 422);
        return;
      }
      throw err;
    }
  };

  editProjectForm = (req: Request, res: Response): void => {
    const project = this.requireProject(req);
    res.render('admin/project-form', {
      title: `Edit ${project.title}`,
      mode: 'edit',
      actionUrl: `/admin/projects/${project.id}`,
      form: this.projectToForm(project),
      errors: {} as Record<string, string>,
    });
  };

  updateProject = (req: Request, res: Response): void => {
    const project = this.requireProject(req);
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderProjectForm(
        res,
        'edit',
        `/admin/projects/${project.id}`,
        req.body,
        fieldErrors(parsed.error),
        422,
      );
      return;
    }
    try {
      const updated = this.projects.update(project.id, parsed.data);
      req.session.flash = [{ type: 'success', message: `Project “${updated.title}” updated.` }];
      res.redirect('/admin/projects');
    } catch (err) {
      if (err instanceof FieldValidationError) {
        this.renderProjectForm(
          res,
          'edit',
          `/admin/projects/${project.id}`,
          req.body,
          err.fields,
          422,
        );
        return;
      }
      throw err;
    }
  };

  deleteProject = (req: Request, res: Response): void => {
    const project = this.requireProject(req);
    this.projects.delete(project.id);
    req.session.flash = [{ type: 'success', message: `Project “${project.title}” deleted.` }];
    res.redirect('/admin/projects');
  };

  // ── Profile ────────────────────────────────────────────────────────────────
  profileForm = (_req: Request, res: Response): void => {
    const profile = this.profiles.getOrDefault();
    res.render('admin/profile', {
      title: 'Edit profile',
      form: {
        name: profile.name,
        headline: profile.headline,
        location: profile.location ?? '',
        email: profile.email ?? '',
        bio: profile.bio ?? '',
        githubUrl: profile.githubUrl ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        websiteUrl: profile.websiteUrl ?? '',
        resumeUrl: profile.resumeUrl ?? '',
      },
      errors: {} as Record<string, string>,
    });
  };

  updateProfile = (req: Request, res: Response): void => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).render('admin/profile', {
        title: 'Edit profile',
        form: req.body,
        errors: fieldErrors(parsed.error),
      });
      return;
    }
    this.profiles.update(parsed.data);
    req.session.flash = [{ type: 'success', message: 'Profile updated.' }];
    res.redirect('/admin/profile');
  };

  // ── Experience ──────────────────────────────────────────────────────────────
  listExperience = (_req: Request, res: Response): void => {
    res.render('admin/experience-index', {
      title: 'Manage experience',
      experiences: this.content.listExperiences(),
    });
  };

  newExperienceForm = (_req: Request, res: Response): void => {
    res.render('admin/experience-form', {
      title: 'New experience',
      mode: 'new',
      actionUrl: '/admin/experience',
      form: {
        kind: 'work',
        company: '',
        role: '',
        location: '',
        startDate: '',
        endDate: '',
        summary: '',
        url: '',
        sortOrder: this.content.nextExperienceSortOrder(),
      },
      errors: {} as Record<string, string>,
    });
  };

  createExperience = (req: Request, res: Response): void => {
    const parsed = experienceSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderExperienceForm(res, 'new', '/admin/experience', req.body, fieldErrors(parsed.error));
      return;
    }
    this.content.createExperience(parsed.data);
    req.session.flash = [{ type: 'success', message: 'Experience added.' }];
    res.redirect('/admin/experience');
  };

  editExperienceForm = (req: Request, res: Response): void => {
    const experience = this.requireExperience(req);
    res.render('admin/experience-form', {
      title: `Edit ${experience.role}`,
      mode: 'edit',
      actionUrl: `/admin/experience/${experience.id}`,
      form: this.experienceToForm(experience),
      errors: {} as Record<string, string>,
    });
  };

  updateExperience = (req: Request, res: Response): void => {
    const experience = this.requireExperience(req);
    const parsed = experienceSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderExperienceForm(
        res,
        'edit',
        `/admin/experience/${experience.id}`,
        req.body,
        fieldErrors(parsed.error),
      );
      return;
    }
    this.content.updateExperience(experience.id, parsed.data);
    req.session.flash = [{ type: 'success', message: 'Experience updated.' }];
    res.redirect('/admin/experience');
  };

  deleteExperience = (req: Request, res: Response): void => {
    const experience = this.requireExperience(req);
    this.content.deleteExperience(experience.id);
    req.session.flash = [{ type: 'success', message: 'Experience deleted.' }];
    res.redirect('/admin/experience');
  };

  // ── Skills ───────────────────────────────────────────────────────────────────
  listSkills = (_req: Request, res: Response): void => {
    res.render('admin/skills-index', {
      title: 'Manage skills',
      skillGroups: this.content.listSkillGroups(),
    });
  };

  newSkillForm = (_req: Request, res: Response): void => {
    res.render('admin/skill-form', {
      title: 'New skill',
      mode: 'new',
      actionUrl: '/admin/skills',
      form: { name: '', category: '', sortOrder: 0 },
      errors: {} as Record<string, string>,
    });
  };

  createSkill = (req: Request, res: Response): void => {
    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderSkillForm(res, 'new', '/admin/skills', req.body, fieldErrors(parsed.error));
      return;
    }
    this.content.createSkill(parsed.data);
    req.session.flash = [{ type: 'success', message: 'Skill added.' }];
    res.redirect('/admin/skills');
  };

  editSkillForm = (req: Request, res: Response): void => {
    const skill = this.requireSkill(req);
    res.render('admin/skill-form', {
      title: `Edit ${skill.name}`,
      mode: 'edit',
      actionUrl: `/admin/skills/${skill.id}`,
      form: { name: skill.name, category: skill.category, sortOrder: skill.sortOrder },
      errors: {} as Record<string, string>,
    });
  };

  updateSkill = (req: Request, res: Response): void => {
    const skill = this.requireSkill(req);
    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderSkillForm(res, 'edit', `/admin/skills/${skill.id}`, req.body, fieldErrors(parsed.error));
      return;
    }
    this.content.updateSkill(skill.id, parsed.data);
    req.session.flash = [{ type: 'success', message: 'Skill updated.' }];
    res.redirect('/admin/skills');
  };

  deleteSkill = (req: Request, res: Response): void => {
    const skill = this.requireSkill(req);
    this.content.deleteSkill(skill.id);
    req.session.flash = [{ type: 'success', message: 'Skill deleted.' }];
    res.redirect('/admin/skills');
  };

  // ── Account / password ────────────────────────────────────────────────────────
  accountForm = (_req: Request, res: Response): void => {
    res.render('admin/account', { title: 'Account', errors: {} as Record<string, string> });
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).render('admin/account', { title: 'Account', errors: fieldErrors(parsed.error) });
      return;
    }
    const userId = req.session.user?.id;
    if (!userId) {
      res.redirect('/admin/login');
      return;
    }
    try {
      await this.auth.changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
      req.session.flash = [{ type: 'success', message: 'Password changed.' }];
      res.redirect('/admin/account');
    } catch (err) {
      if (err instanceof FieldValidationError) {
        res.status(422).render('admin/account', { title: 'Account', errors: err.fields });
        return;
      }
      throw err;
    }
  };

  // ── Private helpers ─────────────────────────────────────────────────────────────
  private requireProject(req: Request): Project {
    const project = this.projects.getById(this.parseId(req.params.id));
    if (!project) throw new NotFoundError('Project not found.');
    return project;
  }

  private requireExperience(req: Request): Experience {
    const experience = this.content.getExperience(this.parseId(req.params.id));
    if (!experience) throw new NotFoundError('Experience not found.');
    return experience;
  }

  private requireSkill(req: Request): Skill {
    const skill = this.content.getSkill(this.parseId(req.params.id));
    if (!skill) throw new NotFoundError('Skill not found.');
    return skill;
  }

  private parseId(raw: string): number {
    const id = Number.parseInt(raw, 10);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Invalid id.');
    return id;
  }

  private projectToForm(project: Project): Record<string, unknown> {
    return {
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      description: project.description,
      role: project.role ?? '',
      period: project.period ?? '',
      techStack: project.techStack.join(', '),
      category: project.category ?? '',
      repoUrl: project.repoUrl ?? '',
      demoUrl: project.demoUrl ?? '',
      imageUrl: project.imageUrl ?? '',
      featured: project.featured,
      visible: project.visible,
      sortOrder: project.sortOrder,
    };
  }

  private experienceToForm(experience: Experience): Record<string, unknown> {
    return {
      kind: experience.kind,
      company: experience.company,
      role: experience.role,
      location: experience.location ?? '',
      startDate: experience.startDate ?? '',
      endDate: experience.endDate ?? '',
      summary: experience.summary ?? '',
      url: experience.url ?? '',
      sortOrder: experience.sortOrder,
    };
  }

  private renderProjectForm(
    res: Response,
    mode: 'new' | 'edit',
    actionUrl: string,
    form: unknown,
    errors: Record<string, string>,
    status = 200,
  ): void {
    res.status(status).render('admin/project-form', {
      title: mode === 'new' ? 'New project' : 'Edit project',
      mode,
      actionUrl,
      form,
      errors,
    });
  }

  private renderExperienceForm(
    res: Response,
    mode: 'new' | 'edit',
    actionUrl: string,
    form: unknown,
    errors: Record<string, string>,
  ): void {
    res.status(422).render('admin/experience-form', {
      title: mode === 'new' ? 'New experience' : 'Edit experience',
      mode,
      actionUrl,
      form,
      errors,
    });
  }

  private renderSkillForm(
    res: Response,
    mode: 'new' | 'edit',
    actionUrl: string,
    form: unknown,
    errors: Record<string, string>,
  ): void {
    res.status(422).render('admin/skill-form', {
      title: mode === 'new' ? 'New skill' : 'Edit skill',
      mode,
      actionUrl,
      form,
      errors,
    });
  }
}
