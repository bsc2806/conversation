// ===== 데일리 영어회화 — 웹 미리보기 앱 =====
const state = {
  lessons: [],
  vocab: [],
  day: 1,
  tab: 'today',
  rate: 1,
  flashIndex: 0,
  done: JSON.parse(localStorage.getItem('done') || '{}'), // { "convo-1": true, "vocab-1": true }
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

  // day 셀렉트 채우기
  const sel = $('#daySelect');
  sel.innerHTML = state.lessons.map(les =>
    `<option value="${les.day}">Day ${les.day} · ${les.situation}</option>`
  ).join('');

  bindNav();
  render();
}

// ---------- TTS ----------
function speak(text, rate = state.rate) {
  if (!('speechSynthesis' in window)) { alert('이 브라우저는 음성 합성을 지원하지 않습니다.'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

// ---------- 완료 처리 ----------
function markDone(key) {
  state.done[key] = true;
  localStorage.setItem('done', JSON.stringify(state.done));
  updateStreak();
  render();
}
function updateStreak() {
  // 회화+단어 둘 다 완료한 day 수를 간단 스트릭으로 표시
  let count = 0;
  state.lessons.forEach(les => {
    if (state.done['convo-' + les.day] && state.done['vocab-' + les.day]) count++;
  });
  $('#streak').textContent = `🔥 ${count}일`;
}

// ---------- 녹음 (1차 기능) ----------
let mediaRecorder = null, chunks = [], lastAudioUrl = null;
async function toggleRecord(btn, audioEl) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
      lastAudioUrl = URL.createObjectURL(blob);
      audioEl.src = lastAudioUrl;
      audioEl.style.display = 'block';
      btn.classList.remove('on');
      btn.textContent = '🎙️ 다시 녹음';
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    btn.classList.add('on');
    btn.textContent = '⏹️ 녹음 중지';
  } catch (e) {
    alert('마이크 권한이 필요합니다.');
  }
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
}

function renderToday() {
  const les = lesson();
  const v = vocabDay();
  const convoDone = state.done['convo-' + state.day];
  const vocabDone = state.done['vocab-' + state.day];
  content.innerHTML = `
    <div class="card">
      <span class="label">오늘의 학습 · Day ${les.day}</span>
      <div style="margin:8px 0;">
        <span class="pill lv-${les.level}">${les.level}</span>
        <span class="pill">${les.situation}</span>
      </div>
      <div class="target">“${les.target_expression}”</div>
      <div class="subtle">오늘의 핵심 표현 · ${v.words.length}개 단어 함께 학습</div>
    </div>

    <div class="card">
      <span class="label">진행 상황</span>
      <div class="setrow"><label>💬 회화 학습</label>${convoDone ? '<span class="done-badge">완료</span>' : '<span class="subtle">미완료</span>'}</div>
      <div class="setrow"><label>📖 단어 암기</label>${vocabDone ? '<span class="done-badge">완료</span>' : '<span class="subtle">미완료</span>'}</div>
      <button class="btn primary" id="goConvo">회화부터 시작하기</button>
      <button class="btn ghost" id="goVocab">단어 암기하기</button>
    </div>
  `;
  $('#goConvo').onclick = () => switchTab('convo');
  $('#goVocab').onclick = () => switchTab('vocab');
}

function renderConvo() {
  const les = lesson();
  const turns = (les.dialog_turns || []).map((t, i) => `
    <div class="turn">
      <div class="spk ${t.speaker !== 'A' && i % 2 === 1 ? 'b' : ''}">${t.speaker}</div>
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
      <div class="target" style="font-size:18px;">“${les.target_expression}”</div>
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
      <button class="btn primary" id="convoDone">학습 완료 ✓</button>
    </div>
  `;

  content.querySelectorAll('[data-say]').forEach(b =>
    b.onclick = () => speak(decodeURIComponent(b.dataset.say)));
  $('#playAll').onclick = () => {
    const text = les.dialog_turns.map(t => t.text).join('. ');
    speak(text);
  };
  $('#hearOrig').onclick = () => speak(les.target_expression);
  const recBtn = $('#recBtn'), myAudio = $('#myAudio');
  recBtn.onclick = () => toggleRecord(recBtn, myAudio);
  $('#convoDone').onclick = () => markDone('convo-' + state.day);
}

function renderVocab() {
  const v = vocabDay();
  const words = v.words;
  if (state.flashIndex >= words.length) state.flashIndex = 0;
  const w = words[state.flashIndex];
  const pct = Math.round(((state.flashIndex) / words.length) * 100);

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
  $('#sayWord').onclick = (e) => { e.stopPropagation(); speak(w.word); };
  $('#prevWord').onclick = () => { state.flashIndex = (state.flashIndex - 1 + words.length) % words.length; render(); };
  $('#nextWord').onclick = () => { state.flashIndex = (state.flashIndex + 1) % words.length; render(); };
  $('#startQuiz').onclick = () => renderQuiz();
}

function renderQuiz(qIndex = 0, score = 0) {
  const v = vocabDay();
  const words = v.words;
  if (qIndex >= words.length) {
    content.innerHTML = `
      <div class="card" style="text-align:center;">
        <span class="label">퀴즈 완료</span>
        <div class="target">${score} / ${words.length}</div>
        <div class="subtle">정답 개수</div>
        <button class="btn primary" id="vocabDone">단어 학습 완료 ✓</button>
        <button class="btn ghost" id="backFlash">플래시카드로</button>
      </div>`;
    $('#vocabDone').onclick = () => { markDone('vocab-' + state.day); switchTab('today'); };
    $('#backFlash').onclick = () => { state.flashIndex = 0; render(); };
    return;
  }
  const correct = words[qIndex];
  // 오답 보기 3개 추출
  const pool = words.filter((_, i) => i !== qIndex);
  shuffle(pool);
  const options = shuffle([correct, ...pool.slice(0, 3)]);

  content.innerHTML = `
    <div class="card">
      <span class="label">퀴즈 · ${qIndex + 1} / ${words.length}</span>
      <div class="quiz-q">"${correct.word}" 의 뜻은?</div>
      <div id="opts">
        ${options.map(o => `<button class="opt" data-correct="${o === correct}">${o.meaning}</button>`).join('')}
      </div>
    </div>`;

  content.querySelectorAll('.opt').forEach(btn => {
    btn.onclick = () => {
      const isRight = btn.dataset.correct === 'true';
      btn.classList.add(isRight ? 'correct' : 'wrong');
      if (!isRight) content.querySelector('.opt[data-correct="true"]').classList.add('correct');
      content.querySelectorAll('.opt').forEach(b => b.disabled = true);
      setTimeout(() => renderQuiz(qIndex + 1, score + (isRight ? 1 : 0)), 800);
    };
  });
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
      <div class="subtle" style="margin:6px 0;">완료 기록과 스트릭을 모두 지웁니다.</div>
      <button class="btn ghost" id="reset">기록 초기화</button>
    </div>
    <div class="card">
      <span class="label">정보</span>
      <div class="subtle">언어: 영어(en) · 콘텐츠 60일 / 단어 600개<br/>확장 예정: 일본어 · 프랑스어</div>
    </div>
  `;
  const rate = $('#rate');
  rate.oninput = () => { state.rate = parseFloat(rate.value); $('#rateVal').textContent = state.rate.toFixed(1) + 'x'; };
  $('#testVoice').onclick = () => speak('Hello! How are you today?');
  $('#reset').onclick = () => { state.done = {}; localStorage.removeItem('done'); render(); };
}

// ---------- 유틸 ----------
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

function switchTab(tab) {
  state.tab = tab;
  state.flashIndex = 0;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  render();
}

function bindNav() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
  $('#daySelect').onchange = (e) => { state.day = parseInt(e.target.value); state.flashIndex = 0; render(); };
  $('#prevDay').onclick = () => { if (state.day > 1) { state.day--; syncDay(); } };
  $('#nextDay').onclick = () => { if (state.day < state.lessons.length) { state.day++; syncDay(); } };
}
function syncDay() { $('#daySelect').value = state.day; state.flashIndex = 0; render(); }

load();
