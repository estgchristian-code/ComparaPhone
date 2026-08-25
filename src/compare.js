export const COMPARE_CATEGORY_ORDER = [
  'Launch',
  'Platform',
  'Display',
  'Memory',
  'Main Camera',
  'Selfie camera',
  'Battery',
  'Body',
  'Comms',
  'Network',
  'Sound',
  'Features',
  'Misc',
];

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function decodeText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (text.includes('<') || text.includes('&')) {
    const tmp = document.createElement('textarea');
    tmp.innerHTML = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+>/g, '');
    text = tmp.value;
  }
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\uFFFD(?=m)/g, 'µ')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function releaseYear(value) {
  const match = String(value).match(/(19|20)\d{2}/);
  return match ? match[0] : '';
}

export function deriveBrand(model) {
  const first = (model || '').trim().split(/\s+/)[0] || '';
  return /^\d+$/.test(first) ? '' : first;
}

export function extractRam(internal) {
  const match = String(internal).match(/\d+(?:\.\d+)?\s*(?:GB|MB|TB)\s+RAM/i);
  return match ? match[0].replace(/\s+/, ' ') : '';
}

export function extractRefreshRate(displayType) {
  if (!/hz/i.test(String(displayType))) return '';
  const match = String(displayType).match(/\d+\s*Hz/i);
  return match ? match[0].replace(/\s+/, ' ') : 'Yes';
}

export function specValue(specs, category, field) {
  return decodeText(specs?.[category]?.[field] ?? '');
}

export function diffValues(a, b) {
  const left = String(a).trim();
  const right = String(b).trim();
  return left !== '' && right !== '' && left !== right;
}

export function unionKeys(objA, objB) {
  const keys = [];
  const seen = new Set();
  for (const obj of [objA, objB]) {
    if (!obj) continue;
    for (const key of Object.keys(obj)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

export function phoneCard(phone, label) {
  const brand = deriveBrand(phone.model);
  const year = releaseYear(phone.release_date || phone.specifications?.Launch?.Announced);
  const price = specValue(phone.specifications, 'Misc', 'Price');
  const img = phone.imageUrl
    ? `<img src="${esc(phone.imageUrl)}" alt="${esc(phone.model)}" loading="lazy" class="mx-auto mb-5 size-40 object-contain drop-shadow-lg sm:size-48" />`
    : '<div class="mx-auto mb-5 grid size-40 place-items-center rounded-2xl bg-surface-800 text-xs text-zinc-500 sm:size-48">Sem imagem</div>';

  return `
    <article class="rounded-3xl border border-white/10 bg-surface-900/90 p-6 text-center sm:p-8">
      <p class="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">${esc(label)}</p>
      ${img}
      <h2 class="text-xl font-bold text-white sm:text-2xl">${esc(phone.model) || '—'}</h2>
      <p class="mt-1 text-sm font-medium text-primary-400">${esc(brand) || '—'}</p>
      <div class="mx-auto mt-5 w-full max-w-xs space-y-1.5 text-sm text-zinc-400">
        <p class="flex justify-between gap-4"><span>Lançamento</span><span class="text-zinc-200">${esc(year) || '—'}</span></p>
        <p class="flex justify-between gap-4"><span>Preço</span><span class="text-zinc-200">${esc(price) || '—'}</span></p>
      </div>
    </article>`;
}

export function buildSummary(a, b) {
  const items = [
    { label: 'CPU', a: specValue(a.specifications, 'Platform', 'CPU'), b: specValue(b.specifications, 'Platform', 'CPU') },
    { label: 'GPU', a: specValue(a.specifications, 'Platform', 'GPU'), b: specValue(b.specifications, 'Platform', 'GPU') },
    { label: 'RAM', a: extractRam(a.specifications?.Memory?.Internal), b: extractRam(b.specifications?.Memory?.Internal) },
    {
      label: 'Armazenamento',
      a: decodeText(a.storage || a.specifications?.Memory?.Internal || ''),
      b: decodeText(b.storage || b.specifications?.Memory?.Internal || ''),
    },
    {
      label: 'Tela',
      a: [specValue(a.specifications, 'Display', 'Type'), specValue(a.specifications, 'Display', 'Size')].filter(Boolean).join(' · '),
      b: [specValue(b.specifications, 'Display', 'Type'), specValue(b.specifications, 'Display', 'Size')].filter(Boolean).join(' · '),
    },
    { label: 'Bateria', a: specValue(a.specifications, 'Battery', 'Type'), b: specValue(b.specifications, 'Battery', 'Type') },
    { label: 'Peso', a: specValue(a.specifications, 'Body', 'Weight'), b: specValue(b.specifications, 'Body', 'Weight') },
    {
      label: 'Sistema operacional',
      a: decodeText(a.os || a.specifications?.Platform?.OS || ''),
      b: decodeText(b.os || b.specifications?.Platform?.OS || ''),
    },
  ];

  return items
    .map((item) => {
      const different = diffValues(item.a, item.b);
      const cell = (v) => `<span class="${different ? 'text-primary-400' : 'text-zinc-200'}">${esc(v) || '—'}</span>`;
      return `
        <div class="rounded-2xl border border-white/10 bg-surface-900/90 p-4">
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">${esc(item.label)}</p>
          <div class="grid grid-cols-2 gap-3 text-sm leading-relaxed">
            ${cell(item.a)}
            ${cell(item.b)}
          </div>
        </div>`;
    })
    .join('');
}

export function buildComparisonTable(a, b) {
  const aSpecs = a.specifications || {};
  const bSpecs = b.specifications || {};

  const categories = COMPARE_CATEGORY_ORDER.filter((cat) => aSpecs[cat] || bSpecs[cat]);
  if (categories.length === 0) return '';

  return categories
    .map((category) => {
      const fields = unionKeys(aSpecs[category], bSpecs[category]);

      let refreshRow = '';
      if (category === 'Display') {
        const refreshA = extractRefreshRate(aSpecs.Display?.Type ?? '');
        const refreshB = extractRefreshRate(bSpecs.Display?.Type ?? '');
        if (refreshA || refreshB) {
          const different = diffValues(refreshA, refreshB);
          const cell = (v) => `<span class="${different ? 'text-primary-400' : 'text-zinc-200'}">${esc(v) || '—'}</span>`;
          refreshRow = `
            <tr class="border-t border-white/5 bg-surface-900/40">
              <td class="px-4 py-2.5 align-top text-zinc-500">Refresh rate</td>
              <td class="px-4 py-2.5 align-top">${cell(refreshA)}</td>
              <td class="px-4 py-2.5 align-top">${cell(refreshB)}</td>
            </tr>`;
        }
      }

      const rows = fields
        .map((field) => {
          const va = specValue(aSpecs, category, field);
          const vb = specValue(bSpecs, category, field);
          const different = diffValues(va, vb);
          const cell = (v) => `<span class="${different ? 'text-primary-400' : 'text-zinc-200'}">${esc(v) || '—'}</span>`;
          return `
            <tr class="border-t border-white/5 bg-surface-900/40">
              <td class="px-4 py-2.5 align-top text-zinc-500">${esc(field)}</td>
              <td class="px-4 py-2.5 align-top">${cell(va)}</td>
              <td class="px-4 py-2.5 align-top">${cell(vb)}</td>
            </tr>`;
        })
        .join('');

      return `
        <section class="mt-10">
          <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-400">${esc(category)}</h3>
          <div class="overflow-hidden rounded-2xl border border-white/10">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-surface-900/90 text-left text-zinc-500">
                  <th class="w-2/5 px-4 py-3 font-semibold">Especificação</th>
                  <th class="w-[30%] px-4 py-3 font-semibold">Aparelho 1</th>
                  <th class="px-4 py-3 font-semibold">Aparelho 2</th>
                </tr>
              </thead>
              <tbody>${rows}${refreshRow}</tbody>
            </table>
          </div>
        </section>`;
    })
    .join('');
}

export function buildComparePage(a, b) {
  const cardA = phoneCard(a, 'Aparelho 1');
  const cardB = phoneCard(b, 'Aparelho 2');
  const summary = buildSummary(a, b);
  const table = buildComparisonTable(a, b);

  return `
    <div class="mb-12 text-center">
      <h1 class="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Comparação técnica</h1>
      <p class="mt-3 text-zinc-400">Dados objetivos das especificações de cada aparelho.</p>
    </div>

    <div class="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
      ${cardA}
      <span class="hidden size-11 shrink-0 place-items-center self-center justify-self-center rounded-full bg-primary-500 text-sm font-bold text-black shadow-lg shadow-primary-950/40 ring-4 ring-primary-500/15 sm:grid">VS</span>
      ${cardB}
    </div>

    <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${summary}</div>

    ${table}
  `;
}

export function buildState(kind, message = '') {
  const base =
    'mx-auto max-w-2xl rounded-3xl border border-white/10 bg-surface-900/90 p-10 text-center';
  const homeLink =
    '<a href="/#inicio" class="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-8 py-3 text-sm font-semibold text-black shadow-lg shadow-primary-950/40 transition duration-300 hover:bg-primary-400">Voltar à página inicial</a>';

  if (kind === 'missing') {
    return `<div class="${base}">
      <p class="text-lg font-semibold text-white">Nenhum aparelho selecionado</p>
      <p class="mt-2 text-sm text-zinc-400">Informe os dois slugs na URL: <code class="text-primary-400">/comparar?slug1=...&amp;slug2=...</code></p>
      ${homeLink}
    </div>`;
  }
  if (kind === 'loading') {
    return `<div class="${base}">
      <p class="text-zinc-300">Carregando especificações...</p>
    </div>`;
  }
  if (kind === 'error') {
    return `<div class="${base}">
      <p class="text-lg font-semibold text-white">Não foi possível carregar a comparação</p>
      <p class="mt-2 text-sm text-zinc-400">Ocorreu um erro ao buscar as especificações. Tente novamente.</p>
      <button type="button" data-compare-retry class="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-8 py-3 text-sm font-semibold text-black shadow-lg shadow-primary-950/40 transition duration-300 hover:bg-primary-400">Tentar novamente</button>
    </div>`;
  }
  if (kind === 'notfound') {
    return `<div class="${base}">
      <p class="text-lg font-semibold text-white">Aparelho não encontrado</p>
      <p class="mt-2 text-sm text-zinc-400">${esc(message) || ''}</p>
      ${homeLink}
    </div>`;
  }
  return '';
}