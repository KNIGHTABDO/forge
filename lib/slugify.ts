import { toolExists } from './github';

export function slugify(input: string): string {
  return input.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

export async function findAvailableSlug(title: string): Promise<string> {
  const base = slugify(title) || 'my-tool';
  if (!(await toolExists(base))) return base;
  for (let i = 2; i <= 9; i++) {
    const candidate = `${base}-${i}`;
    if (!(await toolExists(candidate))) return candidate;
  }
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export function titleFromPrompt(prompt: string): string {
  const first = prompt.split(/[.\n]/)[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1).slice(0, 32);
}
