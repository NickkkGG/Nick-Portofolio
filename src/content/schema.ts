import { z } from 'zod';

export const siteSchema = z.object({
  name: z.string().min(1),
  /** The room's title: how the site says hello. */
  greeting: z.string().min(1),
  role: z.string().min(1),
  tagline: z.string().min(1),
});

const projectBase = {
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  year: z.string().optional(),
  role: z.string().optional(),
  tags: z.array(z.string()).default([]),
  link: z.url().optional(),
};

const liveProjectSchema = z.object({
  ...projectBase,
  status: z.literal('live'),
  summary: z.string().min(1),
  media: z.string().startsWith('/projects/'),
});

const noSignalProjectSchema = z.object({
  ...projectBase,
  status: z.literal('no-signal'),
  summary: z.string().min(1).optional(),
  media: z.string().startsWith('/projects/').optional(),
});

export const projectSchema = z.discriminatedUnion('status', [liveProjectSchema, noSignalProjectSchema]);

export const projectsSchema = z.array(projectSchema).superRefine((projects, ctx) => {
  const seen = new Set<string>();
  projects.forEach((project, index) => {
    if (seen.has(project.slug)) {
      ctx.addIssue({ code: 'custom', message: `duplicate slug "${project.slug}"`, path: [index, 'slug'] });
    }
    seen.add(project.slug);
  });
});

/** One slide on the booth's sheet: short enough to read while the scroll keeps going. */
export const slideSchema = z.object({
  title: z.string().min(1).max(32, 'a slide title fits on the sheet in 32 characters'),
  body: z.string().min(1).max(140, 'a slide body fits on the sheet in 140 characters'),
});

export const aboutSchema = z.object({
  /** The projector's slides, one per step of scroll: who, how, and what next (spec: the booth). */
  slides: z.array(slideSchema).min(1).max(8, 'the booth holds at most eight slides'),
  /** The line the bulb lights up in IDEAS. */
  motto: z.string().min(1),
});

export const stackSchema = z.array(
  z.object({
    name: z.string().min(1),
    category: z.string().min(1),
  }),
);

export const contactSchema = z.array(
  z.object({
    label: z.string().min(1),
    href: z.string().refine((href) => href.startsWith('mailto:') || href.startsWith('https://'), {
      message: 'href must start with mailto: or https://',
    }),
  }),
);

export type Site = z.infer<typeof siteSchema>;
export type Project = z.infer<typeof projectSchema>;
export type About = z.infer<typeof aboutSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type StackItem = z.infer<typeof stackSchema>[number];
export type ContactLink = z.infer<typeof contactSchema>[number];

/** Fills the list up to `min` entries with NO SIGNAL slots (spec §6). */
export function padProjects(projects: Project[], min = 6): Project[] {
  const padded = [...projects];
  for (let i = projects.length; i < min; i++) {
    padded.push({ slug: `no-signal-${String(i + 1).padStart(2, '0')}`, title: 'NO SIGNAL', status: 'no-signal', tags: [] });
  }
  return padded;
}

/** Monitor channel label for a 0-based slot index: 0 → "CH-01". */
export function channelLabel(index: number): string {
  return `CH-${String(index + 1).padStart(2, '0')}`;
}

/** A contact address the way someone would scribble it on a tape label: no scheme, no www. */
export function scribbledHref(href: string): string {
  return href.replace(/^mailto:/, '').replace(/^https:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}
