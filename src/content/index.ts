import { about } from './about';
import { contact } from './contact';
import { projects } from './projects';
import { aboutSchema, contactSchema, padProjects, projectsSchema, siteSchema, stackSchema } from './schema';
import { site } from './site';
import { stack } from './stack';

// Parsing at import time makes `npm run build` fail on invalid content (spec §6).
export const content = {
  site: siteSchema.parse(site),
  projects: padProjects(projectsSchema.parse(projects)),
  about: aboutSchema.parse(about),
  stack: stackSchema.parse(stack),
  contact: contactSchema.parse(contact),
};
