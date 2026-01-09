import { clamp } from '../utils.js';

const WEEK_START = new Date(2024, 0, 1); // Monday

export function buildCalendarData(date, locale = 'en-US', offset = 0) {
  const base = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const header = base.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(WEEK_START.getFullYear(), WEEK_START.getMonth(), WEEK_START.getDate() + i);
    weekdays.push(weekdayFormatter.format(d));
  }

  const firstDay = new Date(year, month, 1);
  const startIndex = (firstDay.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = offset === 0 ? date.getDate() : -1;

  const cells = [];
  for (let i = 0; i < startIndex; i++) {
    cells.push({ empty: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month, day).getDay();
    cells.push({
      day,
      weekend: dow === 0 || dow === 6,
      today: day === today,
    });
  }
  while (cells.length < 42) {
    cells.push({ empty: true });
  }

  const weeks = [];
  for (let row = 0; row < 6; row++) {
    weeks.push(cells.slice(row * 7, row * 7 + 7));
  }

  return {
    header: header.toUpperCase(),
    weekdays: weekdays.map(label => label.toUpperCase()),
    weeks,
    month,
    year,
  };
}

export function renderCalendar(ctx, rect, data, options = {}) {
  if (!rect || !data) return;
  const scale = clamp(options.textScale ?? 1, 0.8, 1.6);
  const padding = clamp(rect.h * 0.04, 8, 24);
  const headerH = clamp(rect.h * 0.18, 34, 70);
  const dowH = clamp(rect.h * 0.1, 20, 42);
  const gridH = rect.h - padding * 2 - headerH - dowH;
  if (gridH <= 0) return;

  const cellH = Math.max(1, Math.floor(gridH / 6));
  const cellW = Math.max(1, Math.floor((rect.w - padding * 2) / 7));
  const dayFont = clamp(Math.floor(cellH * 0.46 * scale), 14, 36);
  const dowFont = clamp(Math.floor(cellH * 0.28 * scale), 10, 22);
  const monthFont = clamp(Math.floor(headerH * 0.55 * scale), 16, 42);
  const showGrid = cellH >= 22 && cellW >= 24;

  const colors = options.colors || {};
  const primary = colors.primary || 'rgba(141, 252, 79, 0.9)';
  const secondary = colors.secondary || 'rgba(63, 231, 255, 0.75)';
  const text = options.textColor || 'rgba(232, 255, 247, 0.85)';

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.fillStyle = secondary;
  ctx.font = `700 ${monthFont}px Orbitron, Oxanium, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.header, rect.x + rect.w / 2, rect.y + padding + headerH * 0.55);

  ctx.fillStyle = secondary;
  ctx.font = `600 ${dowFont}px Orbitron, Oxanium, sans-serif`;
  const dowY = rect.y + padding + headerH + dowH * 0.6;
  for (let i = 0; i < 7; i++) {
    const x = rect.x + padding + cellW * i + cellW / 2;
    ctx.fillText(data.weekdays[i] || '', x, dowY);
  }

  const gridX = rect.x + padding;
  const gridY = rect.y + padding + headerH + dowH;
  ctx.font = `700 ${dayFont}px Orbitron, Oxanium, sans-serif`;
  ctx.textBaseline = 'middle';

  for (let row = 0; row < data.weeks.length; row++) {
    const week = data.weeks[row];
    for (let col = 0; col < 7; col++) {
      const cell = week[col];
      const x = gridX + col * cellW;
      const y = gridY + row * cellH;
      if (!cell || cell.empty) continue;

      if (cell.weekend) {
        ctx.save();
        ctx.fillStyle = 'rgba(141, 252, 79, 0.12)';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        ctx.restore();
      }

      if (cell.today) {
        ctx.save();
        ctx.strokeStyle = primary;
        ctx.lineWidth = Math.max(1, (options.lineWidth || 2) * 0.7);
        ctx.strokeRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);
        ctx.restore();
      } else if (showGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(63, 231, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        ctx.restore();
      }

      ctx.fillStyle = cell.today ? primary : cell.weekend ? 'rgba(141, 252, 79, 0.85)' : text;
      ctx.textAlign = 'center';
      ctx.fillText(String(cell.day), x + cellW / 2, y + cellH / 2 + 1);
    }
  }

  ctx.restore();
}
