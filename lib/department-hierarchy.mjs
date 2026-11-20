/**
 * Display-only reporting lines between agents. `parentId` never affects
 * workflow execution, which follows handoff edges only.
 * Owner-direct agents are depth 1, so at most MAX_HIERARCHY_DEPTH levels exist below the owner.
 */
export const MAX_HIERARCHY_DEPTH = 6;
const fail = message => Object.assign(new Error(message), { status: 400 });

/** id -> parent id. Missing, unknown, self and cyclic references report to the owner (null). Stored values are never rewritten. */
export function effectiveParents(departments = []) {
  const byId = new Map();
  for (const item of departments) if (item && typeof item.id === 'string' && !byId.has(item.id)) byId.set(item.id, item);
  const raw = id => {
    const parent = byId.get(id)?.parentId;
    return typeof parent === 'string' && parent !== id && byId.has(parent) ? parent : null;
  };
  const onCycle = id => {
    const seen = new Set();
    for (let current = raw(id); current; current = raw(current)) {
      if (current === id) return true;
      if (seen.has(current)) return false;
      seen.add(current);
    }
    return false;
  };
  return new Map([...byId.keys()].map(id => [id, onCycle(id) ? null : raw(id)]));
}

/** Levels from the owner: an owner-direct agent is 1. */
export function depthOf(parents, id) {
  let depth = 0;
  for (let current = id, seen = new Set(); current && !seen.has(current); current = parents.get(current) ?? null) { seen.add(current); depth++; }
  return depth;
}

/** Levels in the subtree rooted at id, including id itself. */
export function subtreeHeight(parents, id) {
  const children = new Map();
  for (const [child, parent] of parents) if (parent) children.set(parent, [...(children.get(parent) || []), child]);
  const seen = new Set();
  const height = node => {
    if (seen.has(node)) return 0;
    seen.add(node);
    return 1 + Math.max(0, ...(children.get(node) || []).map(height));
  };
  return height(id);
}

/**
 * Validates a requested parent for `id` (null for an agent that does not exist yet).
 * Returns null for owner-direct or the parent id.
 */
export function validateParentId(departments, id, value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 128) throw fail('상위 에이전트를 확인해 주세요.');
  if (id && value === id) throw fail('자기 자신을 상위 에이전트로 지정할 수 없습니다.');
  if (!departments.some(item => item.id === value)) throw fail('현재 프로젝트에서 상위 에이전트를 찾을 수 없습니다.');
  if (id) {
    // Walk the stored values, not the display parents, so a cycle already present in hand-edited data cannot be extended.
    const byId = new Map(departments.map(item => [item.id, item]));
    for (let current = value, seen = new Set(); typeof current === 'string' && !seen.has(current); current = byId.get(current)?.parentId) {
      if (current === id) throw fail('하위 에이전트를 상위로 지정하면 보고 체계가 순환합니다.');
      seen.add(current);
    }
  }
  const parents = effectiveParents(departments);
  const height = id && parents.has(id) ? subtreeHeight(parents, id) : 1;
  if (depthOf(parents, value) + height > MAX_HIERARCHY_DEPTH) throw fail(`보고 체계는 소유자 아래 최대 ${MAX_HIERARCHY_DEPTH}단계까지 만들 수 있습니다.`);
  return value;
}

/**
 * Before an agent is removed, moves its direct reports up to the removed agent's
 * own parent. Only records that point at the removed agent are changed.
 */
export function reparentChildren(departments, removedId) {
  const next = effectiveParents(departments).get(removedId) ?? null;
  const changed = [];
  for (const item of departments) {
    if (item.id !== removedId && item.parentId === removedId) { item.parentId = next; changed.push(item.id); }
  }
  return changed;
}
