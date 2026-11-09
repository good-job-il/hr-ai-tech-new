const key = row => `${row.external ? 'external' : 'job'}:${row.id}`;

export function applyFeaturedRanking(jobs, ids) {
  if (!Array.isArray(ids) || ids.length > 8 || ids.some(row => !row || typeof row.id !== 'string' || typeof row.external !== 'boolean')) return jobs;
  const rank = new Map(ids.map((row, index) => [key(row), index]));
  if (rank.size !== ids.length) return jobs;
  return jobs.map(job => ({ ...job, featuredRank: rank.get(key(job)) }));
}

export function featuredJobs(jobs) {
  const ranked = jobs.filter(job => Number.isInteger(job.featuredRank));
  return ranked.length ? ranked.slice().sort((a, b) => a.featuredRank - b.featuredRank).slice(0, 8) : jobs.slice(0, 8);
}
