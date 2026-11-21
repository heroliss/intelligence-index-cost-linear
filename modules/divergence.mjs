export const AUTO_BOARD_IDS = ['aa', 'livebench'];
export const HUMAN_BOARD_IDS = ['arenaChat', 'arenaWebdev', 'designArena'];

/**
 * Compute bias-free cross-organization rank divergence by normalizing each board's
 * official ordering onto a shared peer cohort (0–100 percentile per board).
 * Eliminates systematic distortion caused by differing board sizes (e.g. AA 137 vs Arena 60 vs LB2 38).
 */
export function computeOrgDivergence(orgBoards, orgRankIndex, baseById, filterFn = null) {
  if (!Array.isArray(orgBoards) || !orgBoards.length || !(orgRankIndex instanceof Map)) {
    return {
      rows: [],
      topHumanFavorite: null,
      topHardSpecialist: null,
      topConsensus: null,
      counts: {all: 0, human: 0, auto: 0, consensus: 0}
    };
  }

  const boardMeta = new Map(orgBoards.map(b => [b.id, b]));
  const autoIds = AUTO_BOARD_IDS.filter(id => boardMeta.has(id));
  const humanIds = HUMAN_BOARD_IDS.filter(id => boardMeta.has(id));
  const allTrackIds = orgBoards.map(b => b.id);

  // Deduplicate by familySlug keeping the strongest AA representative with EXACT ranks on BOTH auto & human boards
  const byFamily = new Map();
  for (const [modelId, rec] of orgRankIndex.entries()) {
    const hasExactAuto = autoIds.some(id => !!rec.ranks?.[id]?.exact);
    const hasExactHuman = humanIds.some(id => !!rec.ranks?.[id]?.exact);
    if (!hasExactAuto || !hasExactHuman) continue;

    const base = baseById?.get(modelId) || null;
    if (filterFn && !filterFn({modelId, rec, base})) continue;

    const aaRank = rec.ranks.aa?.exact ? rec.ranks.aa.rank : 999;
    const exactCount = allTrackIds.filter(id => rec.ranks?.[id]?.exact).length;
    const fKey = rec.familySlug || modelId;
    const prev = byFamily.get(fKey);
    if (
      !prev
      || aaRank < prev.aaRank
      || (aaRank === prev.aaRank && exactCount > prev.exactCount)
    ) {
      byFamily.set(fKey, {modelId, rec, base, aaRank, exactCount});
    }
  }

  const peers = [...byFamily.values()];
  if (!peers.length) {
    return {
      rows: [],
      topHumanFavorite: null,
      topHardSpecialist: null,
      topConsensus: null,
      counts: {all: 0, human: 0, auto: 0, consensus: 0}
    };
  }

  // Within each board, strictly sort exact-evaluated peers by that board's official rank to derive 0-100 cohort percentiles
  const boardPct = new Map();
  for (const bId of allTrackIds) {
    const present = peers
      .filter(p => p.rec.ranks?.[bId]?.exact)
      .sort((a, b) => a.rec.ranks[bId].rank - b.rec.ranks[bId].rank || a.aaRank - b.aaRank);
    const map = new Map();
    const n = present.length;
    present.forEach((p, idx) => {
      const info = p.rec.ranks[bId];
      const pct = n > 1 ? 100 * (1 - idx / (n - 1)) : 100;
      map.set(p.modelId, {
        boardId: bId,
        rank: info.rank,
        exact: true,
        score: info.score,
        cohortRank: idx + 1,
        cohortN: n,
        pct
      });
    });
    boardPct.set(bId, map);
  }

  const rows = [];
  for (const p of peers) {
    const autoEntries = autoIds.map(id => boardPct.get(id)?.get(p.modelId)).filter(Boolean);
    const humanEntries = humanIds.map(id => boardPct.get(id)?.get(p.modelId)).filter(Boolean);
    if (!autoEntries.length || !humanEntries.length) continue;

    const autoPct = autoEntries.reduce((s, e) => s + e.pct, 0) / autoEntries.length;
    const humanPct = humanEntries.reduce((s, e) => s + e.pct, 0) / humanEntries.length;
    const gap = Number((humanPct - autoPct).toFixed(1));

    const allEntries = allTrackIds.map(id => boardPct.get(id)?.get(p.modelId)).filter(Boolean);
    const sortedByPct = [...allEntries].sort((a, b) => b.pct - a.pct);
    const bestOrg = sortedByPct[0];
    const worstOrg = sortedByPct[sortedByPct.length - 1];
    const pctSpread = Number((bestOrg.pct - worstOrg.pct).toFixed(1));
    const overallPct = Number((allEntries.reduce((s, e) => s + e.pct, 0) / allEntries.length).toFixed(1));

    let kind = 'balanced';
    if (gap >= 8) kind = 'human';
    else if (gap <= -8) kind = 'auto';
    else if (autoPct >= 68 && humanPct >= 68 && Math.abs(gap) < 8 && allEntries.length >= 3) kind = 'consensus';

    rows.push({
      modelId: p.modelId,
      familySlug: p.rec.familySlug || null,
      name: p.rec.name,
      shortName: p.rec.shortName || p.rec.name,
      creator: p.rec.creator,
      creatorColor: p.rec.creatorColor,
      cost: p.rec.cost ?? p.base?.cost ?? null,
      isOpenWeights: !!p.base?.isOpenWeights,
      autoPct: Number(autoPct.toFixed(1)),
      humanPct: Number(humanPct.toFixed(1)),
      overallPct,
      gap,
      absGap: Math.abs(gap),
      pctSpread,
      coveredCount: allEntries.length,
      autoEntries,
      humanEntries,
      bestOrg,
      worstOrg,
      kind
    });
  }

  // Default order: largest absolute divergence first so controversy jumps out immediately
  rows.sort((a, b) => b.absGap - a.absGap || b.overallPct - a.overallPct);

  const humanFavs = rows.filter(r => r.gap > 0).sort((a, b) => b.gap - a.gap);
  const hardSpecs = rows.filter(r => r.gap < 0).sort((a, b) => a.gap - b.gap);
  const consensusPool = rows
    .filter(r => r.autoPct >= 65 && r.humanPct >= 65 && r.coveredCount >= 3)
    .sort((a, b) => (a.absGap + a.pctSpread * 0.25) - (b.absGap + b.pctSpread * 0.25) || b.overallPct - a.overallPct);

  return {
    rows,
    topHumanFavorite: humanFavs[0] || null,
    topHardSpecialist: hardSpecs[0] || null,
    topConsensus: consensusPool[0] || null,
    counts: {
      all: rows.length,
      human: rows.filter(r => r.gap >= 8).length,
      auto: rows.filter(r => r.gap <= -8).length,
      consensus: rows.filter(r => r.kind === 'consensus').length
    }
  };
}
