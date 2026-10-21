// Wheat fields that really grow: every row of a field is a plot that is bare, growing or ripe.
// Someone plants a bare row (a farmer, or the lord himself), the wheat grows with the season (not in
// winter; a farmer weeding a row helps it along), and once it's golden someone cuts it and carries
// the sheaves to the storehouse. Saved with the field as rows: [['b'|'g'|'r', growth], …].

export const FIELD = { rows: 7, grow: 95, tend: 30 };   // seconds to ripen (at a normal season), how long weeding helps

export function field(b) {
  if (!b.field) b.field = { rows: Array.from({ length: FIELD.rows }, () => ({ s: 'b', g: 0, tend: 0, by: 0 })) };
  return b.field;
}
// a field from an older save: already sown, at all stages of growth
export function oldField(b) { b.field = { rows: Array.from({ length: FIELD.rows }, (_, i) => ({ s: 'g', g: ((i * 37 + b.id * 13) % 100) / 100, tend: 0, by: 0 })) }; return b.field; }
export const saveField = b => b.field ? b.field.rows.map(r => [r.s, +r.g.toFixed(2)]) : undefined;
export function loadField(b, data) {
  if (!Array.isArray(data)) return oldField(b);
  b.field = { rows: Array.from({ length: FIELD.rows }, (_, i) => { const d = data[i] || ['b', 0]; return { s: ['b', 'g', 'r'].includes(d[0]) ? d[0] : 'b', g: +d[1] || 0, tend: 0, by: 0 }; }) };
  return b.field;
}

// the wheat grows (called with the game's own time)
export function growFields(game, dt) {
  const m = game.life.farmMult();
  for (const b of game.buildings.values()) {
    if (b.type !== 'farm' || !b.done) continue;
    for (const r of field(b).rows) {
      if (r.tend > 0) r.tend -= dt;
      if (r.s !== 'g' || m <= 0) continue;
      r.g += dt * m * (r.tend > 0 ? 1.4 : 1) / FIELD.grow;
      if (r.g >= 1) { r.g = 1; r.s = 'r'; }
    }
  }
}
// what a field needs most: cut the ripe wheat, then sow bare rows, then weed the growing ones
// (a row someone went to work on is theirs for a minute: then anyone may take it, in case they were called away)
export function rowTask(b, who = 0, now = 0) {
  const rows = field(b).rows, free = i => !rows[i].by || rows[i].by === who || now - (rows[i].byT || 0) > 60;
  for (const s of ['r', 'b']) for (let i = 0; i < rows.length; i++) if (rows[i].s === s && free(i)) return { i, kind: s === 'r' ? 'harvest' : 'plant' };
  let best = -1; for (let i = 0; i < rows.length; i++) if (rows[i].s === 'g' && rows[i].tend <= 0 && free(i) && (best < 0 || rows[i].g < rows[best].g)) best = i;
  return best >= 0 ? { i: best, kind: 'tend' } : null;
}
// do the work on a row; a harvest returns the wheat it gives
export function workRow(game, b, i, kind, amount) {
  const r = field(b).rows[i]; r.by = 0;
  if (kind === 'plant' && r.s === 'b') { r.s = 'g'; r.g = 0; return 0; }
  if (kind === 'tend' && r.s === 'g') { r.tend = FIELD.tend; return 0; }
  if (kind === 'harvest' && r.s === 'r') { r.s = 'b'; r.g = 0; return amount; }
  return 0;
}
// a row's middle line, in the field's own frame (rows run along x, spaced along z) — matches buildings.js farm()
export function rowLocalZ(b, i) { const d = b.sd * 2; return -d / 2 + 0.75 + i * ((d - 1.5) / (FIELD.rows - 1)); }
export function rowSpot(game, b, i, t = Math.random()) { const w = b.sw * 2; return game.local(b, -w / 2 + 1 + t * (w - 2), rowLocalZ(b, i)); }
// how much a harvested row gives (a farmer's load, a little more)
export function rowYield(game) { return Math.max(1, Math.round(6 * 1.6 * game.life.farmMult() * (1 + game.rb('farmBoost')))); }
// the crops on screen: nothing on bare soil, green shoots that grow, golden ears when ripe
export function syncField(b) {
  const rows = b.extra && b.extra.rows; if (!rows) return;
  field(b).rows.forEach((r, i) => {
    const v = rows[i]; if (!v) return;
    v.green.visible = r.s === 'g'; v.ripe.visible = r.s === 'r';
    if (r.s === 'g') v.green.scale.y = 0.12 + 0.88 * r.g;
  });
}
