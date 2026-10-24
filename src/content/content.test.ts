import { describe, expect, it } from 'vitest';
import { content } from './index';
import { aboutSchema, channelLabel, contactSchema, padProjects, type Project, projectSchema, projectsSchema, scribbledHref } from './schema';

function noSignal(n: number): Project {
  const id = String(n).padStart(2, '0');
  return { slug: `p-${id}`, title: `P ${id}`, status: 'no-signal', tags: [] };
}

describe('content', () => {
  it('dummy content parses and has 6 projects', () => {
    expect(content.projects).toHaveLength(6);
    expect(content.stack).toHaveLength(10);
    expect(content.contact.map((c) => c.label)).toEqual(['EMAIL', 'GITHUB', 'LINKEDIN', 'CV']);
  });

  it('the room greets the visitor by name', () => {
    expect(content.site.greeting).toContain(content.site.name);
  });

  it('the about is six slides, the first one naming the owner', () => {
    expect(content.about.slides).toHaveLength(6);
    expect(content.about.slides[0].title).toContain(content.site.name);
    expect(content.about.motto).toBe('Every problem I run into becomes an idea.');
  });

  it('the stack starts with what the owner has used', () => {
    expect(content.stack.slice(0, 3).map((item) => item.name)).toEqual(['JavaScript', 'Python', 'HTML']);
  });

  it('a slide too long for the sheet is rejected and names the field', () => {
    const result = aboutSchema.safeParse({ slides: [{ title: 'Hi', body: 'word '.repeat(40) }], motto: 'm' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('body'))).toBe(true);
  });

  it('the booth holds at most eight slides', () => {
    const slides = Array.from({ length: 9 }, (_, i) => ({ title: `S${i}`, body: 'b' }));
    expect(aboutSchema.safeParse({ slides, motto: 'm' }).success).toBe(false);
    expect(aboutSchema.safeParse({ slides: slides.slice(0, 8), motto: 'm' }).success).toBe(true);
  });

  it('a live project without media is rejected and names the field', () => {
    const result = projectSchema.safeParse({ slug: 'x', title: 'X', status: 'live', summary: 's' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('media'))).toBe(true);
  });

  it('duplicate project slugs are rejected', () => {
    const result = projectsSchema.safeParse([
      { slug: 'a', title: 'A', status: 'no-signal' },
      { slug: 'a', title: 'B', status: 'no-signal' },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join(' ')).toContain('duplicate slug "a"');
  });

  it('padProjects fills up to 6 with no-signal slots', () => {
    const result = padProjects([noSignal(1), noSignal(2), noSignal(3)]);
    expect(result).toHaveLength(6);
    expect(result[3]).toEqual({ slug: 'no-signal-04', title: 'NO SIGNAL', status: 'no-signal', tags: [] });
  });

  it('padProjects keeps longer lists unchanged', () => {
    const input = Array.from({ length: 8 }, (_, i) => noSignal(i + 1));
    expect(padProjects(input)).toEqual(input);
  });

  it('a tape label scribbles the address without scheme or www', () => {
    expect(scribbledHref('mailto:hello@example.com')).toBe('hello@example.com');
    expect(scribbledHref('https://www.linkedin.com/in/example/')).toBe('linkedin.com/in/example');
    expect(scribbledHref('https://github.com/example')).toBe('github.com/example');
  });

  it('channelLabel uses two digits', () => {
    expect(channelLabel(0)).toBe('CH-01');
    expect(channelLabel(9)).toBe('CH-10');
  });

  it('contact href must be mailto or https', () => {
    expect(contactSchema.safeParse([{ label: 'X', href: 'http://x.com' }]).success).toBe(false);
  });
});
