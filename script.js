const BOOKS=['book1','book2','book3','book4','book5'];
const state={books:{},currentBook:null,currentReading:null,currentLos:null,allItems:[]};
const $=s=>document.querySelector(s);
const storageKey={done:id=>`cfa_los_done_${id}`,note:id=>`cfa_los_note_${id}`,last:'cfa_last_los_v3'};
async function init(){
  const loaded=await Promise.all(BOOKS.map(b=>fetch(`data/${b}.json`).then(r=>r.json())));
  loaded.forEach((book,i)=>{state.books[BOOKS[i]]=normalizeBook(book,BOOKS[i]);});
  buildAllItems(); renderBookNav();
  const last=JSON.parse(localStorage.getItem(storageKey.last)||'null');
  if(last && state.books[last.bookKey]) openBook(last.bookKey,last.readingId,last.losId); else openBook('book3','R17','17.a');
  bind(); updateProgress();
}
function normalizeBook(book,bookKey){
  book.readings=(book.readings||[]).map(r=>{
    if(!r.losItems){
      r.losItems=[{id:r.id,label:r.id,title:r.title,losText:r.title,why:r.sourceNote||'',sections:[{title:'핵심 개념 요약',body:'기존 Reading 단위 요약입니다. Book3 R17처럼 LOS 단위로 순차 확장할 예정입니다.',bullets:r.coreSummary||[]}],formulas:r.formulas||[],keywords:r.keywords||[],quiz:(r.quizzes||[]).map(q=>({question:q.question,choices:q.choices,answer:q.answer,explanation:q.explanation}))}];
    }
    return r;
  });
  return book;
}
function buildAllItems(){
  state.allItems=[];
  BOOKS.forEach(bookKey=>{const book=state.books[bookKey]; book.readings.forEach(r=>(r.losItems||[]).forEach(los=>state.allItems.push({bookKey,bookTitle:book.title,readingId:r.id,readingTitle:r.title,topic:r.topic,los})));});
}
function bind(){
  $('#searchInput').addEventListener('input',e=>search(e.target.value.trim()));
  $('#clearSearch').addEventListener('click',()=>{$('#searchInput').value=''; renderReadingList(state.currentBook);});
  $('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
}
function renderBookNav(){
  $('#bookNav').innerHTML=BOOKS.map(b=>`<button class="book-btn" data-book="${b}">${state.books[b].bookId}<br><small>${escapeHtml((state.books[b].title.split('|')[1]||state.books[b].title).trim())}</small></button>`).join('');
  document.querySelectorAll('.book-btn').forEach(btn=>btn.onclick=()=>openBook(btn.dataset.book));
}
function openBook(bookKey,readingId,losId){
  state.currentBook=bookKey;
  document.querySelectorAll('.book-btn').forEach(b=>b.classList.toggle('active',b.dataset.book===bookKey));
  renderReadingList(bookKey);
  const book=state.books[bookKey];
  const r=readingId?book.readings.find(x=>x.id===readingId):book.readings[0];
  const los=r? (losId?(r.losItems||[]).find(x=>x.id===losId):(r.losItems||[])[0]) : null;
  if(r&&los) openLos(bookKey,r.id,los.id);
}
function renderReadingList(bookKey,list){
  const readings=list||state.books[bookKey].readings;
  $('#readingListPanel').innerHTML=readings.map(r=>`<details class="reading-group" open><summary>${escapeHtml(r.id)}. ${escapeHtml(r.title)} <span class="status ${r.status==='outline'?'outline':''}">${r.status==='detailed'?'상세':'목차'}</span><span class="reading-meta">${escapeHtml(r.overview||'')}</span></summary><div class="los-list">${(r.losItems||[]).map(l=>`<button class="los-chip" data-book="${bookKey}" data-reading="${r.id}" data-los="${l.id}"><strong>${escapeHtml(l.label||l.id)}</strong><br>${escapeHtml(l.title||'')}</button>`).join('')}</div></details>`).join('');
  document.querySelectorAll('.los-chip').forEach(ch=>ch.onclick=()=>openLos(ch.dataset.book,ch.dataset.reading,ch.dataset.los));
}
function findLos(bookKey,readingId,losId){
  const book=state.books[bookKey]; const r=book.readings.find(x=>x.id===readingId); if(!r)return{};
  const los=(r.losItems||[]).find(x=>x.id===losId); return {book,r,los};
}
function openLos(bookKey,readingId,losId){
  const {book,r,los}=findLos(bookKey,readingId,losId); if(!los)return;
  state.currentBook=bookKey; state.currentReading=r; state.currentLos=los;
  localStorage.setItem(storageKey.last,JSON.stringify({bookKey,readingId,losId}));
  document.querySelectorAll('.book-btn').forEach(b=>b.classList.toggle('active',b.dataset.book===bookKey));
  document.querySelectorAll('.los-chip').forEach(c=>c.classList.toggle('active',c.dataset.book===bookKey&&c.dataset.reading===readingId&&c.dataset.los===losId));
  const uid=`${bookKey}_${readingId}_${losId}`; const done=localStorage.getItem(storageKey.done(uid))==='1'; const note=localStorage.getItem(storageKey.note(uid))||'';
  $('#mainPanel').classList.remove('empty');
  $('#mainPanel').innerHTML=`
    <div class="los-head">
      <div class="meta">${escapeHtml(book.title)} · ${escapeHtml(r.title)}</div>
      <h2>${escapeHtml(los.label||los.id)} · ${escapeHtml(los.title)}</h2>
      <p><strong>LOS:</strong> ${escapeHtml(los.losText||'')}</p>
      <p class="meta"><strong>이 LOS의 위치:</strong> ${escapeHtml(los.why||'')}</p>
      <label class="complete-wrap"><input type="checkbox" id="doneBox" ${done?'checked':''}/> 이 LOS 학습 완료</label>
    </div>
    <div class="grid">
      ${card('교재형 설명',renderSections(los.sections||[]),'wide')}
      ${(los.formulas||[]).length?card('공식/계산식',(los.formulas||[]).map(f=>`<div class="formula">${escapeHtml(f)}</div>`).join('')):''}
      ${(los.keywords||[]).length?card('검색 키워드',(los.keywords||[]).map(k=>`<span class="keyword">${escapeHtml(k)}</span>`).join('')):''}
      ${card('확인 퀴즈 · 정답 및 해설',renderQuiz(los.quiz||[]),'wide')}
      ${card('오답노트',`<textarea id="noteArea" class="note-area" placeholder="틀린 이유, 헷갈린 공식, 다시 볼 포인트를 적어줘.">${escapeHtml(note)}</textarea><br><br><button class="save-note" id="saveNote">오답노트 저장</button>`,'wide')}
    </div>`;
  $('#doneBox').onchange=e=>{localStorage.setItem(storageKey.done(uid),e.target.checked?'1':'0'); updateProgress();};
  $('#saveNote').onclick=()=>{localStorage.setItem(storageKey.note(uid),$('#noteArea').value); toast('오답노트 저장 완료');};
  document.querySelectorAll('.answer-btn').forEach(btn=>btn.onclick=()=>btn.nextElementSibling.classList.toggle('show'));
  $('#sidebar').classList.remove('open'); updateProgress();
}
function renderSections(sections){return sections.map(s=>`<article class="study-section"><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml(s.body||'')}</p>${s.bullets?`<ul>${s.bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>`:''}${s.table?renderTable(s.table):''}</article>`).join('')}
function renderTable(rows){return `<div class="table-wrap"><table>${rows.map(row=>`<tr>${row.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</table></div>`}
function card(title,body,cls=''){return `<section class="card ${cls}"><h3>${title}</h3>${body}</section>`}
function renderQuiz(quiz){return quiz.length?quiz.map((q,i)=>`<details class="quiz"><summary>Quiz ${i+1}. ${escapeHtml(q.question)}</summary><div class="quiz-body">${q.choices.map((c,idx)=>`<label class="choice">${String.fromCharCode(65+idx)}. ${escapeHtml(c)}</label>`).join('')}<button class="answer-btn">정답 보기</button><div class="answer"><strong>정답: ${String.fromCharCode(65+q.answer)}</strong><br>${escapeHtml(q.explanation)}</div></div></details>`).join(''):'<p class="meta">이 LOS의 퀴즈는 다음 확장 버전에 추가됩니다.</p>'}
function search(q){
  if(!q){renderReadingList(state.currentBook);return}
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits=state.allItems.filter(item=>{const l=item.los; const sections=(l.sections||[]).map(s=>[s.title,s.body,...(s.bullets||[]),...(s.table||[]).flat()].join(' ')).join(' '); const hay=[item.bookTitle,item.readingTitle,item.topic,l.id,l.label,l.title,l.losText,l.why,sections,...(l.formulas||[]),...(l.keywords||[])].join(' ').toLowerCase(); return terms.every(t=>hay.includes(t));});
  $('#readingListPanel').innerHTML=hits.length?`<div class="reading-group"><strong>검색 결과 ${hits.length}개</strong><div class="los-list">${hits.map(h=>`<button class="los-chip" data-book="${h.bookKey}" data-reading="${h.readingId}" data-los="${h.los.id}"><strong>${escapeHtml(h.bookTitle.split('|')[0].trim())} · ${escapeHtml(h.los.label||h.los.id)}</strong><br>${escapeHtml(h.readingTitle)}<br>${highlight(h.los.title,q)}</button>`).join('')}</div></div>`:`<div class="reading-group meta">검색 결과가 없습니다.</div>`;
  document.querySelectorAll('.los-chip').forEach(ch=>ch.onclick=()=>{openBook(ch.dataset.book,ch.dataset.reading,ch.dataset.los)});
}
function updateProgress(){
  const total=state.allItems.length; const done=state.allItems.filter(i=>localStorage.getItem(storageKey.done(`${i.bookKey}_${i.readingId}_${i.los.id}`))==='1').length;
  const pct=total?Math.round(done/total*100):0; $('#progressText').textContent=`${pct}%`; $('#progressFill').style.width=`${pct}%`; $('#progressDetail').textContent=`${done} / ${total} LOS 완료`;
}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1600)}
function escapeHtml(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function highlight(text,q){const t=escapeHtml(text); if(!q)return t; const safe=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return t.replace(new RegExp(`(${safe})`,'ig'),'<mark>$1</mark>')}
init();