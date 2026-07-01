import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export type SearchResultKind = 'project' | 'task' | 'rfi' | 'document';

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  label: string;
  sub?: string;
  href: string;
}

async function search(q: string): Promise<SearchResult[]> {
  const like = `%${q}%`;

  const [projects, tasks, rfis, docs] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status')
      .ilike('name', like)
      .limit(5),
    supabase
      .from('tasks')
      .select('id, title, project_id')
      .ilike('title', like)
      .limit(5),
    supabase
      .from('rfis')
      .select('id, title, number, project_id')
      .ilike('title', like)
      .limit(5),
    supabase
      .from('documents')
      .select('id, name, project_id')
      .ilike('name', like)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const p of projects.data ?? []) {
    results.push({
      id: p.id,
      kind: 'project',
      label: p.name,
      sub: p.status ?? undefined,
      href: `/projects/${p.id}`,
    });
  }

  for (const t of tasks.data ?? []) {
    results.push({
      id: t.id,
      kind: 'task',
      label: t.title,
      href: `/projects/${t.project_id}/tasks`,
    });
  }

  for (const r of rfis.data ?? []) {
    results.push({
      id: r.id,
      kind: 'rfi',
      label: r.title,
      sub: `RFI #${r.number}`,
      href: `/projects/${r.project_id}/rfis`,
    });
  }

  for (const d of docs.data ?? []) {
    results.push({
      id: d.id,
      kind: 'document',
      label: d.name,
      href: `/projects/${d.project_id}/documents`,
    });
  }

  return results;
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['global-search', query],
    queryFn: () => search(query),
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}
