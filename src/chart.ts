import uPlot, { type AlignedData, type Options } from 'uplot';
import 'uplot/dist/uPlot.min.css';

import { UNIT_SYMBOL, type Forecast } from './api.js';

export interface ChartHandle {
  destroy(): void;
}

export function renderChart(
  target: HTMLElement,
  forecast: Forecast,
  nowSeconds: number
): ChartHandle {
  target.innerHTML = '';
  target.classList.remove('chart--skeleton');

  // Two series: past (muted) and future (bright). The boundary sample at
  // `nowSeconds` belongs to both series so the two lines visually connect
  // through the now-marker without a gap.
  const past: (number | null)[] = forecast.times.map((t, i) =>
    t <= nowSeconds ? (forecast.temps[i] ?? null) : null
  );
  const future: (number | null)[] = forecast.times.map((t, i) =>
    t >= nowSeconds ? (forecast.temps[i] ?? null) : null
  );

  const data: AlignedData = [forecast.times, past, future];

  const cs = getComputedStyle(document.documentElement);
  const pastColor = cs.getPropertyValue('--past').trim() || '#6f7d99';
  const futureColor = cs.getPropertyValue('--future').trim() || '#f5b04a';
  const gridColor = cs.getPropertyValue('--grid').trim() || 'rgba(255,255,255,0.06)';
  const axisColor = cs.getPropertyValue('--axis').trim() || 'rgba(255,255,255,0.35)';
  const nowColor = cs.getPropertyValue('--now-line').trim() || 'rgba(245,176,74,0.85)';
  const bgElev = cs.getPropertyValue('--bg-elev').trim() || '#111a2e';

  const tooltip = buildTooltip(target);
  const unitSymbol = UNIT_SYMBOL[forecast.unit];
  const dayFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    timeZone: forecast.timezone
  });
  const fullFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    timeZone: forecast.timezone
  });

  const rect = target.getBoundingClientRect();

  const opts: Options = {
    width: Math.max(280, Math.floor(rect.width)),
    height: Math.max(260, Math.floor(rect.height)),
    padding: [12, 12, 4, 4],
    legend: { show: false },
    cursor: {
      y: false,
      drag: { x: false, y: false, setScale: false },
      points: {
        size: 9,
        width: 2,
        stroke: (_u, sidx) => (sidx === 1 ? pastColor : futureColor),
        fill: () => bgElev
      }
    },
    scales: {
      x: { time: true },
      y: { auto: true }
    },
    axes: [
      {
        stroke: axisColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: gridColor, width: 1, size: 4 },
        font: '11px -apple-system, system-ui, sans-serif',
        values: (_u, splits) => splits.map((s) => dayFmt.format(new Date(s * 1000)))
      },
      {
        stroke: axisColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: gridColor, width: 1, size: 4 },
        font: '11px -apple-system, system-ui, sans-serif',
        size: 44,
        values: (_u, splits) => splits.map((v) => `${Math.round(v)}°`)
      }
    ],
    series: [
      {},
      {
        label: 'Past',
        stroke: pastColor,
        width: 2,
        spanGaps: false,
        points: { show: false }
      },
      {
        label: 'Forecast',
        stroke: futureColor,
        width: 2.5,
        spanGaps: false,
        points: { show: false }
      }
    ],
    hooks: {
      draw: [
        (u) => {
          const x = u.valToPos(nowSeconds, 'x', true);
          if (!Number.isFinite(x)) return;
          const ctx = u.ctx;
          ctx.save();
          ctx.strokeStyle = nowColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, u.bbox.top);
          ctx.lineTo(x, u.bbox.top + u.bbox.height);
          ctx.stroke();

          ctx.font = '700 17px -apple-system, system-ui, sans-serif';
          ctx.textBaseline = 'top';
          const label = 'NOW';
          const w = ctx.measureText(label).width;
          const labelX = Math.min(
            Math.max(u.bbox.left + 4, x - w / 2),
            u.bbox.left + u.bbox.width - w - 4
          );
          const labelY = u.bbox.top + 4;

          // soft pill behind the label so it stays legible over the data line
          const padX = 6;
          const padY = 3;
          const pillH = 22;
          ctx.fillStyle = bgElev;
          ctx.globalAlpha = 0.85;
          roundRect(ctx, labelX - padX, labelY - padY, w + padX * 2, pillH, 6);
          ctx.fill();
          ctx.globalAlpha = 1;

          ctx.fillStyle = nowColor;
          ctx.fillText(label, labelX, labelY);
          ctx.restore();
        }
      ],
      setCursor: [
        (u) => {
          const idx = u.cursor.idx;
          if (idx == null || idx < 0) {
            tooltip.hide();
            return;
          }
          const t = forecast.times[idx];
          const tempAt = forecast.temps[idx];
          if (t == null || tempAt == null || !Number.isFinite(tempAt)) {
            tooltip.hide();
            return;
          }
          const left = u.valToPos(t, 'x');
          const top = u.valToPos(tempAt, 'y');
          tooltip.show({
            left,
            top,
            time: fullFmt.format(new Date(t * 1000)),
            temp: `${Math.round(tempAt)}${unitSymbol}`
          });
        }
      ]
    }
  };

  const plot = new uPlot(opts, data, target);

  const ro = new ResizeObserver(() => {
    const r = target.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      plot.setSize({ width: Math.floor(r.width), height: Math.floor(r.height) });
    }
  });
  ro.observe(target);

  const over = plot.over;

  const setCursorFromTouch = (touch: Touch): void => {
    const r = over.getBoundingClientRect();
    plot.setCursor(
      { left: touch.clientX - r.left, top: touch.clientY - r.top },
      true
    );
  };

  // uPlot only reacts to mouse events, so we drive its cursor manually from
  // touch and preventDefault throughout the gesture. That blocks the browser
  // from synthesizing mousemove/mouseleave — without that suppression, the
  // synthesized mouseleave on touchend would reset the cursor and hide the
  // tooltip. As a bonus it stops the page from scrolling while dragging on
  // the chart. passive:false is required for preventDefault on iOS Chrome.
  const onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    setCursorFromTouch(touch);
  };

  const onTouchMove = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    setCursorFromTouch(touch);
  };

  over.addEventListener('touchstart', onTouchStart, { passive: false });
  over.addEventListener('touchmove', onTouchMove, { passive: false });

  return {
    destroy() {
      over.removeEventListener('touchstart', onTouchStart);
      over.removeEventListener('touchmove', onTouchMove);
      ro.disconnect();
      plot.destroy();
      tooltip.element.remove();
    }
  };
}

interface Tooltip {
  element: HTMLElement;
  show(args: { left: number; top: number; time: string; temp: string }): void;
  hide(): void;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function buildTooltip(parent: HTMLElement): Tooltip {
  const el = document.createElement('div');
  el.className = 'felt-tooltip';
  el.dataset.visible = 'false';
  el.innerHTML = '<div class="felt-tooltip__time"></div><div class="felt-tooltip__temp"></div>';
  parent.appendChild(el);

  const timeEl = el.querySelector<HTMLDivElement>('.felt-tooltip__time')!;
  const tempEl = el.querySelector<HTMLDivElement>('.felt-tooltip__temp')!;

  return {
    element: el,
    show({ left, top, time, temp }) {
      timeEl.textContent = time;
      tempEl.textContent = temp;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.dataset.visible = 'true';
    },
    hide() {
      el.dataset.visible = 'false';
    }
  };
}
