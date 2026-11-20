import type { Request, Response } from 'express';
import { config } from '../config/env';
import type { ProjectService } from '../services/ProjectService';

/**
 * Crawler infrastructure: robots.txt and a dynamic sitemap built from the
 * static public pages plus every visible project slug. Admin and interview
 * session/approval URLs are excluded — those are private by design.
 */
export class SeoController {
  constructor(private readonly projects: ProjectService) {}

  robots = (_req: Request, res: Response): void => {
    res
      .type('text/plain')
      .send(
        [
          'User-agent: *',
          'Allow: /',
          'Disallow: /admin',
          'Disallow: /interview/review/',
          'Disallow: /interview/s/',
          'Disallow: /interview/chat',
          '',
          `Sitemap: ${config.appBaseUrl}/sitemap.xml`,
          '',
        ].join('\n'),
      );
  };

  sitemap = (_req: Request, res: Response): void => {
    const staticPaths = ['/', '/cv', '/projects', '/interview'];
    if (config.lab.enabled) staticPaths.push('/lab', '/lab/red-team');

    const urls = staticPaths.map((p) => `  <url><loc>${config.appBaseUrl}${p}</loc></url>`);
    for (const project of this.projects.listVisible()) {
      const lastmod = project.updatedAt ? `<lastmod>${project.updatedAt.slice(0, 10)}</lastmod>` : '';
      urls.push(`  <url><loc>${config.appBaseUrl}/projects/${project.slug}</loc>${lastmod}</url>`);
    }

    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.join('\n') +
          `\n</urlset>\n`,
      );
  };
}
