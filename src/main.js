import './style.css';
import {
  buildComparePage,
  buildState,
} from './compare.js';

const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
const iconMenu = menuButton?.querySelector('[data-icon-menu]');
const iconClose = menuButton?.querySelector('[data-icon-close]');

function setMenu(open) {
  menu?.classList.toggle('hidden', !open);
  menuButton?.setAttribute('aria-expanded', String(open));
  iconMenu?.classList.toggle('hidden', open);
  iconClose?.classList.toggle('hidden', !open);
}

menuButton?.addEventListener('click', () => {
  setMenu(menu?.classList.contains('hidden'));
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu && !menu.classList.contains('hidden')) {
    setMenu(false);
    menuButton?.focus();
  }
});

const API_BASE = '/api';
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 8;

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function attachSearch(container) {
  const trigger = container.querySelector('[data-search-trigger]');
  const panel = container.querySelector('[data-search-panel]');
  const input = container.querySelector('[data-search-input]');
  const status = container.querySelector('[data-search-status]');
  const results = container.querySelector('[data-search-results]');
  const placeholder = container.querySelector('[data-search-placeholder]');

  let open = false;
  let requestId = 0;

  function setOpen(next) {
    open = next;
    panel?.classList.toggle('hidden', !next);
    trigger?.setAttribute('aria-expanded', String(next));
    if (next) {
      if (input) {
        input.value = '';
        input.focus();
      }
      if (status) status.textContent = '';
      if (results) results.innerHTML = '';
    }
  }

  function renderResults(items) {
    if (!results) return;
    results.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition duration-150 hover:bg-surface-800';

      const img = document.createElement('img');
      img.src = item.imageUrl ?? '';
      img.alt = '';
      img.loading = 'lazy';
      img.className = 'size-10 shrink-0 rounded-lg bg-surface-800 object-cover';

      const name = document.createElement('span');
      name.className = 'truncate text-sm text-zinc-200';
      name.textContent = item.name;

      button.append(img, name);
      button.addEventListener('click', () => {
        if (placeholder) {
          placeholder.textContent = item.name;
          placeholder.classList.remove('text-zinc-400', 'group-hover:text-zinc-300');
          placeholder.classList.add('text-white');
        }
        container.dataset.selectedSlug = item.slug;
        updateCompareState();
        setOpen(false);
      });

      li.appendChild(button);
      results.appendChild(li);
    });
  }

  async function runSearch(query) {
    const id = ++requestId;
    if (status) status.textContent = 'Buscando...';
    if (results) results.innerHTML = '';
    try {
      const response = await fetch(
        `${API_BASE}/search?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (id !== requestId) return;
      if (data.length === 0) {
        if (status) status.textContent = `Nenhum resultado para "${query}"`;
      } else {
        if (status) {
          status.textContent = `${data.length} resultado${data.length === 1 ? '' : 's'}`;
        }
        renderResults(data);
      }
    } catch {
      if (id !== requestId) return;
      if (status) status.textContent = 'Não foi possível buscar agora. Tente novamente.';
    }
  }

  const debouncedSearch = debounce((value) => {
    const query = value.trim();
    if (!query) {
      requestId++;
      if (status) status.textContent = '';
      if (results) results.innerHTML = '';
      return;
    }
    runSearch(query);
  }, SEARCH_DEBOUNCE_MS);

  trigger?.addEventListener('click', () => setOpen(!open));
  input?.addEventListener('input', () => debouncedSearch(input.value));
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (open && !container.contains(event.target)) setOpen(false);
  });
}

const compareButton = document.querySelector('[data-compare-button]');
const searchSlots = [...document.querySelectorAll('[data-search]')];

function updateCompareState() {
  const slugs = searchSlots.map((slot) => slot.dataset.selectedSlug).filter(Boolean);
  const ready = slugs.length === searchSlots.length && searchSlots.length === 2;
  compareButton?.toggleAttribute('disabled', !ready);
  compareButton?.setAttribute('aria-disabled', String(!ready));
  return ready;
}

compareButton?.addEventListener('click', () => {
  if (!updateCompareState()) return;
  const [slug1, slug2] = searchSlots.map((slot) => slot.dataset.selectedSlug);
  window.location.href = `/comparar?slug1=${encodeURIComponent(slug1)}&slug2=${encodeURIComponent(slug2)}`;
});

document.querySelectorAll('[data-search]').forEach(attachSearch);

const compareRoot = document.getElementById('compare-root');
const isComparePage = window.location.pathname.startsWith('/comparar');

function renderCompareState({ kind, message }) {
  compareRoot.innerHTML = buildState(kind, message);
  if (kind === 'error') {
    compareRoot.querySelector('[data-compare-retry]')?.addEventListener('click', loadCompare);
  }
}

async function loadCompare() {
  const params = new URLSearchParams(window.location.search);
  const slug1 = (params.get('slug1') || '').trim();
  const slug2 = (params.get('slug2') || '').trim();

  if (!slug1 || !slug2) {
    renderCompareState({ kind: 'missing' });
    return;
  }

  renderCompareState({ kind: 'loading' });

  let phoneA;
  let phoneB;
  try {
    const [responseA, responseB] = await Promise.all([
      fetch(`/api/${encodeURIComponent(slug1)}`),
      fetch(`/api/${encodeURIComponent(slug2)}`),
    ]);

    if (!responseA.ok || !responseB.ok) {
      const badSlug = !responseA.ok ? slug1 : slug2;
      const notFound =
        responseA.status === 404 || responseB.status === 404 || responseA.status === 502 || responseB.status === 502;
      renderCompareState(
        notFound
          ? { kind: 'notfound', message: `Não encontramos dados para "${badSlug}".` }
          : { kind: 'error' }
      );
      return;
    }

    phoneA = await responseA.json();
    phoneB = await responseB.json();
  } catch {
    renderCompareState({ kind: 'error' });
    return;
  }

  const aEmpty =
    !phoneA.model && !phoneA.imageUrl && Object.keys(phoneA.specifications || {}).length === 0;
  const bEmpty =
    !phoneB.model && !phoneB.imageUrl && Object.keys(phoneB.specifications || {}).length === 0;
  if (aEmpty || bEmpty) {
    renderCompareState({
      kind: 'notfound',
      message: `Não encontramos dados para "${aEmpty ? slug1 : slug2}".`,
    });
    return;
  }

  compareRoot.innerHTML = buildComparePage(phoneA, phoneB);
}

function hideHomeSections() {
  ['inicio', 'destaques', 'hardware', 'comecar'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

if (isComparePage) {
  hideHomeSections();
  document.getElementById('compare-page')?.classList.remove('hidden');
  loadCompare();
}