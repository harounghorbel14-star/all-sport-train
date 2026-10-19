/**
 * Returns one prerequisite cycle (e.g. ["a", "b", "a"]) if the graph has any, otherwise null.
 * Unknown prerequisite slugs are ignored here (the validator reports them separately).
 */
export function findPrerequisiteCycle(nodes: { slug: string; prerequisites: string[] }[]): string[] | null {
  const edges = new Map(nodes.map((n) => [n.slug, n.prerequisites]));
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];
  const visit = (slug: string): string[] | null => {
    if (state.get(slug) === "done") return null;
    if (state.get(slug) === "visiting") return [...path.slice(path.indexOf(slug)), slug];
    state.set(slug, "visiting");
    path.push(slug);
    for (const next of edges.get(slug) ?? []) {
      if (!edges.has(next)) continue;
      const found = visit(next);
      if (found) return found;
    }
    path.pop();
    state.set(slug, "done");
    return null;
  };
  for (const n of nodes) {
    const found = visit(n.slug);
    if (found) return found;
  }
  return null;
}
