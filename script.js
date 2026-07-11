const BOOKS = ['book1','book2','book3','book4','book5'];
const state = {books:{}, visuals:{}, currentBook:null, currentReading:null, currentLos:null, allItems:[]};
const $ = s => document.querySelector(s);
const storageKey = {
  done: id => `cfa_visual_done_${id}`,
  note: id => `cfa_visual_note_${id}`,
  last: 'cfa_visual_last_v9'
};

async function init(){
  try{
    const [loaded, visuals] = await Promise.all([
      Promise.all(BOOKS.map(b => fetch(`data/${b}.json?v=phase7-final`).then(checkResponse).then(r=>r.json()))),
      fetch('data/visuals.json?v=phase7-final').then(checkResponse).then(r=>r.json())
    ]);
    loaded.forEach((book,i)=> state.books[BOOKS[i]] = normalizeBook(book,BOOKS[i]));
    state.visuals = visuals || {};
    buildAllItems();
    renderBookNav();
    bind();
    updateProgress();
    $('#topStatus').textContent = `${state.allItems.length} LOS · visual v9`;

    const last = safeJsonParse(localStorage.getItem(storageKey.last));
    if(last && state.books[last.bookKey]) openBook(last.bookKey,last.readingId,last.losId);
    else openBook('book1');
  }catch(err){
    console.error(err);
    $('#mainPanel').innerHTML = `<div class="empty-mark">!</div><h2>교재 데이터를 불러오지 못했어.</h2><p>${escapeHtml(err.message)}</p><p>GitHub Pages에서 열었는지, data 폴더가 같은 경로에 있는지 확인해줘.</p>`;
  }
}

function checkResponse(r){ if(!r.ok) throw new Error(`${r.url} · HTTP ${r.status}`); return r; }
function safeJsonParse(v){ try{return JSON.parse(v||'null')}catch{return null} }

function normalizeBook(book, bookKey){
  book.bookKey = bookKey;
  book.bookId = String(book.bookId || bookKey.toUpperCase()).toUpperCase();
  book.title = book.title || book.bookId;
  book.readings = (book.readings || []).map((r,idx)=>{
    r.id = String(r.id || `R${r.readingNumber || idx+1}`);
    r.title = r.title || `Reading ${idx+1}`;
    r.topic = r.topic || '';
    r.status = r.status || (r.losItems ? 'detailed' : 'outline');
    if(!Array.isArray(r.losItems) || !r.losItems.length){
      r.losItems = [legacyReadingToLos(r)];
    }
    r.losItems = r.losItems.map((los,li)=>({
      id:String(los.id || `${r.id}.${li+1}`),
      label:los.label || `LOS ${los.id || `${r.id}.${li+1}`}`,
      title:los.title || r.title,
      losText:los.losText || los.title || r.title,
      why:los.why || r.sourceNote || r.overview || '',
      sections:Array.isArray(los.sections)?los.sections:[],
      formulas:Array.isArray(los.formulas)?los.formulas:[],
      keywords:Array.isArray(los.keywords)?los.keywords:[],
      quiz:Array.isArray(los.quiz)?los.quiz:[]
    }));
    return r;
  });
  return book;
}

function legacyReadingToLos(r){
  const sections = [];
  if(r.coreSummary?.length) sections.push({title:'1. 핵심 개념 요약', bullets:r.coreSummary});
  if(r.examPoints?.length) sections.push({title:'2. 시험에 자주 나오는 포인트', bullets:r.examPoints});
  if(r.comparisons?.length){
    const rows=[['개념 A','설명','개념 B','설명']];
    r.comparisons.forEach(c=>rows.push([c.leftTitle||'',c.left||'',c.rightTitle||'',c.right||'']));
    sections.push({title:'3. 헷갈리는 개념 비교', table:rows});
  }
  if(r.exampleProblem) sections.push({title:'4. 예시 문제',body:r.exampleProblem});
  if(r.importantNote) sections.push({title:'5. 중요 포인트',body:r.importantNote});
  return {
    id:r.id,
    label:r.id,
    title:r.title,
    losText:r.title,
    why:r.sourceNote||'',
    sections,
    formulas:r.formulas||[],
    keywords:r.keywords||[],
    quiz:(r.quizzes||[]).map(q=>({question:q.question,choices:q.choices||[],answer:q.answer,explanation:q.explanation||''}))
  };
}

function buildAllItems(){
  state.allItems=[];
  BOOKS.forEach(bookKey=>{
    const book=state.books[bookKey];
    book.readings.forEach(r=>r.losItems.forEach(los=>state.allItems.push({bookKey,book,reading:r,los})));
  });
}

function bind(){
  $('#searchInput').addEventListener('input', e=>search(e.target.value.trim()));
  $('#clearSearch').addEventListener('click',()=>{ $('#searchInput').value=''; renderReadingList(state.currentBook); });
  $('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#lightboxClose').addEventListener('click',closeLightbox);
  $('#lightbox').addEventListener('click',e=>{if(e.target.id==='lightbox') closeLightbox()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeLightbox()});
}

function renderBookNav(){
  $('#bookNav').innerHTML = BOOKS.map(b=>{
    const book=state.books[b];
    const subtitle=bookTitleSubtitle(book.title);
    return `<button class="book-btn" data-book="${b}"><strong>${escapeHtml(book.bookId)}</strong><small>${escapeHtml(subtitle)}</small></button>`;
  }).join('');
  document.querySelectorAll('.book-btn').forEach(btn=>btn.onclick=()=>openBook(btn.dataset.book));
}

function openBook(bookKey,readingId,losId){
  const book=state.books[bookKey]; if(!book) return;
  state.currentBook=bookKey;
  document.querySelectorAll('.book-btn').forEach(b=>b.classList.toggle('active',b.dataset.book===bookKey));
  renderReadingList(bookKey);
  const r = readingId ? findReading(book,readingId) : book.readings[0];
  const los = r ? (losId ? r.losItems.find(x=>sameId(x.id,losId)) : r.losItems[0]) : null;
  if(r && los) openLos(bookKey,r.id,los.id);
}

function renderReadingList(bookKey, readings=state.books[bookKey].readings){
  $('#readingListPanel').innerHTML = readings.map((r,idx)=>{
    const open = state.currentReading && sameId(state.currentReading.id,r.id) ? 'open' : (idx===0?'open':'');
    const status = r.status==='outline' ? '목차형' : '상세';
    return `<details class="reading-group" ${open}>
      <summary><span class="reading-title-line">${escapeHtml(r.id)} · ${escapeHtml(r.title)}</span><span class="status ${r.status==='outline'?'outline':''}">${status}</span><span class="reading-meta">${escapeHtml(r.overview||r.sourceNote||'')}</span></summary>
      <div class="los-list">${r.losItems.map(l=>`<button class="los-chip" data-book="${bookKey}" data-reading="${escapeAttr(r.id)}" data-los="${escapeAttr(l.id)}"><strong>${escapeHtml(l.label||l.id)}</strong><span>${escapeHtml(l.title||'')}</span></button>`).join('')}</div>
    </details>`;
  }).join('');
  bindLosButtons();
}

function bindLosButtons(){
  document.querySelectorAll('.los-chip').forEach(ch=>ch.onclick=()=>openLos(ch.dataset.book,ch.dataset.reading,ch.dataset.los));
}

function openLos(bookKey,readingId,losId){
  const book=state.books[bookKey];
  const r=findReading(book,readingId); if(!r) return;
  const los=r.losItems.find(x=>sameId(x.id,losId)); if(!los) return;
  state.currentBook=bookKey; state.currentReading=r; state.currentLos=los;
  localStorage.setItem(storageKey.last,JSON.stringify({bookKey,readingId:r.id,losId:los.id}));
  document.querySelectorAll('.book-btn').forEach(b=>b.classList.toggle('active',b.dataset.book===bookKey));
  if(!document.querySelector(`.los-chip[data-book="${bookKey}"]`)) renderReadingList(bookKey);
  document.querySelectorAll('.los-chip').forEach(c=>c.classList.toggle('active',c.dataset.book===bookKey && sameId(c.dataset.reading,r.id) && sameId(c.dataset.los,los.id)));

  const uid=`${bookKey}_${r.id}_${los.id}`;
  const done=localStorage.getItem(storageKey.done(uid))==='1';
  const note=localStorage.getItem(storageKey.note(uid))||'';
  const visuals=getVisuals(bookKey,r,los);
  const figures = visuals.length ? `<div class="figure-gallery">${visuals.map(renderFigure).join('')}</div>` : '';

  $('#mainPanel').classList.remove('empty');
  $('#mainPanel').innerHTML = `
    <section class="los-head">
      <div class="breadcrumb">${escapeHtml(book.title)} · ${escapeHtml(r.id)} ${escapeHtml(r.title)}</div>
      <h2>${escapeHtml(los.label||los.id)} · ${escapeHtml(los.title)}</h2>
      <p class="los-statement"><strong>LOS</strong> · ${escapeHtml(los.losText||'')}</p>
      ${los.why?`<p class="los-why"><strong>이 LOS의 위치</strong> · ${escapeHtml(los.why)}</p>`:''}
      <label class="complete-wrap"><input type="checkbox" id="doneBox" ${done?'checked':''}/> 이 LOS 학습 완료</label>
    </section>
    ${figures}
    <div class="grid">
      <section class="card wide"><h3>교재형 설명</h3>${renderSections(los.sections||[])}</section>
      <section class="card sticky-card"><h3>공식 · 계산식</h3>${renderFormulas(los.formulas||[])}</section>
      <section class="card"><h3>검색 키워드</h3>${(los.keywords||[]).length?(los.keywords||[]).map(k=>`<span class="keyword">${escapeHtml(k)}</span>`).join(''):'<p class="meta">키워드 확장 예정</p>'}</section>
      <section class="card wide"><h3>확인 퀴즈 · 정답 및 해설</h3>${renderQuiz(los.quiz||[])}</section>
      <section class="card wide"><h3>오답노트</h3><textarea id="noteArea" class="note-area" placeholder="틀린 이유, 헷갈린 공식, 다시 볼 포인트를 적어줘.">${escapeHtml(note)}</textarea><br><br><button class="save-note" id="saveNote">오답노트 저장</button></section>
    </div>`;

  $('#doneBox').onchange=e=>{localStorage.setItem(storageKey.done(uid),e.target.checked?'1':'0');updateProgress()};
  $('#saveNote').onclick=()=>{localStorage.setItem(storageKey.note(uid),$('#noteArea').value);toast('오답노트 저장 완료')};
  document.querySelectorAll('.answer-btn').forEach(btn=>btn.onclick=()=>{
    const answer=btn.nextElementSibling;
    const show=answer.classList.toggle('show');
    btn.setAttribute('aria-expanded',show?'true':'false');
    btn.textContent=show?'정답 숨기기':'정답 보기';
  });
  document.querySelectorAll('.figure-open').forEach(btn=>btn.onclick=()=>openLightbox(btn.dataset.src,btn.dataset.caption));
  $('#sidebar').classList.remove('open');
  updateProgress();
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderSections(sections){
  if(!sections.length) return '<p class="meta">상세 설명을 확장 중이야.</p>';
  return sections.map(s=>{
    const cls=sectionClass(s.title||'');
    return `<article class="study-section ${cls}"><h4>${escapeHtml(s.title||'')}</h4>${s.body?`<p>${escapeHtml(s.body)}</p>`:''}${s.bullets?.length?`<ul>${s.bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>`:''}${s.table?.length?renderTable(s.table):''}</article>`;
  }).join('');
}

function sectionClass(title){
  const s=title.toLowerCase();
  if(/trap|mistake|함정|주의|위험/.test(s)) return 'danger';
  if(/intuition|직관|큰 그림|왜 /.test(s)) return 'insight';
  if(/한 줄|정리|요약/.test(s)) return 'summary';
  return '';
}

function renderTable(rows){
  return `<div class="table-wrap"><table>${rows.map(row=>`<tr>${row.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
}

function renderFormulas(formulas){
  return formulas.length ? `<div class="formula-stack">${formulas.map(f=>`<div class="formula">${escapeHtml(f)}</div>`).join('')}</div>` : '<p class="meta">이 LOS는 핵심 공식보다 개념·판단이 중심이야.</p>';
}

function renderQuiz(quiz){
  return quiz.length ? quiz.map((q,i)=>`<details class="quiz"><summary>Quiz ${i+1}. ${escapeHtml(q.question)}</summary><div class="quiz-body">${(q.choices||[]).map((c,idx)=>`<label class="choice">${String.fromCharCode(65+idx)}. ${escapeHtml(c)}</label>`).join('')}<button class="answer-btn" aria-expanded="false">정답 보기</button><div class="answer"><strong>정답: ${String.fromCharCode(65+(Number(q.answer)||0))}</strong><br>${escapeHtml(q.explanation||'')}</div></div></details>`).join('') : '<p class="meta">이 LOS의 퀴즈는 확장 예정이야.</p>';
}

function getVisuals(bookKey,r,los){
  const bookMap=state.visuals?.[bookKey]||{};
  const entries=findVisualEntries(bookMap,r.id);
  if(!entries.length) return [];
  const firstLos=r.losItems[0]?.id;
  return entries.filter(v=>{
    if(Array.isArray(v.los) && v.los.length) return v.los.some(id=>sameId(id,los.id));
    return sameId(los.id,firstLos);
  });
}

function findVisualEntries(bookMap,readingId){
  const key=Object.keys(bookMap).find(k=>sameId(k,readingId));
  return key ? bookMap[key] : [];
}

function renderFigure(v){
  const caption=[v.title||'',v.caption||''].filter(Boolean).join(' · ');
  return `<figure class="figure-card"><button class="figure-open" data-src="${escapeAttr(v.src)}" data-caption="${escapeAttr(caption)}"><img src="${escapeAttr(v.src)}" alt="${escapeAttr(v.title||'학습 도식')}" loading="lazy" /></button><figcaption><strong>${escapeHtml(v.title||'학습 도식')}</strong><span>${escapeHtml(v.caption||'')}</span></figcaption></figure>`;
}

function openLightbox(src,caption){
  $('#lightboxImg').src=src; $('#lightboxCaption').textContent=caption||''; $('#lightbox').classList.add('open'); $('#lightbox').setAttribute('aria-hidden','false');
}
function closeLightbox(){ $('#lightbox').classList.remove('open'); $('#lightbox').setAttribute('aria-hidden','true'); $('#lightboxImg').src=''; }

function search(q){
  if(!q){renderReadingList(state.currentBook);return}
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits=state.allItems.filter(item=>{
    const l=item.los;
    const sections=(l.sections||[]).map(s=>[s.title,s.body,...(s.bullets||[]),...(s.table||[]).flat()].join(' ')).join(' ');
    const hay=[item.book.title,item.reading.id,item.reading.title,item.reading.topic,l.id,l.label,l.title,l.losText,l.why,sections,...(l.formulas||[]),...(l.keywords||[])].join(' ').toLowerCase();
    return terms.every(t=>hay.includes(t));
  });
  $('#readingListPanel').innerHTML = hits.length ? `<div class="reading-group"><div class="search-result-heading">검색 결과 ${hits.length}개</div><div class="los-list">${hits.map(h=>`<button class="los-chip" data-book="${h.bookKey}" data-reading="${escapeAttr(h.reading.id)}" data-los="${escapeAttr(h.los.id)}"><strong>${escapeHtml(h.book.bookId)} · ${escapeHtml(h.los.label||h.los.id)}</strong><span>${highlight(h.los.title,q)}</span><span class="search-snippet">${escapeHtml(h.reading.title)}</span></button>`).join('')}</div></div>` : '<div class="reading-group">검색 결과가 없어.</div>';
  bindLosButtons();
}

function updateProgress(){
  const total=state.allItems.length;
  const done=state.allItems.filter(i=>localStorage.getItem(storageKey.done(`${i.bookKey}_${i.reading.id}_${i.los.id}`))==='1').length;
  const pct=total?Math.round(done/total*100):0;
  $('#progressText').textContent=`${pct}%`;
  $('#progressFill').style.width=`${pct}%`;
  $('#progressDetail').textContent=`${done} / ${total} LOS 완료`;
}

function findReading(book,id){ return book.readings.find(r=>sameId(r.id,id)); }
function sameId(a,b){ return String(a||'').toLowerCase()===String(b||'').toLowerCase(); }
function bookTitleSubtitle(title){
  const s=String(title||'').split(/[|·]/).map(x=>x.trim()).filter(Boolean);
  return s.length>1?s.slice(1).join(' · '):s[0]||'';
}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1700)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function escapeAttr(s){return escapeHtml(s)}
function highlight(text,q){const t=escapeHtml(text);if(!q)return t;const safe=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return t.replace(new RegExp(`(${safe})`,'ig'),'<mark>$1</mark>')}

init();
