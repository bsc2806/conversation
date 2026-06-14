// ===== 데일리 회화 — 웹 미리보기 앱 =====
const state = {
  lessons: [],
  vocab: [],
  day: 1,
  tab: 'today',
  rate: 1,
  flashIndex: 0,
  done: JSON.parse(localStorage.getItem('done') || '{}'),            // { "convo-1": true, "vocab-1": true }
  completedOn: JSON.parse(localStorage.getItem('completedOn') || '{}'), // { day: "YYYY-MM-DD" } 풀 완료 날짜
};

const $ = (sel) => document.querySelector(sel);
const content = $('#content');

// ---------- 데이터 로드 ----------
async function load() {
  const [l, v] = await Promise.all([
    fetch('/content/lessons_en.json').then(r => r.json()),
    fetch('/content/vocabulary_en.json').then(r => r.json()),
  ]);
  state.lessons = l.lessons;
  state.vocab = v.vocab_days;
  state.allWords = state.vocab.flatMap(d => d.words); // 퀴즈 오답 보기용 전체 단어 풀

  const sel = $('#daySelect');
  sel.innerHTML = state.lessons.map(les =>
    `<option value="${les.day}">Day ${les.day} · ${les.situation}</option>`
  ).join('');

  bindNav();
  render();
}

// ---------- 완료/잠금 ----------
function isConvoDone(day) { return !!state.done['convo-' + day]; }
function isVocabDone(day) { return !!state.done['vocab-' + day]; }
function isDayComplete(day) { return isConvoDone(day) && isVocabDone(day); } // 풀 완료(연속 학습 인정)
// 회화를 완료하면 다음 회화가 열린다
function isUnlocked(day) { return day === 1 || isConvoDone(day - 1); }

// ---------- 날짜 기준 연속(streak) ----------
function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayKey() { return dateKey(new Date()); }
// 풀 완료한 날짜들 기준으로 오늘(또는 어제)부터 거슬러 올라가며 연속 일수 계산
function streakCount() {
  const set = new Set(Object.values(state.completedOn));
  if (set.size === 0) return 0;
  const cursor = new Date();
  if (!set.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1); // 오늘 미학습이면 어제까지는 인정(유예)
  let streak = 0;
  while (set.has(dateKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function updateStreak() { $('#streak').textContent = `🔥 ${streakCount()}일 연속`; }

// ---------- TTS ----------
function speakOne(text, rate = state.rate) {
  if (!('speechSynthesis' in window)) { alert('이 브라우저는 음성 합성을 지원하지 않습니다.'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = rate;
  window.speechSynthesis.speak(u);
}
// 턴(A·B)별로 끊어 읽고 사이에 텀을 둔다 (기존 1300ms의 2/3)
function speakSequence(texts, gap = 870) {
  if (!('speechSynthesis' in window)) { alert('이 브라우저는 음성 합성을 지원하지 않습니다.'); return; }
  window.speechSynthesis.cancel();
  let i = 0;
  const next = () => {
    if (i >= texts.length) return;
    const u = new SpeechSynthesisUtterance(texts[i]);
    u.lang = 'en-US'; u.rate = state.rate;
    u.onend = () => { i++; if (i < texts.length) setTimeout(next, gap); };
    window.speechSynthesis.speak(u);
  };
  next();
}

// ---------- 완료 처리 ----------
function persistDone(key) {
  state.done[key] = true;
  localStorage.setItem('done', JSON.stringify(state.done));
  // 풀 완료가 된 시점에 그 날짜를 기록(연속 계산용)
  if (isDayComplete(state.day) && !state.completedOn[state.day]) {
    state.completedOn[state.day] = todayKey();
    localStorage.setItem('completedOn', JSON.stringify(state.completedOn));
  }
}
function markDone(key) { persistDone(key); render(); }

// ---------- 녹음 (1차 기능) ----------
let mediaRecorder = null, chunks = [], lastAudioUrl = null;
async function toggleRecord(btn, audioEl) {
  if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
      lastAudioUrl = URL.createObjectURL(blob);
      audioEl.src = lastAudioUrl; audioEl.style.display = 'block';
      btn.classList.remove('on'); btn.textContent = '🎙️ 다시 녹음';
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    btn.classList.add('on'); btn.textContent = '⏹️ 녹음 중지';
  } catch (e) { alert('마이크 권한이 필요합니다.'); }
}

// ---------- 렌더 ----------
function lesson() { return state.lessons.find(l => l.day === state.day); }
function vocabDay() { return state.vocab.find(v => v.day === state.day); }

function render() {
  if (state.tab === 'today') renderToday();
  else if (state.tab === 'convo') renderConvo();
  else if (state.tab === 'vocab') renderVocab();
  else if (state.tab === 'settings') renderSettings();
  updateStreak();
  updateNav();
}

function renderToday() {
  const les = lesson();
  const v = vocabDay();
  const convoDone = isConvoDone(state.day);
  const vocabDone = isVocabDone(state.day);
  const allDone = convoDone && vocabDone;
  content.innerHTML = `
    <div class="card">
      <span class="label">오늘의 학습 · Day ${les.day}</span>
      <div style="margin:10px 0;">
        <span class="pill lv-${les.level}">${les.level}</span>
        <span class="pill">${les.situation}</span>
      </div>
      <div class="target">“${les.target_expression}”</div>
      <div class="subtle">오늘의 핵심 표현 · 단어 ${v.words.length}개 함께 학습</div>
    </div>

    <div class="card">
      <span class="label">진행 상황</span>
      <div class="setrow"><label>💬 회화 학습</label>${convoDone ? '<span class="done-badge">완료</span>' : '<span class="subtle">미완료</span>'}</div>
      <div class="setrow"><label>📖 단어 암기</label>${vocabDone ? '<span class="done-badge">완료</span>' : '<span class="subtle">미완료</span>'}</div>
      <button class="btn primary" id="goConvo">회화부터 시작하기</button>
      <button class="btn ghost" id="goVocab">단어 암기하기</button>
      ${allDone
        ? `<div class="locknote" style="background:#e7faf0;border-color:#bfeed4;color:#0d8a52;">✅ 오늘 학습 완료! 🔥 연속 학습에 반영되었어요.</div>`
        : convoDone
          ? `<div class="locknote">💬 회화 완료 — 다음 회화가 열렸어요. 단어까지 끝내야 <b>🔥 연속 학습</b>에 반영됩니다.</div>`
          : `<div class="locknote">🔒 회화를 완료하면 다음 회화가 열려요. 회화·단어를 모두 끝내면 <b>🔥 연속 학습</b>에 반영됩니다.</div>`}
    </div>
  `;
  $('#goConvo').onclick = () => switchTab('convo');
  $('#goVocab').onclick = () => switchTab('vocab');
}

function renderConvo() {
  const les = lesson();
  const convoDone = isConvoDone(state.day);
  const hasNext = state.day < state.lessons.length;
  const turns = (les.dialog_turns || []).map((t) => `
    <div class="turn">
      <div class="spk ${t.speaker === 'B' ? 'b' : ''}">${t.speaker}</div>
      <div class="bubble">
        <div class="en">${t.text}</div>
        <div class="ko">${t.translation}</div>
        <button class="btn-mini" data-say="${encodeURIComponent(t.text)}">🔊 듣기</button>
      </div>
    </div>`).join('');

  const vars = (les.native_variations || []).map(nv => `
    <div class="variation ${nv.register}">
      <div class="reg">${nv.register === 'polite' ? '정중/표준' : nv.register === 'casual' ? '캐주얼' : '슬랭/현지'}</div>
      <div class="vtext">${nv.text} <button class="btn-mini" data-say="${encodeURIComponent(nv.text)}">🔊</button></div>
      <div class="vko">${nv.translation}</div>
      <div class="vnote">💡 ${nv.note}</div>
    </div>`).join('');

  content.innerHTML = `
    <div class="card">
      <span class="label">회화 · Day ${les.day} · ${les.situation}</span>
      <div class="target" style="font-size:19px;">“${les.target_expression}”</div>
      <div class="subtle">/ ${les.phonetic} /</div>
      <button class="btn primary" id="playAll">▶ 전체 다이얼로그 듣기</button>
      ${turns}
    </div>

    <div class="card">
      <span class="label">표현 더보기 — 정중 vs 현지 표현</span>
      ${vars}
    </div>

    <div class="card">
      <span class="label">따라 말하기 (1차 · 녹음)</span>
      <div class="subtle" style="margin:6px 0;">원음을 듣고 → 녹음한 뒤 → 번갈아 들으며 스스로 비교해 보세요.</div>
      <div class="row">
        <button class="btn ghost" id="hearOrig">🔊 원음</button>
        <button class="btn rec" id="recBtn">🎙️ 녹음</button>
      </div>
      <audio id="myAudio" controls style="width:100%;margin-top:10px;display:none;"></audio>
      <div class="subtle" style="margin-top:8px;">※ 2차: 원음·내 녹음 파형 비교 + 받아쓰기 자동채점 예정</div>
      <button class="btn primary" id="convoDone">${convoDone ? '회화 완료됨 ✓' : '회화 학습 완료 ✓'}</button>
      ${convoDone && hasNext ? `<button class="btn ghost" id="nextConvo">다음 회화로 ▶</button>` : ''}
    </div>
  `;

  content.querySelectorAll('[data-say]').forEach(b =>
    b.onclick = () => speakOne(decodeURIComponent(b.dataset.say)));
  $('#playAll').onclick = () => speakSequence(les.dialog_turns.map(t => t.text)); // 턴별 텀 870ms
  $('#hearOrig').onclick = () => speakOne(les.target_expression);
  const recBtn = $('#recBtn'), myAudio = $('#myAudio');
  recBtn.onclick = () => toggleRecord(recBtn, myAudio);
  $('#convoDone').onclick = () => markDone('convo-' + state.day);
  const nc = $('#nextConvo');
  if (nc) nc.onclick = () => goNext();
}

function renderVocab() {
  const v = vocabDay();
  const words = v.words;
  if (state.flashIndex >= words.length) state.flashIndex = 0;
  const w = words[state.flashIndex];
  const pct = Math.round((state.flashIndex / words.length) * 100);

  content.innerHTML = `
    <div class="card">
      <span class="label">단어 · Day ${v.day} · ${v.theme}</span>
      <div class="subtle" style="margin:6px 0;">${state.flashIndex + 1} / ${words.length}</div>
      <div class="progress"><span style="width:${pct}%"></span></div>

      <div class="flash" id="flash">
        <div class="flash-inner">
          <div class="flash-face flash-front">
            <div class="word">${w.word}</div>
            <div class="pos">${w.pos} · / ${w.phonetic} /</div>
            <div class="ex">${w.example}</div>
          </div>
          <div class="flash-face flash-back">
            <div class="mean">${w.meaning}</div>
            <div class="ex">${w.example_translation}</div>
          </div>
        </div>
      </div>
      <div class="tap-hint">카드를 탭하면 뜻이 보여요</div>

      <div class="row">
        <button class="btn ghost" id="sayWord">🔊 발음</button>
        <button class="btn ghost" id="prevWord">‹ 이전</button>
        <button class="btn primary" id="nextWord">다음 ›</button>
      </div>
      <button class="btn primary" id="startQuiz" style="margin-top:10px;">📝 퀴즈 풀기</button>
    </div>
  `;
  const flash = $('#flash');
  flash.onclick = () => flash.classList.toggle('flipped');
  $('#sayWord').onclick = (e) => { e.stopPropagation(); speakOne(w.word); };
  $('#prevWord').onclick = () => { state.flashIndex = (state.flashIndex - 1 + words.length) % words.length; render(); };
  $('#nextWord').onclick = () => { state.flashIndex = (state.flashIndex + 1) % words.length; render(); };
  $('#startQuiz').onclick = () => renderQuiz();
}

// 오답 보기를 전체 단어(600개) 풀에서 추출 — 뜻이 겹치지 않게
function buildOptions(correct) {
  const pool = shuffle(state.allWords.slice());
  const used = new Set([correct.meaning]);
  const distractors = [];
  for (const w of pool) {
    if (used.has(w.meaning)) continue;
    used.add(w.meaning);
    distractors.push(w);
    if (distractors.length === 3) break;
  }
  return shuffle([correct, ...distractors]);
}

function renderQuiz(qIndex = 0, score = 0) {
  const v = vocabDay();
  const words = v.words;
  if (qIndex >= words.length) { renderQuizResult(score, words.length); return; }

  const correct = words[qIndex];
  const options = buildOptions(correct);
  const last = qIndex === words.length - 1;

  content.innerHTML = `
    <div class="card">
      <span class="label">퀴즈 · ${qIndex + 1} / ${words.length}</span>
      <div class="progress"><span style="width:${Math.round((qIndex / words.length) * 100)}%"></span></div>
      <div class="quiz-q">"${correct.word}" 의 뜻은?</div>
      <div id="opts">
        ${options.map(o => `<button class="opt" data-correct="${o === correct}">${o.meaning}</button>`).join('')}
      </div>
      <div id="quizFoot"></div>
    </div>`;

  let answered = false;
  content.querySelectorAll('.opt').forEach(btn => {
    btn.onclick = () => {
      if (answered) return;           // 한 번만 채점
      answered = true;
      const isRight = btn.dataset.correct === 'true';
      btn.classList.add(isRight ? 'correct' : 'wrong');
      if (!isRight) content.querySelector('.opt[data-correct="true"]').classList.add('correct');
      content.querySelectorAll('.opt').forEach(b => b.disabled = true);
      // 자동으로 넘어가지 않고 '다음' 버튼으로 2차 확인
      $('#quizFoot').innerHTML = `
        <div class="quiz-feedback ${isRight ? 'ok' : 'no'}">
          ${isRight ? '정답이에요! 👏' : '아쉬워요 — 정답을 확인하고 넘어가세요.'}
        </div>
        <button class="btn primary" id="nextQ">${last ? '결과 보기 →' : '다음 ›'}</button>`;
      $('#nextQ').onclick = () => renderQuiz(qIndex + 1, score + (isRight ? 1 : 0));
    };
  });
}

function renderQuizResult(score, total) {
  persistDone('vocab-' + state.day);   // 퀴즈 완주 = 단어 암기 완료 처리(자동)
  const allDone = isDayComplete(state.day);
  content.innerHTML = `
    <div class="card" style="text-align:center;">
      <span class="label">퀴즈 완료</span>
      <div class="target">${score} / ${total}</div>
      <div class="subtle">단어 암기를 완료했어요 ✓</div>
      ${allDone
        ? `<div class="locknote" style="background:#e7faf0;border-color:#bfeed4;color:#0d8a52;justify-content:center;">✅ 오늘 학습 완료! 🔥 연속 학습에 반영되었어요.</div>`
        : `<div class="locknote" style="justify-content:center;">💬 회화까지 끝내면 <b>🔥 연속 학습</b>에 반영됩니다.</div>`}
      <button class="btn primary" id="toToday">오늘 학습으로</button>
      <button class="btn ghost" id="retry">다시 풀기</button>
    </div>`;
  $('#toToday').onclick = () => switchTab('today');
  $('#retry').onclick = () => { state.flashIndex = 0; renderQuiz(); };
  updateStreak();
  updateNav();
}

function renderSettings() {
  content.innerHTML = `
    <div class="card">
      <span class="label">설정</span>
      <div class="setrow">
        <label>음성 속도</label>
        <input type="range" id="rate" min="0.5" max="1.3" step="0.1" value="${state.rate}" />
      </div>
      <div class="setrow"><label>현재 속도</label><span id="rateVal">${state.rate.toFixed(1)}x</span></div>
      <div class="setrow"><label>음성 테스트</label><button class="btn-mini" id="testVoice">🔊 Hello!</button></div>
    </div>
    <div class="card">
      <span class="label">진행 초기화</span>
      <div class="subtle" style="margin:6px 0;">완료 기록·연속 일수·잠금 상태를 모두 지웁니다.</div>
      <button class="btn ghost" id="reset">기록 초기화</button>
    </div>
    <div class="card">
      <span class="label">정보</span>
      <div class="subtle">언어: 영어(en) · 콘텐츠 60일 / 단어 600개<br/>확장 예정: 일본어 · 프랑스어</div>
    </div>
  `;
  const rate = $('#rate');
  rate.oninput = () => { state.rate = parseFloat(rate.value); $('#rateVal').textContent = state.rate.toFixed(1) + 'x'; };
  $('#testVoice').onclick = () => speakOne('Hello! How are you today?');
  $('#reset').onclick = () => {
    state.done = {}; state.completedOn = {};
    localStorage.removeItem('done'); localStorage.removeItem('completedOn');
    state.day = 1; syncDay();
  };
}

// ---------- 유틸/네비 ----------
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

function switchTab(tab) {
  state.tab = tab;
  state.flashIndex = 0;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  render();
}

// 다음 day로 이동(회화 완료 시 가능). 단어 미완료면 연속 미반영 안내.
function goNext() {
  const target = state.day + 1;
  if (target > state.lessons.length || !isUnlocked(target)) return;
  if (!isDayComplete(state.day)) {
    const ok = confirm(
      `아직 '단어 암기'를 완료하지 않았어요.\n` +
      `지금 다음 회화로 넘어가면 오늘은 🔥 연속 학습에 포함되지 않습니다.\n\n계속하시겠어요?`
    );
    if (!ok) return;
  }
  state.day = target;
  syncDay();
}

function updateNav() {
  const sel = $('#daySelect');
  [...sel.options].forEach(opt => {
    const d = parseInt(opt.value);
    const locked = !isUnlocked(d);
    opt.disabled = locked;
    const les = state.lessons.find(l => l.day === d);
    const mark = locked ? ' 🔒' : (isDayComplete(d) ? ' ✓' : (isConvoDone(d) ? ' ·진행중' : ''));
    opt.textContent = `Day ${d} · ${les.situation}${mark}`;
  });
  sel.value = state.day;
  $('#prevDay').disabled = state.day <= 1;
  const nextExists = state.day < state.lessons.length;
  $('#nextDay').disabled = !(nextExists && isUnlocked(state.day + 1));
}

function bindNav() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
  $('#daySelect').onchange = (e) => {
    const d = parseInt(e.target.value);
    if (!isUnlocked(d)) { e.target.value = state.day; return; }
    // 앞 day의 단어 미완료 상태로 건너뛰면 안내
    if (d === state.day + 1 && !isDayComplete(state.day)) { goNext(); e.target.value = state.day; return; }
    state.day = d; state.flashIndex = 0; render();
  };
  $('#prevDay').onclick = () => { if (state.day > 1) { state.day--; syncDay(); } };
  $('#nextDay').onclick = () => goNext();
  $('#langSelect').onchange = (e) => {
    if (e.target.value !== 'en') { alert('일본어·프랑스어는 준비 중입니다. 현재는 영어만 이용할 수 있어요.'); e.target.value = 'en'; }
  };
}
function syncDay() { state.flashIndex = 0; render(); }

load();
