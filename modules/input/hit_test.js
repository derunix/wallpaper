export function hitTest(x, y, blocks) {
  let best = null;
  let bestPriority = -Infinity;
  Object.entries(blocks).forEach(([id, block]) => {
    if (!block?.rect) return;
    const { rect, priority = 0 } = block;
    if (x < rect.x || y < rect.y || x > rect.x + rect.w || y > rect.y + rect.h) return;
    if (priority >= bestPriority) {
      bestPriority = priority;
      best = { id, rect, priority };
    }
  });
  if (!best) {
    return { hoveredBlockId: null, isInside: false, ux: 0, uy: 0, edgeProximity: 0 };
  }
  const ux = (x - best.rect.x) / best.rect.w;
  const uy = (y - best.rect.y) / best.rect.h;
  const edgeDist = Math.min(ux, uy, 1 - ux, 1 - uy);
  const edgeProximity = clamp(1 - edgeDist * 4, 0, 1);
  return {
    hoveredBlockId: best.id,
    isInside: true,
    ux,
    uy,
    edgeProximity,
  };
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
