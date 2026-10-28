const $=id=>document.getElementById(id);
const THEME_KEY='vocabquest-theme-v2';
const SOUND_KEY='vocabquest-sound-v1';
let soundEnabled=localStorage.getItem(SOUND_KEY)!=='off';
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  const dark=theme==='dark',btn=$('themeToggle');
  if(btn){btn.textContent=dark?'☀':'☾';btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');btn.title=dark?'Switch to light mode':'Switch to dark mode'}
  const meta=$('themeColorMeta');if(meta)meta.setAttribute('content',dark?'#101116':'#f7f7fb');
}
function initTheme(){
  let saved=localStorage.getItem(THEME_KEY);
  if(!saved)saved=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  applyTheme(saved);
  $('themeToggle').addEventListener('click',()=>{
    const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    localStorage.setItem(THEME_KEY,next);applyTheme(next);
  });
}
initTheme();

/* Short synthesized sound effects; no audio files or network requests required. */
let audioContext=null;
function playSound(kind){
  if(!soundEnabled)return;
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    audioContext=audioContext||new AudioCtx();
    if(audioContext.state==='suspended')audioContext.resume();
    const now=audioContext.currentTime;
    const notes=kind==='correct'?[660,880]:kind==='wrong'?[240,185]:[523,659,784,1047];
    notes.forEach((freq,i)=>{
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();
      osc.type=kind==='wrong'?'triangle':'sine';osc.frequency.setValueAtTime(freq,now+i*.105);
      gain.gain.setValueAtTime(.0001,now+i*.105);
      gain.gain.exponentialRampToValueAtTime(kind==='wrong'?.12:.10,now+i*.105+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,now+i*.105+.12);
      osc.connect(gain);gain.connect(audioContext.destination);
      osc.start(now+i*.105);osc.stop(now+i*.105+.14);
    });
  }catch(e){/* Sound is optional; the quiz should still work if audio is unavailable. */}
}

let words=[],state,question=null,lastShownIndex=null,review={pool:[],index:0,correct:0,current:null};
const KEY='vocabquest-state-v1';
const today=()=>new Date().toLocaleDateString('en-CA');
const fresh=()=>({counts:{},mastered:[],level:0,queue:[],today:today(),todayNew:[],answers:0,correctAnswers:0,lastShownIndex:null});
function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY));if(!s)return fresh();
    if(!s.counts)s.counts={};if(!Array.isArray(s.mastered))s.mastered=[];if(!Array.isArray(s.queue))s.queue=[];
    if(!Array.isArray(s.todayNew))s.todayNew=[];if(typeof s.level!=='number')s.level=0;
    return s;
  }catch{return fresh()}
}
function save(){state.lastShownIndex=lastShownIndex;localStorage.setItem(KEY,JSON.stringify(state))}
function count(i){return state.counts[i]||0}
function levelWords(){return words.slice(state.level*10,Math.min(state.level*10+10,words.length))}
function masteredInLevel(){return levelWords().filter(w=>state.mastered.includes(words.indexOf(w))).length}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function optionsFor(w){const others=shuffle(words.filter(x=>x.word!==w.word)).slice(0,3).map(x=>x.meaning);return shuffle([w.meaning,...others])}

/* Wrong answers enter a five-item practice queue. Queue items are selected randomly
   and deliberately interleaved with other active level words where possible. */
function getQuestion(){
  const queued=state.queue.map((i,pos)=>({i,pos})).filter(x=>x.i!==lastShownIndex);
  const active=levelWords().map(w=>words.indexOf(w)).filter(i=>count(i)<3&&i!==lastShownIndex);
  const anyActive=levelWords().map(w=>words.indexOf(w)).filter(i=>count(i)<3);
  const queueCanBeUsed=queued.length>0;
  if(queueCanBeUsed&&(active.length===0||Math.random()<0.58)){
    const item=pick(queued);state.queue.splice(item.pos,1);
    return {i:item.i,w:words[item.i],recovery:true};
  }
  if(active.length){const min=Math.min(...active.map(count));const least=active.filter(i=>count(i)===min);const i=pick(least);return {i,w:words[i],recovery:false}}
  if(queueCanBeUsed){const item=pick(queued);state.queue.splice(item.pos,1);return {i:item.i,w:words[item.i],recovery:true}}
  /* If only the last word remains in the queue, allow it rather than dropping practice. */
  if(state.queue.length){const pos=Math.floor(Math.random()*state.queue.length),i=state.queue.splice(pos,1)[0];return {i,w:words[i],recovery:true}}
  if(anyActive.length){const i=pick(anyActive);return {i,w:words[i],recovery:false}}
  return null;
}
function renderQuestion(){
  if(state.level>=Math.ceil(words.length/10)){showComplete();return}
  question=getQuestion();
  if(!question){
    if(masteredInLevel()===levelWords().length){state.level++;state.queue=state.queue.filter(i=>i>=state.level*10);save();renderProgress();renderQuestion();return}
    return;
  }
  lastShownIndex=question.i;save();
  const {i,w}=question;
  $('questionNo').textContent=`WORD ${i-state.level*10+1} OF ${levelWords().length}`;
  if(question.recovery&& (i<state.level*10||i>=state.level*10+10))$('questionNo').textContent='EXTRA PRACTICE';
  $('word').textContent=w.word;$('wordPos').textContent=w.pos;$('options').innerHTML='';
  $('feedback').className='feedback hidden';$('nextBtn').classList.add('hidden');
  optionsFor(w).forEach((meaning,n)=>{
    const b=document.createElement('button');b.className='option';
    b.innerHTML=`<span class="letter">${'ABCD'[n]}</span><span>${escapeHtml(meaning)}</span>`;
    b.addEventListener('click',()=>answer(b,meaning));$('options').appendChild(b);
  });
}
function answer(btn,meaning){
  if(btn.disabled)return;
  const ok=meaning===question.w.meaning;
  [...$('options').children].forEach(b=>{b.disabled=true;if(b.lastElementChild.textContent===question.w.meaning)b.classList.add('correct')});
  if(!ok)btn.classList.add('wrong');
  state.answers=(state.answers||0)+1;
  if(ok){
    playSound('correct');state.correctAnswers=(state.correctAnswers||0)+1;
    state.counts[question.i]=count(question.i)+1;
    if(count(question.i)>=3&&!state.mastered.includes(question.i)){
      state.mastered.push(question.i);
      if(state.today!==today()){state.today=today();state.todayNew=[]}
      state.todayNew.push(question.i);
    }
  }else{
    playSound('wrong');
    state.queue.push(...Array(5).fill(question.i));
  }
  save();
  const fb=$('feedback');fb.className='feedback '+(ok?'good':'bad');
  const progress=ok?`Correct! ${Math.min(count(question.i),3)} of 3 mastery answers.`:'Not quite. This word has been added to your extra-practice queue and will return between other words.';
  fb.innerHTML=`<strong>${ok?'✓ Correct!':'↻ Keep practising'}</strong>${escapeHtml(question.w.meaning)}<div>${escapeHtml(progress)}</div><div class="example">“${escapeHtml(question.w.example)}”</div>`;
  $('nextBtn').classList.remove('hidden');
  $('nextBtn').onclick=()=>{
    if(state.level>=Math.ceil(words.length/10)){showComplete();return}
    if(masteredInLevel()===levelWords().length&&state.queue.length===0){
      playSound('level');state.level++;lastShownIndex=null;save();
    }
    renderProgress();renderQuestion();
  };
  renderProgress();
}
function showComplete(){
  playSound('level');
  $('quizCard').innerHTML=`<div style="text-align:center;padding:30px 4px"><div style="font-size:48px">✦</div><p class="eyebrow">VOCABULARY CHAMPION</p><h2>All ${words.length} words mastered!</h2><p class="muted">You can now use Quick test to keep them fresh.</p><button class="primary" id="completeReviewBtn">Take a quick test →</button></div>`;
  $('completeReviewBtn').onclick=()=>switchView('review');
}
function renderProgress(){
  const total=state.mastered.length,level=levelWords(),done=masteredInLevel(),pct=level.length?Math.round(done/level.length*100):100;
  $('todayCount').textContent=state.today===today()?state.todayNew.length:0;
  $('levelLabel').textContent=`LEVEL ${String(Math.min(state.level+1,Math.ceil(words.length/10))).padStart(2,'0')}`;
  $('groupTitle').textContent=words[state.level*10]?.group||'Vocabulary complete';
  $('levelSub').textContent=`${Math.min(state.level*10+10,words.length)} words in your journey`;
  $('levelPct').textContent=pct+'%';document.querySelector('.level-ring').style.setProperty('--pct',pct+'%');
  $('levelBar').style.width=pct+'%';$('levelWordCount').textContent=`${done} of ${level.length} words mastered`;
  $('overallCount').textContent=`${total} / ${words.length}`;$('reviewPool').textContent=total;
  $('statMastered').textContent=total;$('statToday').textContent=state.today===today()?state.todayNew.length:0;
  $('statLevel').textContent=Math.min(state.level+1,Math.ceil(words.length/10));
  $('statAccuracy').textContent=state.answers?Math.round(state.correctAnswers/state.answers*100)+'%':'—';
  const allPct=Math.round(total/words.length*100);$('statsPct').textContent=allPct+'%';$('overallBar').style.width=allPct+'%';
  $('statsMessage').textContent=total?`You have mastered ${total} of ${words.length} words. Keep the streak alive.`:'Your journey starts with one word.';
}
function render(){if(state.today!==today()){state.today=today();state.todayNew=[];save()}renderProgress()}
function switchView(v){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  ['learn','review','stats'].forEach(x=>$(x+'View').classList.toggle('hidden',x!==v));
  if(v==='review')$('reviewPool').textContent=state.mastered.length;
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
function startReview(){
  review.pool=shuffle([...state.mastered]);review.index=0;review.correct=0;
  if(!review.pool.length){$('reviewArea').classList.remove('hidden');$('reviewArea').innerHTML='<p class="muted">Master a few words first, then come back for a review quiz.</p>';return}
  $('reviewArea').classList.remove('hidden');$('startReview').classList.add('hidden');renderReview();
}
function renderReview(){
  if(review.index>=review.pool.length){
    $('reviewArea').innerHTML=`<div style="text-align:center;padding:20px 0"><h2>Review complete ✦</h2><p class="muted">You got ${review.correct} of ${review.pool.length} correct.</p><button class="primary" id="restartReviewBtn">Start another review →</button></div>`;
    $('restartReviewBtn').onclick=resetReview;playSound('level');return;
  }
  const w=words[review.pool[review.index]];review.current=w;
  $('reviewNo').textContent=`QUESTION ${review.index+1} OF ${review.pool.length}`;$('reviewWord').textContent=w.word;
  $('reviewOptions').innerHTML='';$('reviewFeedback').className='feedback hidden';$('reviewNext').classList.add('hidden');
  optionsFor(w).forEach((m,n)=>{
    const b=document.createElement('button');b.className='option';b.innerHTML=`<span class="letter">${'ABCD'[n]}</span><span>${escapeHtml(m)}</span>`;
    b.addEventListener('click',()=>{
      [...$('reviewOptions').children].forEach(x=>{x.disabled=true;if(x.lastElementChild.textContent===w.meaning)x.classList.add('correct')});
      const ok=m===w.meaning;if(!ok)b.classList.add('wrong');else review.correct++;
      playSound(ok?'correct':'wrong');
      $('reviewFeedback').className='feedback '+(ok?'good':'bad');
      $('reviewFeedback').innerHTML=`<strong>${ok?'✓ Correct!':'↻ Review this meaning'}</strong>${escapeHtml(w.meaning)}<div class="example">“${escapeHtml(w.example)}”</div>`;
      $('reviewNext').classList.remove('hidden');
    });
    $('reviewOptions').appendChild(b);
  });
  $('reviewNext').onclick=()=>{review.index++;renderReview()};
}
function resetReview(){$('reviewArea').classList.add('hidden');$('startReview').classList.remove('hidden');startReview()}
$('startReview').addEventListener('click',startReview);

fetch('words.json').then(r=>{if(!r.ok)throw new Error('Could not load words.json');return r.json()}).then(data=>{
  words=data;state=load();lastShownIndex=Number.isInteger(state.lastShownIndex)?state.lastShownIndex:null;
  if(!state.todayNew)state.todayNew=[];
  if(state.level>=Math.ceil(words.length/10))state.level=Math.ceil(words.length/10)-1;
  render();renderQuestion();
}).catch(()=>{$('word').textContent='Could not load words';$('levelSub').textContent='Refresh the page and try again.'});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
