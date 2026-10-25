import { content } from '@/content';

/**
 * All site content as plain semantic HTML, rendered on the server: readable by
 * search engines and screen readers while the 3D story runs (spec §4.3).
 */
export function ContentDocument() {
  const { site, projects, about, stack, contact } = content;
  return (
    // fixed (not sr-only's absolute): focusing a link or a find-in-page match in here
    // must never scroll the document, which would throw the story back to the room.
    <div data-testid="content-document" className="sr-only fixed! top-0 left-0">

      <h1>
        {site.name} — {site.role}
      </h1>
      <section>
        <h2>About</h2>
        {about.slides.map((slide) => (
          <div key={slide.title}>
            <h3>{slide.title}</h3>
            <p>{slide.body}</p>
          </div>
        ))}
      </section>
      <section>
        <h2>Work</h2>
        <ul>
          {projects.map((project) => (
            <li key={project.slug}>
              <h3>{project.title}</h3>
              {project.summary && <p>{project.summary}</p>}
              {project.link && <a href={project.link}>{project.title}</a>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Stack</h2>
        <p>{site.stackTitle}</p>
        <ul>
          {stack.map((item) => (
            <li key={item.name}>
              {item.note ? `${item.name} — ${item.note}` : item.name}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Contact</h2>
        <p>{site.tagline}</p>
        <ul>
          {contact.map((link) => (
            <li key={link.label}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
