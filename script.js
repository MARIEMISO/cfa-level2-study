/* ===========================================================
   CFA L2 개인 교재 — app
   데이터: data/book1.json ~ book5.json (교체만으로 갱신)
   localStorage: cfa.done / cfa.last / cfa.wrong
   =========================================================== */

const BOOK_FILES = [1,2,3,4,5].map(n => `data/book${n}.json`);
const LS = {
  done : 'cfa.done.v2',
  last : 'cfa.last.v2',
  wrong: 'cfa.wrong.v2'
};

function readJsonStorage(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('localStorage reset:', key, e);
    localStorage.removeItem(key);
    return fallback;
  }
}

const state = {
  books: [],            // 로드된 book 객체들
  losIndex: new Map(),  // "R17|17.a" -> {book, reading, los}
  order: [],            // 전체 LOS 순서 (pager용)
  done: new Set(readJsonStorage(LS.done, [])),
  wrong: readJsonStorage(LS.wrong, [])
};

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = s => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* 인라인 마크업: **bold**, `mono`, ==하이라이트== */
function inline(s){
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>');
}


/* ---------------- 데이터 스키마 호환 ----------------
   v4 교재형 JSON: los.blocks
   v7 Book1/2 JSON: los.sections / formulas / quiz
   둘 다 자동 렌더링하도록 여기서 blocks 형식으로 정규화한다.
   --------------------------------------------------- */
function stripSectionNumber(text){
  return String(text || '').replace(/^\s*\d+\s*[.)]?\s*/, '').trim();
}

function normalizeQuizItem(q){
  const choices = Array.isArray(q.choices) ? q.choices : undefined;
  let answer = q.answer;
  if (typeof answer === 'number' && choices && choices[answer] !== undefined){
    const letter = String.fromCharCode(65 + answer);
    answer = `${letter}. ${choices[answer]}`;
  }
  return {
    q: q.q || q.question || '',
    choices,
    answer: answer ?? '',
    explain: q.explain || q.explanation || ''
  };
}

function normalizeLos(los){
  if (!los || typeof los !== 'object') return los;

  // 새/구 스키마 공통 필드 별칭
  if (!los.losEn && los.losText) los.losEn = los.losText;

  // 이미 blocks가 있으면 그대로 사용
  if (Array.isArray(los.blocks) && los.blocks.length) return los;

  const blocks = [];

  if (los.why){
    blocks.push({
      type: 'callout',
      style: 'intuition',
      title: '이 LOS에서 꼭 잡아야 할 것',
      text: los.why
    });
  }

  (los.sections || []).forEach(sec => {
    if (!sec || typeof sec !== 'object') return;
    if (sec.title) blocks.push({ type: 'h', text: stripSectionNumber(sec.title) });
    if (sec.body) blocks.push({ type: 'p', text: sec.body });
    if (Array.isArray(sec.bullets) && sec.bullets.length){
      blocks.push({ type: 'list', items: sec.bullets });
    }
    if (Array.isArray(sec.table) && sec.table.length){
      const rows = sec.table;
      const head = Array.isArray(rows[0]) ? rows[0] : null;
      blocks.push({
        type: 'table',
        head: head || undefined,
        rows: head ? rows.slice(1) : rows
      });
    }
  });

  if (Array.isArray(los.formulas) && los.formulas.length){
    blocks.push({ type: 'h', text: '핵심 공식 · 계산식' });
    los.formulas.forEach(f => blocks.push({
      type: 'formulaText',
      text: String(f)
    }));
  }

  if (Array.isArray(los.quiz) && los.quiz.length){
    blocks.push({
      type: 'quiz',
      title: `확인 퀴즈 · LOS ${los.id || ''}`.trim(),
      items: los.quiz.map(normalizeQuizItem)
    });
  }

  los.blocks = blocks;
  return los;
}

function normalizeBook(book){
  if (!book || typeof book !== 'object') return book;
  if (typeof book.bookId === 'string' && /^book\d+$/i.test(book.bookId)){
    book.bookId = book.bookId.toUpperCase();
  }
  (book.readings || []).forEach(reading => {
    (reading.losItems || []).forEach(normalizeLos);
  });
  return book;
}

/* ---------------- 데이터 로드 ---------------- */
async function loadBooks(){
  state.books = [];
  state.losIndex.clear();
  state.order = [];

  const results = await Promise.allSettled(
    BOOK_FILES.map(async f => {
      const r = await fetch(f, { cache: 'no-store' });
      if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
      const data = await r.json();
      return normalizeBook(data);
    })
  );

  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value){
      state.books.push(r.value);
    } else {
      console.error('CFA data load failed:', BOOK_FILES[i], r.reason);
    }
  });

  state.books.forEach(book => {
    (book.readings || []).forEach(reading => {
      (reading.losItems || []).forEach(los => {
        const key = losKey(reading, los);
        state.losIndex.set(key, {book, reading, los});
        state.order.push(key);
      });
    });
  });
}
const losKey = (reading, los) => `${reading.id}|${los.id}`;

/* ---------------- 사이드바 ---------------- */
function buildNav(){
  const nav = $('#bookNav');
  nav.innerHTML = '';
  state.books.forEach(book => {
    const block = el('div','book-block');
    const tab = el('button','book-tab');
    tab.style.setProperty('--tab', book.tabColor || '#888');
    tab.innerHTML = `
      <span class="tab-color"></span>
      <span>
        <span class="tab-id">${esc(book.bookId)}</span><br>
        <span class="tab-title">${esc(book.shortTitle || book.title)}</span>
      </span>
      <span class="tab-caret">▶</span>`;
    tab.addEventListener('click', () => block.classList.toggle('open'));
    block.appendChild(tab);

    const rlist = el('div','reading-list');
    (book.readings || []).forEach(reading => {
      const item = el('div','reading-item');
      const detailed = reading.status === 'detailed';
      const btn = el('button', 'reading-btn' + (detailed ? '' : ' pending'));
      btn.innerHTML = `
        <span class="r-id">${esc(reading.id)}</span>
        <span>${esc(reading.titleKo || reading.title)}</span>
        ${detailed ? '' : '<span class="r-badge">준비중</span>'}`;
      btn.addEventListener('click', () => {
        if (detailed){
          item.classList.toggle('open');
        } else {
          renderPending(book, reading);
          closeMobileNav();
        }
      });
      item.appendChild(btn);

      if (detailed){
        const llist = el('div','los-list');
        (reading.losItems || []).forEach(los => {
          const key = losKey(reading, los);
          const lbtn = el('button','los-btn');
          lbtn.dataset.key = key;
          lbtn.innerHTML = `
            <span class="l-id">${esc(los.id)}</span>
            <span>${esc(los.titleKo || los.title)}</span>
            <span class="l-done">${state.done.has(key) ? '✓' : ''}</span>`;
          lbtn.addEventListener('click', () => { openLos(key); closeMobileNav(); });
          llist.appendChild(lbtn);
        });
        item.appendChild(llist);
      }
      rlist.appendChild(item);
    });
    block.appendChild(rlist);
    nav.appendChild(block);
  });
}

function markActive(key){
  document.querySelectorAll('.los-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.key === key));
}
function refreshDoneMarks(){
  document.querySelectorAll('.los-btn').forEach(b => {
    const d = b.querySelector('.l-done');
    if (d) d.textContent = state.done.has(b.dataset.key) ? '✓' : '';
  });
}

/* ---------------- 진행률 ---------------- */
function refreshProgress(){
  const total = state.order.length;
  const done = [...state.done].filter(k => state.losIndex.has(k)).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('#progressPct').textContent = pct + '%';
  $('#progressDetail').textContent = `${done} / ${total} LOS`;
  const C = 2 * Math.PI * 14;
  $('#ringFill').style.strokeDasharray = C;
  $('#ringFill').style.strokeDashoffset = C * (1 - pct / 100);
}

/* ---------------- 블록 렌더러 ---------------- */
const CO_TITLES = {
  intuition:'INTUITION · 직관', exam:'시험 포인트', trap:'CFA TRAP · 함정',
  tip:'실무 연결', link:'다른 LOS 연결'
};

function renderBlocks(blocks, container, ctx){
  let hNum = 0;
  (blocks || []).forEach(blk => {
    switch(blk.type){
      case 'h': {
        hNum++;
        container.appendChild(el('h2','blk-h',
          `<span class="h-num">${String(hNum).padStart(2,'0')}</span>${inline(blk.text)}`));
        break;
      }
      case 'h3':
        container.appendChild(el('h3','blk-h3', inline(blk.text)));
        break;
      case 'p': {
        const d = el('div','blk');
        d.appendChild(el('p', null, inline(blk.text)));
        container.appendChild(d);
        break;
      }
      case 'list': {
        const d = el('div','blk');
        const lst = el(blk.ordered ? 'ol' : 'ul');
        (blk.items||[]).forEach(it => lst.appendChild(el('li', null, inline(it))));
        d.appendChild(lst);
        container.appendChild(d);
        break;
      }
      case 'table': {
        const wrap = el('div','tbl-wrap');
        const t = el('table','tbl');
        if (blk.head){
          const tr = el('tr');
          blk.head.forEach(h => tr.appendChild(el('th', null, inline(h))));
          t.appendChild(tr);
        }
        (blk.rows||[]).forEach(row => {
          const tr = el('tr');
          row.forEach(c => tr.appendChild(el('td', null, inline(c))));
          t.appendChild(tr);
        });
        wrap.appendChild(t);
        container.appendChild(wrap);
        if (blk.caption) container.appendChild(el('div','tbl-caption', inline(blk.caption)));
        break;
      }
      case 'formula': {
        const d = el('div','formula-plate');
        d.appendChild(el('div','formula-math', `$$${blk.latex}$$`));
        if (blk.caption) d.appendChild(el('div','formula-caption', inline(blk.caption)));
        container.appendChild(d);
        break;
      }
      case 'formulaText': {
        const d = el('div','formula-plate');
        const code = el('div','formula-math');
        code.textContent = blk.text || '';
        d.appendChild(code);
        if (blk.caption) d.appendChild(el('div','formula-caption', inline(blk.caption)));
        container.appendChild(d);
        break;
      }
      case 'callout': {
        const d = el('div', `callout co-${blk.style || 'tip'}`);
        d.appendChild(el('div','co-title', esc(blk.title || CO_TITLES[blk.style] || '')));
        const texts = Array.isArray(blk.text) ? blk.text : [blk.text];
        texts.forEach(t => d.appendChild(el('p', null, inline(t))));
        container.appendChild(d);
        break;
      }
      case 'svg': {
        const d = el('div','diagram');
        d.innerHTML = blk.code; // 데이터 파일 내 신뢰된 SVG
        if (blk.caption) d.appendChild(el('div','diagram-caption', inline(blk.caption)));
        container.appendChild(d);
        break;
      }
      case 'example': {
        const d = el('div','example');
        d.appendChild(el('div','example-head',
          `<span class="ex-label">EXAMPLE</span>${inline(blk.title || '예시 문제')}`));
        const body = el('div','example-body');
        if (blk.setup) body.appendChild(el('p', null, inline(blk.setup)));
        if (blk.steps){
          const ol = el('ol','example-steps');
          blk.steps.forEach(s => ol.appendChild(el('li', null, inline(s))));
          body.appendChild(ol);
        }
        const btn = el('button','reveal-btn','풀이 보기');
        const ans = el('div','answer-box');
        ans.hidden = true;
        (Array.isArray(blk.answer) ? blk.answer : [blk.answer]).forEach(a =>
          ans.appendChild(el('p', null, inline(a))));
        btn.addEventListener('click', () => {
          ans.hidden = !ans.hidden;
          btn.textContent = ans.hidden ? '풀이 보기' : '풀이 접기';
          if (!ans.hidden) typeset(ans);
        });
        body.appendChild(btn);
        body.appendChild(ans);
        d.appendChild(body);
        container.appendChild(d);
        break;
      }
      case 'quiz': {
        const d = el('div','quiz');
        const head = el('button','quiz-head',
          `${esc(blk.title || '확인 퀴즈')}<span class="q-caret">▼</span>`);
        head.addEventListener('click', () => d.classList.toggle('open'));
        d.appendChild(head);
        const body = el('div','quiz-body');
        (blk.items||[]).forEach((q, i) => {
          const item = el('div','quiz-item');
          item.appendChild(el('div','quiz-q',
            `<span class="q-num">Q${i+1}.</span>${inline(q.q)}`));
          if (q.choices){
            const ul = el('ul','quiz-choices');
            q.choices.forEach(c => ul.appendChild(el('li', null, inline(c))));
            item.appendChild(ul);
          }
          const actions = el('div','quiz-actions');
          const rbtn = el('button','reveal-btn','정답 보기');
          const ans = el('div','answer-box'); ans.hidden = true;
          ans.appendChild(el('p', null, `<strong>정답</strong> · ${inline(q.answer)}`));
          if (q.explain) ans.appendChild(el('p', null, inline(q.explain)));
          rbtn.addEventListener('click', () => {
            ans.hidden = !ans.hidden;
            rbtn.textContent = ans.hidden ? '정답 보기' : '정답 접기';
            if (!ans.hidden) typeset(ans);
          });
          const wbtn = el('button','wrong-btn','오답노트에 저장');
          wbtn.addEventListener('click', () => {
            saveWrong(ctx, blk, q);
            wbtn.classList.add('saved');
            wbtn.textContent = '저장됨 ✓';
          });
          actions.appendChild(rbtn);
          actions.appendChild(wbtn);
          item.appendChild(actions);
          item.appendChild(ans);
          body.appendChild(item);
        });
        d.appendChild(body);
        container.appendChild(d);
        break;
      }
    }
  });
}

/* KaTeX */
function typeset(node){
  if (window.renderMathInElement){
    renderMathInElement(node, {
      delimiters: [
        {left:'$$', right:'$$', display:true},
        {left:'$',  right:'$',  display:false}
      ],
      throwOnError:false
    });
  }
}

/* ---------------- LOS 페이지 ---------------- */
function openLos(key, push=true){
  const hit = state.losIndex.get(key);
  if (!hit) return;
  const {book, reading, los} = hit;
  document.documentElement.style.setProperty('--accent', book.tabColor || '#A63D40');
  document.documentElement.style.setProperty('--accent-soft', (book.tabColor || '#A63D40') + '14');

  const main = $('#content');
  main.innerHTML = '';
  const page = el('article','los-page');

  page.appendChild(el('div','page-band'));
  page.appendChild(el('div','crumb',
    `<b>${esc(book.bookId)}</b> <span>›</span> ${esc(reading.id)} ${esc(reading.titleKo || reading.title)} <span>›</span> LOS ${esc(los.id)}`));

  const head = el('header','los-head');
  head.appendChild(el('span','los-chip', `LOS ${esc(los.id)}`));
  head.appendChild(el('h1','los-title', esc(los.titleKo || los.title)));
  if (los.losEn || los.losText) head.appendChild(el('p','los-en', esc(los.losEn || los.losText)));
  page.appendChild(head);

  /* 완료 체크 */
  const doneRow = el('div','done-row');
  const label = el('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = state.done.has(key);
  cb.addEventListener('change', () => {
    cb.checked ? state.done.add(key) : state.done.delete(key);
    localStorage.setItem(LS.done, JSON.stringify([...state.done]));
    refreshProgress(); refreshDoneMarks();
  });
  label.appendChild(cb);
  label.appendChild(document.createTextNode(' 이 LOS 학습 완료'));
  doneRow.appendChild(label);
  if (los.keywords)
    doneRow.appendChild(el('span','keywords', esc(los.keywords.join(' · '))));
  page.appendChild(doneRow);

  renderBlocks(los.blocks, page, {book, reading, los});

  /* pager */
  const idx = state.order.indexOf(key);
  const pager = el('div','pager');
  const mk = (k, dir) => {
    const h = state.losIndex.get(k);
    const b = el('button', dir === 'next' ? 'pg-next' : '');
    b.innerHTML = `<span class="pg-label">${dir === 'next' ? '다음 →' : '← 이전'}</span>
      <span class="pg-title">LOS ${esc(h.los.id)} ${esc(h.los.titleKo || h.los.title)}</span>`;
    b.addEventListener('click', () => openLos(k));
    return b;
  };
  if (idx > 0) pager.appendChild(mk(state.order[idx-1], 'prev'));
  if (idx >= 0 && idx < state.order.length - 1) pager.appendChild(mk(state.order[idx+1], 'next'));
  if (pager.children.length) page.appendChild(pager);

  main.appendChild(page);
  typeset(page);
  markActive(key);
  window.scrollTo({top:0});
  if (push) localStorage.setItem(LS.last, key);

  /* 사이드바에서 해당 위치 펼치기 */
  const btn = document.querySelector(`.los-btn[data-key="${CSS.escape(key)}"]`);
  if (btn){
    const item = btn.closest('.reading-item');
    const block = btn.closest('.book-block');
    if (item) item.classList.add('open');
    if (block) block.classList.add('open');
  }
}

function renderPending(book, reading){
  document.documentElement.style.setProperty('--accent', book.tabColor || '#A63D40');
  const main = $('#content');
  main.innerHTML = '';
  const page = el('article','los-page');
  page.appendChild(el('div','page-band'));
  page.appendChild(el('div','crumb', `<b>${esc(book.bookId)}</b> <span>›</span> ${esc(reading.id)}`));
  page.appendChild(el('h1','los-title', esc(reading.titleKo || reading.title)));
  let losPreview = '';
  if (reading.losItems && reading.losItems.length){
    losPreview = '<br><br><strong>다룰 LOS</strong><br>' +
      reading.losItems.map(l => `${esc(l.id)} — ${esc(l.titleKo || l.title)}`).join('<br>');
  }
  page.appendChild(el('div','pending-note',
    `이 Reading은 아직 상세 교재화 전입니다.<br>${esc(reading.pendingNote || 'data JSON을 채우면 자동으로 이 자리에 본문이 나타납니다.')}${losPreview}`));
  main.appendChild(page);
  window.scrollTo({top:0});
}

/* ---------------- 오답노트 ---------------- */
function saveWrong(ctx, blk, q){
  state.wrong.unshift({
    key: losKey(ctx.reading, ctx.los),
    path: `${ctx.book.bookId} · ${ctx.reading.id} · LOS ${ctx.los.id}`,
    quiz: blk.title || '확인 퀴즈',
    q: q.q, answer: q.answer, explain: q.explain || '',
    ts: Date.now()
  });
  localStorage.setItem(LS.wrong, JSON.stringify(state.wrong));
  refreshWrongCount();
}
function refreshWrongCount(){
  $('#wrongCount').textContent = state.wrong.length;
}
function renderWrongNotes(){
  const main = $('#content');
  main.innerHTML = '';
  const page = el('article','los-page');
  page.appendChild(el('div','page-band'));
  page.appendChild(el('h1','los-title','오답노트'));
  page.appendChild(el('p','los-en','퀴즈에서 저장한 문제 모음. 시험 전 여기만 다시 돌리면 됩니다.'));
  if (!state.wrong.length){
    page.appendChild(el('p','wn-empty','저장된 오답이 없습니다. 각 퀴즈의 "오답노트에 저장" 버튼으로 추가하세요.'));
  }
  state.wrong.forEach((w, i) => {
    const d = el('div','wn-item');
    d.appendChild(el('div','wn-path', esc(`${w.path} · ${w.quiz}`)));
    d.appendChild(el('div','wn-q', inline(w.q)));
    d.appendChild(el('div','wn-a',
      `<strong>정답</strong> · ${inline(w.answer)}${w.explain ? '<br>' + inline(w.explain) : ''}`));
    const actions = el('div','wn-actions');
    const go = el('button', null, '해당 LOS로 이동');
    go.addEventListener('click', () => openLos(w.key));
    const del = el('button', null, '삭제');
    del.addEventListener('click', () => {
      state.wrong.splice(i,1);
      localStorage.setItem(LS.wrong, JSON.stringify(state.wrong));
      refreshWrongCount(); renderWrongNotes();
    });
    actions.appendChild(go); actions.appendChild(del);
    d.appendChild(actions);
    page.appendChild(d);
  });
  main.appendChild(page);
  typeset(page);
  window.scrollTo({top:0});
}

/* ---------------- 검색 ---------------- */
let searchIndex = null;
function buildSearchIndex(){
  searchIndex = [];
  state.losIndex.forEach(({book, reading, los}, key) => {
    let text = [
      los.title, los.titleKo, los.losEn, los.losText, los.why,
      (los.keywords || []).join(' ')
    ].filter(Boolean).join(' ');

    (los.blocks || []).forEach(b => {
      if (b.text) text += ' ' + (Array.isArray(b.text) ? b.text.join(' ') : b.text);
      if (b.setup) text += ' ' + b.setup;
      if (b.answer) text += ' ' + (Array.isArray(b.answer) ? b.answer.join(' ') : b.answer);
      if (b.latex) text += ' ' + b.latex;
      if (b.rows) text += ' ' + b.rows.flat().join(' ');
      if (b.head) text += ' ' + b.head.join(' ');
      if (b.type === 'quiz'){
        text += ' ' + (b.items || []).map(q =>
          [q.q, q.answer, q.explain, ...(q.choices || [])].filter(Boolean).join(' ')
        ).join(' ');
      } else if (Array.isArray(b.items)) {
        text += ' ' + b.items.join(' ');
      }
    });

    searchIndex.push({
      key,
      path: `${book.bookId} › ${reading.id} › LOS ${los.id}`,
      title: los.titleKo || los.title,
      text: text.toLowerCase()
    });
  });
}
function runSearch(qraw){
  const box = $('#searchResults');
  const q = qraw.trim().toLowerCase();
  if (!q){ box.hidden = true; box.innerHTML=''; return; }
  if (!searchIndex) buildSearchIndex();
  const terms = q.split(/\s+/);
  const hits = searchIndex.filter(item =>
    terms.every(t => item.text.includes(t) || item.title.toLowerCase().includes(t))
  ).slice(0, 12);
  box.innerHTML = '';
  if (!hits.length){
    box.appendChild(el('div','search-empty','검색 결과가 없습니다.'));
  } else {
    hits.forEach(h => {
      const pos = h.text.indexOf(terms[0]);
      const snippet = pos >= 0 ? h.text.slice(Math.max(0,pos-20), pos+70) : '';
      const b = el('button','search-item',
        `<span class="si-path">${esc(h.path)}</span>
         <span class="si-title">${esc(h.title)}</span>
         <span class="si-snippet">…${esc(snippet)}…</span>`);
      b.addEventListener('click', () => {
        openLos(h.key);
        box.hidden = true;
        $('#searchInput').value = '';
        closeMobileNav();
      });
      box.appendChild(b);
    });
  }
  box.hidden = false;
}

/* ---------------- 모바일 nav ---------------- */
function closeMobileNav(){
  $('#sidebar').classList.remove('open');
  $('#scrim').hidden = true;
}

/* ---------------- 시작 ---------------- */
async function init(){
  await loadBooks();
  buildNav();
  buildSearchIndex();
  refreshProgress();
  refreshWrongCount();

  $('#searchInput').addEventListener('input', e => runSearch(e.target.value));
  document.addEventListener('click', e => {
    if (!e.target.closest('.searchbox')) $('#searchResults').hidden = true;
  });
  $('#wrongNoteBtn').addEventListener('click', renderWrongNotes);
  $('#navToggle').addEventListener('click', () => {
    $('#sidebar').classList.add('open');
    $('#scrim').hidden = false;
  });
  $('#navClose').addEventListener('click', closeMobileNav);
  $('#scrim').addEventListener('click', closeMobileNav);

  /* 이어서 학습 카드 */
  const last = localStorage.getItem(LS.last);
  if (last && state.losIndex.has(last)){
    const {book, reading, los} = state.losIndex.get(last);
    const card = el('button','resume-card',
      `<span class="rc-label">이어서 학습</span>
       <span class="rc-title">${esc(book.bookId)} · ${esc(reading.id)} · LOS ${esc(los.id)} ${esc(los.titleKo || los.title)}</span>`);
    card.addEventListener('click', () => openLos(last));
    $('#resumeCard').appendChild(card);
  }
}
init();
