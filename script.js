const BOOKS=['book1','book2','book3','book4','book5'];
const state={books:{},currentBook:null,currentReading:null,allReadings:[]};
const $=s=>document.querySelector(s);
const storageKey={done:id=>`cfa_done_${id}`,note:id=>`cfa_note_${id}`,last:'cfa_last_reading'};
async function init(){
  const loaded=await Promise.all(BOOKS.map(b=>fetch(`data/${b}.json`).then(r=>r.json())));
  loaded.forEach((book,i)=>{state.books[BOOKS[i]]=book; book.readings.forEach(r=>state.allReadings.push({...r,bookKey:BOOKS[i],bookTitle:book.title}))});
  renderBookNav();
  const last=JSON.parse(localStorage.getItem(storageKey.last)||'null');
  if(last && state.books[last.bookKey]) openBook(last.bookKey,last.readingId); else openBook('book1');
  bind(); updateProgress();
}
function bind(){
  $('#searchInput').addEventListener('input', e=>search(e.target.value.trim()));
  $('#clearSearch').addEventListener('click',()=>{$('#searchInput').value=''; renderReadingList(state.currentBook);});
  $('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
}
function renderBookNav(){
  $('#bookNav').innerHTML=BOOKS.map(b=>`<button class="book-btn" data-book="${b}">${state.books[b].bookId}<br><small>${state.books[b].title.split('|')[1]?.trim()||''}</small></button>`).join('');
  document.querySelectorAll('.book-btn').forEach(btn=>btn.onclick=()=>openBook(btn.dataset.book));
}
function openBook(bookKey,readingId){
  state.currentBook=bookKey; document.querySelectorAll('.book-btn').forEach(b=>b.classList.toggle('active',b.dataset.book===bookKey));
  renderReadingList(bookKey);
  const r=readingId?state.books[bookKey].readings.find(x=>x.id===readingId):state.books[bookKey].readings[0];
  if(r) openReading(bookKey,r.id); $('#sidebar').classList.remove('open');
}
function renderReadingList(bookKey, list=state.books[bookKey].readings){
  $('#readingListPanel').innerHTML=list.map(r=>`<button class="reading-chip" data-id="${r.id}" data-book="${bookKey}">${r.id} ${r.title}</button>`).join('');
  document.querySelectorAll('.reading-chip').forEach(ch=>ch.onclick=()=>openReading(ch.dataset.book,ch.dataset.id));
}
function openReading(bookKey,id){
  const r=state.books[bookKey].readings.find(x=>x.id===id); if(!r)return; state.currentReading=r;
  localStorage.setItem(storageKey.last,JSON.stringify({bookKey,readingId:id}));
  document.querySelectorAll('.reading-chip').forEach(c=>c.classList.toggle('active',c.dataset.id===id));
  const done=localStorage.getItem(storageKey.done(id))==='1'; const note=localStorage.getItem(storageKey.note(id))||'';
  $('#mainPanel').classList.remove('empty');
  $('#mainPanel').innerHTML=`
    <div class="reading-head"><div><div class="meta">${state.books[bookKey].title} · ${r.topic}</div><h2>${r.id}. ${r.title}</h2><p class="meta">${r.sourceNote}</p></div><label class="complete-wrap"><input type="checkbox" id="doneBox" ${done?'checked':''}/> 학습 완료</label></div>
    <div class="grid">
      ${card('1. 핵심 개념 요약',list(r.coreSummary))}
      ${card('2. 시험에 자주 나오는 포인트',list(r.examPoints))}
      ${card('3. 공식/계산식',r.formulas.map(f=>`<div class="formula">${escapeHtml(f)}</div>`).join(''))}
      ${card('4. 헷갈리는 개념 비교',r.comparisons.map(c=>`<div class="comparison"><div><strong>${c.leftTitle}</strong>${c.left}</div><div><strong>${c.rightTitle}</strong>${c.right}</div></div>`).join(''))}
      ${card('5. 예시 문제',`<p>${r.exampleProblem}</p><p class="meta">${r.importantNote}</p>`,'wide')}
      ${card('6~7. 객관식 퀴즈 · 정답 및 해설',renderQuizzes(r),'wide')}
      ${card('8. 오답노트',`<textarea id="noteArea" class="note-area" placeholder="틀린 이유, 헷갈린 공식, 다시 볼 포인트를 적어줘.">${escapeHtml(note)}</textarea><br><br><button class="save-note" id="saveNote">오답노트 저장</button>`,'wide')}
      ${card('10. 검색 기능용 키워드',r.keywords.map(k=>`<span class="keyword">${escapeHtml(k)}</span>`).join(''),'wide')}
    </div>`;
  $('#doneBox').onchange=e=>{localStorage.setItem(storageKey.done(id),e.target.checked?'1':'0'); updateProgress();};
  $('#saveNote').onclick=()=>{localStorage.setItem(storageKey.note(id),$('#noteArea').value); toast('오답노트 저장 완료');};
  document.querySelectorAll('.answer-btn').forEach(btn=>btn.onclick=()=>btn.nextElementSibling.classList.toggle('show'));
  updateProgress();
}
function card(title,body,cls=''){return `<section class="card ${cls}"><h3>${title}</h3>${body}</section>`}
function list(arr){return `<ul>${arr.map(x=>`<li>${x}</li>`).join('')}</ul>`}
function renderQuizzes(r){return r.quizzes.map((q,i)=>`<details class="quiz"><summary>Quiz ${i+1}. ${q.question}</summary><div class="quiz-body">${q.choices.map((c,idx)=>`<label class="choice">${String.fromCharCode(65+idx)}. ${c}</label>`).join('')}<button class="answer-btn">정답 보기</button><div class="answer"><strong>정답: ${String.fromCharCode(65+q.answer)}</strong><br>${q.explanation}</div></div></details>`).join('')}
function search(q){
  if(!q){renderReadingList(state.currentBook);return}
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
  const results=state.allReadings.filter(r=>{const hay=[r.title,r.topic,...r.coreSummary,...r.examPoints,...r.formulas,...r.keywords].join(' ').toLowerCase();return terms.every(t=>hay.includes(t));});
  $('#readingListPanel').innerHTML=results.length?results.map(r=>`<button class="reading-chip" data-id="${r.id}" data-book="${r.bookKey}">${r.bookKey.toUpperCase()} · ${r.id} ${highlight(r.title,q)}</button>`).join(''):`<span class="meta">검색 결과가 없습니다.</span>`;
  document.querySelectorAll('.reading-chip').forEach(ch=>ch.onclick=()=>{state.currentBook=ch.dataset.book; openBook(ch.dataset.book,ch.dataset.id)});
}
function updateProgress(){
  const total=state.allReadings.length; const done=state.allReadings.filter(r=>localStorage.getItem(storageKey.done(r.id))==='1').length;
  const pct=total?Math.round(done/total*100):0; $('#progressText').textContent=`${pct}%`; $('#progressFill').style.width=`${pct}%`; $('#progressDetail').textContent=`${done} / ${total} readings 완료`;
}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1600)}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function highlight(text,q){const t=escapeHtml(text); return q? t.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig'),'<mark>$1</mark>'):t}
init();
