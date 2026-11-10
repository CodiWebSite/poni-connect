// Suggest the most likely employees for a payslip whose detected name did not match exactly.

export const normalizePersonName = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z\s-]/g, ' ').replace(/[\s-]+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Similarity 0..1, order-insensitive on name parts (Nume Prenume vs Prenume Nume). */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizePersonName(a), y = normalizePersonName(b);
  if (!x || !y) return 0;
  const sortParts = (s: string) => s.split(' ').sort().join(' ');
  const direct = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const sorted = 1 - levenshtein(sortParts(x), sortParts(y)) / Math.max(x.length, y.length);
  // Shared surname / given-name tokens boost the score.
  const tx = new Set(x.split(' ')), ty = y.split(' ');
  const shared = ty.filter(t => tx.has(t)).length / Math.max(tx.size, ty.length);
  return Math.max(direct, sorted, shared * 0.85);
}

export interface Candidate { id: string; first_name: string; last_name: string }

export function suggestEmployees(detected: string, employees: Candidate[], limit = 3, minScore = 0.5) {
  return employees
    .map(e => ({ e, score: nameSimilarity(detected, `${e.last_name} ${e.first_name}`) }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
