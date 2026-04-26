import type { TempUnit } from './api.js';

export interface UI {
  setLoading(message?: string): void;
  setLocation(primary: string, secondary?: string): void;
  setNow(temp: number, unitSymbol: string, isoLocal: string): void;
  showError(message: string, hint?: string, onRetry?: () => void): void;
  clearStatus(): void;
  setUnit(unit: TempUnit): void;
  onUnitChange(handler: (unit: TempUnit) => void): void;
}

export function createUI(): UI {
  const hero = required<HTMLElement>('.hero');
  const placeEl = required<HTMLElement>('#place');
  const coordsEl = required<HTMLElement>('#coords');
  const tempEl = required<HTMLElement>('#temp');
  const captionEl = required<HTMLElement>('#caption');
  const chartEl = required<HTMLElement>('#chart');
  const statusEl = required<HTMLElement>('#status');
  const toggleEl = required<HTMLElement>('.unit-toggle');
  const toggleBtns = Array.from(
    toggleEl.querySelectorAll<HTMLButtonElement>('.unit-toggle__btn')
  );

  let unitHandler: ((unit: TempUnit) => void) | null = null;

  toggleEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('.unit-toggle__btn');
    if (!btn) return;
    const unit = btn.dataset['unit'] as TempUnit | undefined;
    if (unit !== 'fahrenheit' && unit !== 'celsius') return;
    if (btn.getAttribute('aria-pressed') === 'true') return;
    applyUnit(unit);
    unitHandler?.(unit);
  });

  function applyUnit(unit: TempUnit): void {
    for (const b of toggleBtns) {
      b.setAttribute('aria-pressed', b.dataset['unit'] === unit ? 'true' : 'false');
    }
  }

  return {
    setLoading(message = 'Locating you…') {
      hero.dataset.state = 'loading';
      placeEl.textContent = message;
      coordsEl.textContent = '';
      tempEl.textContent = '—';
      captionEl.textContent = 'Now';
      chartEl.classList.add('chart--skeleton');
      statusEl.replaceChildren();
    },
    setLocation(primary, secondary) {
      hero.dataset.state = 'ready';
      placeEl.textContent = primary;
      coordsEl.textContent = secondary ?? '';
    },
    setNow(temp, unitSymbol, isoLocal) {
      hero.dataset.state = 'ready';
      tempEl.textContent = `${Math.round(temp)}${unitSymbol}`;
      captionEl.textContent = `Now · ${isoLocal}`;
      chartEl.classList.remove('chart--skeleton');
    },
    showError(message, hint, onRetry) {
      hero.dataset.state = 'error';
      tempEl.textContent = '—';
      captionEl.textContent = '';
      chartEl.classList.remove('chart--skeleton');
      chartEl.replaceChildren();

      const frag = document.createDocumentFragment();
      const msg = document.createElement('p');
      msg.className = 'status__message status__message--error';
      msg.textContent = message;
      frag.appendChild(msg);

      if (hint) {
        const h = document.createElement('p');
        h.className = 'status__hint';
        h.textContent = hint;
        frag.appendChild(h);
      }

      if (onRetry) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'status__retry';
        btn.textContent = 'Try again';
        btn.addEventListener('click', onRetry);
        frag.appendChild(btn);
      }

      statusEl.replaceChildren(frag);
    },
    clearStatus() {
      statusEl.replaceChildren();
    },
    setUnit(unit) {
      applyUnit(unit);
    },
    onUnitChange(handler) {
      unitHandler = handler;
    }
  };
}

function required<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing required element: ${selector}`);
  return el;
}
