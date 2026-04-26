export interface UI {
  setLoading(message?: string): void;
  setLocation(label: string): void;
  setNow(temp: number, isoLocal: string): void;
  showError(message: string, hint?: string, onRetry?: () => void): void;
  clearStatus(): void;
}

export function createUI(): UI {
  const hero = required<HTMLElement>('.hero');
  const locationEl = required<HTMLElement>('#location');
  const tempEl = required<HTMLElement>('#temp');
  const captionEl = required<HTMLElement>('#caption');
  const chartEl = required<HTMLElement>('#chart');
  const statusEl = required<HTMLElement>('#status');

  return {
    setLoading(message = 'Locating you…') {
      hero.dataset.state = 'loading';
      locationEl.textContent = message;
      tempEl.textContent = '—';
      captionEl.textContent = 'Now';
      chartEl.classList.add('chart--skeleton');
      statusEl.replaceChildren();
    },
    setLocation(label) {
      hero.dataset.state = 'ready';
      locationEl.textContent = label;
    },
    setNow(temp, isoLocal) {
      hero.dataset.state = 'ready';
      tempEl.textContent = `${Math.round(temp)}°F`;
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
    }
  };
}

function required<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing required element: ${selector}`);
  return el;
}
