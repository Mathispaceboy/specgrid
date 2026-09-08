import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const radar = defineCollection({
  loader: glob({ pattern: '**/!(*PROMPTS*).md', base: './src/content/radar' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.string(),
    author: z.string(),
    category: z.string(),
    target_specs: z.array(z.string()),
    summary: z.string(),
    cta_text: z.string(),
    cta_url: z.string(),
  }),
});

export const collections = { radar };
