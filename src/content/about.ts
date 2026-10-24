import type { z } from 'zod';
import type { aboutSchema } from './schema';
import { site } from './site';

// Placeholders still: slide 4's team project, slide 5's hobbies and slide 6's Swift line.
// Replace them with your own story before it goes live.
export const about: z.input<typeof aboutSchema> = {
  slides: [
    {
      title: `Hi, I'm ${site.name}.`,
      body: 'Information Systems student, semester 5, at Universitas Atma Jaya Yogyakarta. I design and build things for the web.',
    },
    {
      title: 'Problems become ideas.',
      body: "When something around me doesn't work, I ask why, who else feels it, and what would make it better.",
    },
    {
      title: 'I learn by building.',
      body: 'Before this site I had never touched 3D. I learned Blender, three.js and shaders by building it, one scene at a time.',
    },
    {
      title: 'Better together.',
      body: 'In a semester team project I took the front end and our Git workflow, and we shipped a working app before the deadline.',
    },
    {
      title: 'Off screen.',
      body: 'I walk around Jogja and listen to a lot of music. Most of my ideas show up away from the desk.',
    },
    {
      title: 'Next.',
      body: "Apps for iPhone. I'm looking for a place to learn Swift and turn ideas into apps people actually use.",
    },
  ],
  motto: 'Every problem I run into becomes an idea.',
};
