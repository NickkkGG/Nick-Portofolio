import { expect, test } from '@playwright/test';
import { chapterP, freeze, jumpTo, openExperience, play, state } from './helpers';

const MOTTO = 'Every problem I run into becomes an idea.';
const STACK_TITLE = "Tools I've picked up along the way";
const TAGLINE = "Got a problem? I've got an idea.";

test.describe('chapter texts', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('the room shows name and role at the start and after the loop', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    for (const p of [0.0005, 0.995]) {
      await jumpTo(page, p);
      await expect(texts, `p=${p}`).toContainText("Hi, I'm Nick Nelson");
      await expect(texts, `p=${p}`).toContainText('Creative Developer');
    }
  });

  test('every chapter text stays on screen, clear of the nav', async ({ page }) => {
    const cases: [number, string][] = [
      [chapterP('room', 0.3), "Hi, I'm Nick Nelson"],
      [chapterP('spiral', 0.17), 'DINO with FRIENDS'],
      [chapterP('stack', 0.8), STACK_TITLE],
      [chapterP('stack', 0.8), 'point at a tile'],
      [chapterP('contact', 0.65), 'pick a tape'],
    ];
    const nav = await page.getByRole('navigation').boundingBox();
    for (const [p, text] of cases) {
      await jumpTo(page, p);
      const item = page.getByTestId('chapter-texts').getByText(text);
      await expect(item, `p=${p}`).toBeInViewport({ ratio: 1 });
      const box = await item.boundingBox();
      expect(box!.y, `p=${p}`).toBeGreaterThan(nav!.y + nav!.height);
    }
  });

  test('the spiral names the focused project', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    await jumpTo(page, chapterP('spiral', 0.17));
    await expect(texts).toContainText('01 / 06');
    await expect(texts).toContainText('DINO with FRIENDS');
    await jumpTo(page, chapterP('spiral', 0.46));
    await expect(texts).toContainText('03 / 06');
    await expect(texts).toContainText('Project 03');
  });

  test('a live project says what it is, and links out to play it', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    await jumpTo(page, chapterP('spiral', 0.17));
    await expect(texts).toContainText('race up to 8 friends live on the same course');
    await expect(texts).toContainText('Multiplayer · TypeScript · React · Cloudflare Workers');
    await expect(texts).not.toContainText('NO SIGNAL');
    const link = texts.getByRole('link', { name: /PLAY IT/ });
    await expect(link).toHaveAttribute('href', 'https://dino-with-friends.nicknelsoon30.workers.dev');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toBeInViewport({ ratio: 1 });
    // The texts let the pointer through to the scene; the link has to take it.
    await link.click({ trial: true });
  });

  test("a tag's words stay together on one line", async ({ page }) => {
    await jumpTo(page, chapterP('spiral', 0.17));
    const tags = page.getByTestId('chapter-texts').getByText('Multiplayer · TypeScript');
    const tops = await tags.evaluate((element) => {
      const tag = 'Cloudflare Workers';
      const from = (element.textContent ?? '').replace(/\s/g, ' ').indexOf(tag);
      const chars = Array.from(element.querySelectorAll('[data-i]')).slice(from, from + tag.length);
      return chars.map((char) => Math.round(char.getBoundingClientRect().top));
    });
    expect(tops).toHaveLength('Cloudflare Workers'.length);
    expect(new Set(tops).size).toBe(1);
  });

  test('the STACK title waits for the wall of tiles', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    await jumpTo(page, chapterP('stack', 0.3));
    await expect(texts.getByText(STACK_TITLE)).toHaveCount(0);
    await jumpTo(page, chapterP('stack', 0.8));
    await expect(texts.getByText(STACK_TITLE)).toBeVisible();
  });
});

test.describe('chapter texts type themselves out where the scroll stops', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
  });

  test('standing at the first monitor, its words finish typing with no more scrolling', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    const at = chapterP('spiral', 0.1);
    await jumpTo(page, chapterP('about', 0.5));
    await jumpTo(page, at);
    // Still typing just after the camera gets there...
    expect(await texts.textContent()).toContain('█');
    // ...and done a moment later, though the scroll has not moved.
    await expect(texts).not.toContainText('█', { timeout: 5000 });
    await expect(texts).toContainText('01 / 06');
    await expect(texts).toContainText('DINO with FRIENDS');
    await expect(texts).toContainText('race up to 8 friends live on the same course.');
    await expect(texts).toContainText('Multiplayer · TypeScript · React · Cloudflare Workers');
    await expect(texts.getByRole('link', { name: /PLAY IT/ })).toBeVisible();
    expect((await state(page)).p).toBeCloseTo(at, 6);
  });

  test('so do the texts of the other chapters', async ({ page }) => {
    const texts = page.getByTestId('chapter-texts');
    const stops: [chapter: string, before: number, at: number, words: string[]][] = [
      ['room', chapterP('room', 0.8), chapterP('room', 0.3), ["Hi, I'm Nick Nelson", 'Creative Developer']],
      // Each hint follows its title in.
      ['stack', chapterP('stack', 0.3), chapterP('stack', 0.7), [STACK_TITLE, '▸ point at a tile', 'on the wall']],
      ['contact', chapterP('contact', 0.1), chapterP('contact', 0.5), [TAGLINE, '▸ pick a tape', 'on the shelf']],
    ];
    for (const [chapter, before, at, words] of stops) {
      await jumpTo(page, before);
      await expect(texts, chapter).not.toContainText('█', { timeout: 5000 });
      await expect(texts, chapter).not.toContainText(words[0]);
      await jumpTo(page, at);
      expect(await texts.textContent(), chapter).toContain('█');
      for (const word of words) await expect(texts, chapter).toContainText(word, { timeout: 5000 });
      await expect(texts, chapter).not.toContainText('█');
      expect((await state(page)).p, chapter).toBeCloseTo(at, 6);
    }
  });

  test('the link waits for its text, so nothing unseen takes the keyboard', async ({ page }) => {
    await jumpTo(page, chapterP('about', 0.5));
    // Every frame while the text types in: whenever the link is there, some of its words are too.
    const frames = await page.evaluate(async (p) => {
      window.__experience!.jumpTo(p);
      const seen: boolean[] = [];
      for (let i = 0; i < 90; i++) {
        await new Promise<void>((done) => requestAnimationFrame(() => done()));
        const link = document.querySelector('[data-testid="chapter-texts"] a');
        if (link) seen.push(link.querySelector('[data-i]') !== null);
      }
      return seen;
    }, chapterP('spiral', 0.1));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames).not.toContain(false);
  });
});

test('content is in the server HTML', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain(MOTTO);
  expect(html).toContain('Problems become ideas.');
  expect(html).toContain('Project 06');
  expect(html).toContain('DINO with FRIENDS');
  expect(html).toContain('href="https://dino-with-friends.nicknelsoon30.workers.dev"');
  expect(html).toContain(STACK_TITLE.replace("'", '&#x27;'));
  expect(html).toContain('JavaScript');
});
