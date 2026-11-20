import type { Request, Response } from 'express';
import { config } from '../config/env';
import type { ProjectService } from '../services/ProjectService';
import type { ContentService } from '../services/ContentService';
import type { LabService } from '../services/lab/LabService';
import { NotFoundError } from '../utils/errors';
import { buildPersonJsonLd, buildWebSiteJsonLd } from '../utils/seo';

/** Renders the public-facing pages: home, project index/detail, and the CV. */
export class PublicController {
  constructor(
    private readonly projects: ProjectService,
    private readonly content: ContentService,
    private readonly lab: LabService,
  ) {}

  home = (req: Request, res: Response): void => {
    const featured = this.projects.listFeatured();
    const visible = this.projects.listVisible();
    // Fall back to the first few visible projects if none are flagged featured.
    const selected = featured.length > 0 ? featured : visible.slice(0, 6);

    res.render('public/home', {
      title: null, // home uses the site name as the document title
      canonicalUrl: config.appBaseUrl + '/',
      jsonLd: buildWebSiteJsonLd(res.locals.profile, config.appBaseUrl + '/'),
      selectedProjects: selected,
      totalProjects: visible.length,
      work: this.content.listByKind('work'),
      education: this.content.listByKind('education'),
      certifications: this.content.listByKind('certification'),
      skillGroups: this.content.listSkillGroups(),
      proofTiles: config.lab.enabled ? this.lab.proofTiles() : null,
      isAuthenticated: Boolean(req.session.user),
    });
  };

  projects_index = (_req: Request, res: Response): void => {
    res.render('public/projects', {
      title: 'Projects',
      description: "A selection of things I've designed, built and shipped.",
      canonicalUrl: config.appBaseUrl + '/projects',
      projects: this.projects.listVisible(),
    });
  };

  projectDetail = (req: Request, res: Response): void => {
    const project = this.projects.getBySlug(req.params.slug);

    // Hidden projects are visible only to a signed-in admin (handy for preview).
    if (!project || (!project.visible && !req.session.user)) {
      throw new NotFoundError('That project could not be found.');
    }

    res.render('public/project-detail', {
      title: project.title,
      description: project.summary,
      canonicalUrl: `${config.appBaseUrl}/projects/${project.slug}`,
      project,
    });
  };

  cv = (_req: Request, res: Response): void => {
    const work = this.content.listByKind('work');
    const education = this.content.listByKind('education');
    const featured = this.projects.listFeatured();
    const visible = this.projects.listVisible();
    const selectedProjects = (featured.length > 0 ? featured : visible).slice(0, 6);
    const skillGroups = this.content.listSkillGroups();

    // Server-rendered stats (count-ups only decorate these numbers).
    // start_date is a human string ("Apr 2022"), so extract the year by regex.
    const firstWorkYear = work
      .map((entry) => Number((entry.startDate ?? '').match(/\b(19|20)\d{2}\b/)?.[0]))
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => a - b)[0];
    const yearsActive = firstWorkYear ? Math.max(1, new Date().getFullYear() - firstWorkYear) : null;
    const skillCount = skillGroups.reduce((sum, group) => sum + group.skills.length, 0);

    const profile = res.locals.profile;
    res.render('public/cv', {
      title: 'CV',
      description: `Curriculum vitae of ${profile.name} — ${profile.headline}.`,
      canonicalUrl: config.appBaseUrl + '/cv',
      ogType: 'profile',
      jsonLd: buildPersonJsonLd(profile, work, education, config.appBaseUrl + '/cv'),
      work,
      education,
      certifications: this.content.listByKind('certification'),
      skillGroups,
      selectedProjects,
      stats: {
        yearsActive,
        projectCount: visible.length,
        skillCount,
      },
    });
  };
}
