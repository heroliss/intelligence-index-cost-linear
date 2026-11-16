// Shared by the renderer and regression checks. View domains use linear data units.
export function niceStep(span, count = 8) {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / count, power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].find(n => n * power >= raw) * power;
}
export function ticks(min, max, count = 8) {
  const step = niceStep(max - min, count), result = [];
  for (let n = Math.ceil((min - step * 1e-8) / step); n * step <= max + step * 1e-8; n++) {
    result.push(Number((n * step).toPrecision(12)));
    if (result.length > 100) break;
  }
  return result;
}
export function paretoFrontier(rows) {
  let best = -Infinity;
  return [...rows].sort((a, b) => a.cost - b.cost || b.intelligenceIndex - a.intelligenceIndex).filter(row => {
    if (row.intelligenceIndex <= best) return false;
    best = row.intelligenceIndex;
    return true;
  });
}
export function dataBounds(rows) {
  const maxX = Math.max(1, ...rows.map(d => d.cost)), maxY = Math.max(1, ...rows.map(d => d.intelligenceIndex));
  const minY = Math.min(0, ...rows.map(d => d.intelligenceIndex));
  const y = minY < 0 ? Math.floor(minY / 5) * 5 - 2 : 0;
  return {x: 0, y, width: maxX * 1.08, height: Math.ceil((maxY + 3) / 5) * 5 - y};
}
export function clampView(view, bounds) {
  const width = Math.max(bounds.width / 300, Math.min(bounds.width * 1.15, view.width));
  const height = Math.max(bounds.height / 80, Math.min(bounds.height * 1.1, view.height));
  return {width, height, x: Math.max(0, Math.min(Math.max(0, bounds.width - width), view.x)), y: Math.max(bounds.y, Math.min(Math.max(bounds.y, bounds.y + bounds.height - height), view.y))};
}
export function validRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('缺少有效图表数据 / Missing chart data');
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || ids.has(row.id) || typeof row.name !== 'string' || !row.name.trim() || !Number.isFinite(row.cost) || row.cost < 0 || !Number.isFinite(row.intelligenceIndex)) throw new Error('数据格式校验失败 / Invalid chart data');
    ids.add(row.id);
  }
  return rows;
}

const tableCollator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'});

export function sortRows(rows, key, direction = 'asc') {
  if (!['name', 'creator', 'intelligenceIndex', 'cost'].includes(key)) throw new RangeError(`Unknown table sort key: ${key}`);
  if (direction !== 'asc' && direction !== 'desc') throw new RangeError(`Unknown table sort direction: ${direction}`);
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = key === 'cost' || key === 'intelligenceIndex'
      ? a[key] - b[key]
      : tableCollator.compare(key === 'creator' ? a.creator?.name || 'Other' : a.name, key === 'creator' ? b.creator?.name || 'Other' : b.name);
    const byName = tableCollator.compare(a.name, b.name);
    const aId = String(a.id), bId = String(b.id);
    // Tie ordering stays ascending when the primary direction is reversed.
    return primary * sign || byName || (aId < bId ? -1 : aId > bId ? 1 : 0);
  });
}
