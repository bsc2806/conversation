// ===== 데일리 회화 — 웹 미리보기 앱 (로그인 + 사용자별 진행도) =====
// ※ 데모용 로컬 인증입니다. 실제 앱은 Supabase Auth로 처리하며
//   클라이언트에 비밀번호를 저장하지 않습니다. (여기서는 UX 검증 목적)
const state = {
  lessons: [],
  vocab: [],
  allWords: [],
  day: 1,
  tab: 'today',
  rate: 1,
  flashIndex: 0,
  session: null,      // 로그인된 이메일
  profile: null,      // { name, email }
  done: {},           // 사용자별
  completedOn: {},    // 사용자별 { day: "YYYY-MM-DD" }
  authMode: 'login',
};

const $ = (sel) => document.querySelector(sel);
const content = $('#content');
const screenEl = () => document.querySelector('.screen');

// ---------- 데이터 로드 ----------
async function load() {
  const [l, v] = await Promise.all([
    fetch('/content/lessons_en.json').then(r => r.json()),
    fetch('/content/vocabulary_en.json').then(r => r.json()),
  ]);
  state.lessons = l.lessons;
  state.vocab = v.vocab_days;
  state.allWords = state.vocab.flatMap(d => d.words);

  const sel = $('#daySelect');
  sel.innerHTML = state.lessons.map(les =>
    `<option value="${les.day}">Day ${les.day} · ${les.situation}</option>`
  ).join('');

  bindNav();
  start();
}

// ================= 인증(데모: 로컬) =================
const USERS_KEY = 'users';
function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; } }
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

function loadUserProgress(email) {
  state.done = JSON.parse(localStorage.getItem('done:' + email) || '{}');
  state.completedOn = JSON.parse(localStorage.getItem('completedOn:' + email) || '{}');
}
function setSession(email) {
  state.session = email;
  state.profile = getUsers()[email] || { name: email.split('@')[0], email };
  localStorage.setItem('session', email);
  loadUserProgress(email);
}
function clearSession() {
  state.session = null; state.profile = null;
  localStorage.removeItem('session');
  state.done = {}; state.completedOn = {};
}

function start() {
  const email = localStorage.getItem('session');
  const users = getUsers();
  if (email && users[email]) { setSession(email); enterApp(); }
  else renderAuth('login');
}
function enterApp() {
  screenEl().classList.remove('guest');
  state.day = 1; state.tab = 'today'; state.flashIndex = 0;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'today'));
  render();
}

function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function maskEmail(email) {
  const [id, domain] = email.split('@');
  const head = id.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(2, id.length - 2))}@${domain}`;
}

// 통계/관리자 분석용 선택지
const GENDERS = ['남성', '여성', '기타', '응답 안 함'];
const AGES = ['10대 이하', '10대', '20대', '30대', '40대', '50대', '60대 이상'];
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '해외'];
const GOALS = ['여행', '비즈니스·업무', '시험(토익 등)', '이민·유학', '취미·자기계발', '기타'];
const LEVELS = ['입문', '초급', '중급', '고급'];
const CHANNELS = ['검색', '지인 추천', 'SNS·유튜브', '앱스토어', '광고', '기타'];
function optionsHtml(list, sel, placeholder) {
  const ph = placeholder ? `<option value="" ${!sel ? 'selected' : ''} disabled>${placeholder}</option>` : '';
  return ph + list.map(o => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
}

const AUTH_LOGO = `
  <svg class="auth-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4.5h20a3.5 3.5 0 0 1 3.5 3.5v11A3.5 3.5 0 0 1 26 22.5H14.5l-6.2 5.2c-.7.6-1.8.1-1.8-.8V22.5H6A3.5 3.5 0 0 1 2.5 19V8A3.5 3.5 0 0 1 6 4.5Z" fill="#7c5cfc"/>
    <circle cx="16" cy="13.5" r="6" stroke="#fff" stroke-width="1.6"/>
    <path d="M10 13.5h12M16 7.5c2.2 2 2.2 10 0 12M16 7.5c-2.2 2-2.2 10 0 12" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

function renderAuth(mode = 'login') {
  state.authMode = mode;
  screenEl().classList.add('guest');
  if (mode === 'signup') return renderSignup();
  if (mode === 'find-id') return renderFindId();
  if (mode === 'reset-pw') return renderResetPw();
  return renderLogin();
}

function renderLogin(msg = '') {
  content.innerHTML = `
    <div class="auth">
      ${AUTH_LOGO}
      <h2>로그인</h2>
      <p class="subtle">이메일로 로그인하고 이어서 학습하세요.</p>
      <input id="auEmail" class="auth-input" type="email" placeholder="이메일" autocomplete="email" />
      <input id="auPw" class="auth-input" type="password" placeholder="비밀번호" autocomplete="current-password" />
      ${msg ? `<div class="auth-msg">${msg}</div>` : ''}
      <button class="btn primary" id="auSubmit">로그인</button>
      <div class="auth-links">
        <a id="toFindId">아이디(이메일) 찾기</a><span>·</span><a id="toReset">비밀번호 찾기</a>
      </div>
      <div class="auth-switch">계정이 없나요? <a id="toSignup">회원가입</a></div>
      <div class="auth-note">※ 데모: 계정·진행도는 이 브라우저에만 저장됩니다. 실제 앱은 <b>Supabase</b>로 안전하게 관리되며 구글 로그인은 추후 추가됩니다.</div>
    </div>`;
  $('#auSubmit').onclick = doLogin;
  content.querySelectorAll('.auth-input').forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
  $('#toSignup').onclick = () => renderAuth('signup');
  $('#toFindId').onclick = () => renderAuth('find-id');
  $('#toReset').onclick = () => renderAuth('reset-pw');
}

function renderSignup(msg = '', v = {}) {
  content.innerHTML = `
    <div class="auth">
      ${AUTH_LOGO}
      <h2>회원가입</h2>
      <p class="subtle">계정으로 진행 상황을 저장하고, 맞춤 학습을 받아보세요.</p>

      <div class="auth-group">계정 정보</div>
      <input id="suName" class="auth-input" placeholder="이름 (닉네임)" value="${v.name || ''}" />
      <input id="suEmail" class="auth-input" type="email" placeholder="이메일 (아이디)" value="${v.email || ''}" />
      <input id="suPw" class="auth-input" type="password" placeholder="비밀번호 (6자 이상)" />
      <input id="suPw2" class="auth-input" type="password" placeholder="비밀번호 확인" />

      <div class="auth-group">기본 정보 <span>· 통계·맞춤 학습용</span></div>
      <div class="auth-2col">
        <select id="suGender" class="auth-input">${optionsHtml(GENDERS, v.gender, '성별')}</select>
        <select id="suAge" class="auth-input">${optionsHtml(AGES, v.ageGroup, '나이대')}</select>
      </div>
      <select id="suRegion" class="auth-input">${optionsHtml(REGIONS, v.region, '지역 (선택)')}</select>

      <div class="auth-group">학습 정보</div>
      <div class="auth-2col">
        <select id="suGoal" class="auth-input">${optionsHtml(GOALS, v.goal, '학습 목표')}</select>
        <select id="suLevel" class="auth-input">${optionsHtml(LEVELS, v.level, '현재 레벨')}</select>
      </div>
      <select id="suChannel" class="auth-input">${optionsHtml(CHANNELS, v.channel, '유입 경로 (선택)')}</select>

      <label class="auth-check"><input type="checkbox" id="suTerms" ${v.terms ? 'checked' : ''}/> <span>(필수) 서비스 이용약관 및 개인정보 처리방침에 동의합니다.</span></label>
      <label class="auth-check"><input type="checkbox" id="suMkt" ${v.mkt ? 'checked' : ''}/> <span>(선택) 학습 알림·마케팅 정보 수신에 동의합니다.</span></label>

      ${msg ? `<div class="auth-msg">${msg}</div>` : ''}
      <button class="btn primary" id="suSubmit">가입하고 시작</button>
      <div class="auth-switch">이미 계정이 있나요? <a id="toLogin">로그인</a></div>
    </div>`;
  $('#suSubmit').onclick = doSignup;
  $('#toLogin').onclick = () => renderAuth('login');
}

function renderFindId(msg = '', results = null) {
  content.innerHTML = `
    <div class="auth">
      ${AUTH_LOGO}
      <h2>아이디(이메일) 찾기</h2>
      <p class="subtle">가입 시 입력한 이름(닉네임)으로 이메일을 찾습니다.</p>
      <input id="fiName" class="auth-input" placeholder="이름 (닉네임)" />
      ${msg ? `<div class="auth-msg">${msg}</div>` : ''}
      ${results ? `<div class="auth-result">${results}</div>` : ''}
      <button class="btn primary" id="fiSubmit">이메일 찾기</button>
      <div class="auth-switch"><a id="toLogin">로그인으로</a></div>
      <div class="auth-note">※ 데모: 실제 앱은 본인 인증(휴대폰/이메일) 후 안내합니다.</div>
    </div>`;
  $('#fiSubmit').onclick = doFindId;
  $('#toLogin').onclick = () => renderAuth('login');
}

function renderResetPw(msg = '') {
  content.innerHTML = `
    <div class="auth">
      ${AUTH_LOGO}
      <h2>비밀번호 찾기</h2>
      <p class="subtle">이메일과 이름으로 본인 확인 후 새 비밀번호를 설정합니다.</p>
      <input id="rpEmail" class="auth-input" type="email" placeholder="이메일" />
      <input id="rpName" class="auth-input" placeholder="이름 (닉네임) — 본인 확인" />
      <input id="rpPw" class="auth-input" type="password" placeholder="새 비밀번호 (6자 이상)" />
      <input id="rpPw2" class="auth-input" type="password" placeholder="새 비밀번호 확인" />
      ${msg ? `<div class="auth-msg">${msg}</div>` : ''}
      <button class="btn primary" id="rpSubmit">비밀번호 변경</button>
      <div class="auth-switch"><a id="toLogin">로그인으로</a></div>
      <div class="auth-note">※ 데모: 실제 앱은 가입 이메일로 재설정 링크를 보냅니다(Supabase).</div>
    </div>`;
  $('#rpSubmit').onclick = doResetPw;
  $('#toLogin').onclick = () => renderAuth('login');
}

function doLogin() {
  const email = $('#auEmail').value.trim().toLowerCase();
  const pw = $('#auPw').value;
  if (!validEmail(email)) return renderLogin('올바른 이메일을 입력하세요.');
  const users = getUsers();
  if (!users[email]) return renderLogin('가입되지 않은 이메일입니다. 회원가입을 해주세요.');
  if (users[email].pw !== pw) return renderLogin('비밀번호가 일치하지 않습니다.');
  setSession(email); enterApp();
}

function doSignup() {
  const v = {
    name: ($('#suName').value || '').trim(),
    email: $('#suEmail').value.trim().toLowerCase(),
    gender: $('#suGender').value,
    ageGroup: $('#suAge').value,
    region: $('#suRegion').value,
    goal: $('#suGoal').value,
    level: $('#suLevel').value,
    channel: $('#suChannel').value,
    terms: $('#suTerms').checked,
    mkt: $('#suMkt').checked,
  };
  const pw = $('#suPw').value, pw2 = $('#suPw2').value;
  if (!v.name) return renderSignup('이름(닉네임)을 입력하세요.', v);
  if (!validEmail(v.email)) return renderSignup('올바른 이메일을 입력하세요.', v);
  if (pw.length < 6) return renderSignup('비밀번호는 6자 이상이어야 합니다.', v);
  if (pw !== pw2) return renderSignup('비밀번호가 일치하지 않습니다.', v);
  if (!v.gender) return renderSignup('성별을 선택하세요.', v);
  if (!v.ageGroup) return renderSignup('나이대를 선택하세요.', v);
  if (!v.goal) return renderSignup('학습 목표를 선택하세요.', v);
  if (!v.level) return renderSignup('현재 레벨을 선택하세요.', v);
  if (!v.terms) return renderSignup('이용약관에 동의해야 가입할 수 있습니다.', v);
  const users = getUsers();
  if (users[v.email]) return renderSignup('이미 가입된 이메일입니다. 로그인해주세요.', v);
  users[v.email] = {            // ※ 데모용. 실제로는 비밀번호를 서버에서 해시 처리
    name: v.name, email: v.email, pw,
    gender: v.gender, ageGroup: v.ageGroup, region: v.region,
    goal: v.goal, level: v.level, channel: v.channel,
    mkt: v.mkt, createdAt: todayKey(),
  };
  saveUsers(users);
  setSession(v.email); enterApp();
}

function doFindId() {
  const name = ($('#fiName').value || '').trim();
  if (!name) return renderFindId('이름(닉네임)을 입력하세요.');
  const users = getUsers();
  const matches = Object.values(users).filter(u => u.name === name);
  if (matches.length === 0) return renderFindId('해당 이름으로 가입된 계정이 없습니다.');
  const list = matches.map(u => `<div class="auth-result-row">📧 ${maskEmail(u.email)}</div>`).join('');
  renderFindId('', `<b>"${name}"</b> 님의 가입 이메일:${list}`);
}

function doResetPw() {
  const email = $('#rpEmail').value.trim().toLowerCase();
  const name = ($('#rpName').value || '').trim();
  const pw = $('#rpPw').value, pw2 = $('#rpPw2').value;
  if (!validEmail(email)) return renderResetPw('올바른 이메일을 입력하세요.');
  const users = getUsers();
  if (!users[email]) return renderResetPw('가입되지 않은 이메일입니다.');
  if (users[email].name !== name) return renderResetPw('이름이 일치하지 않습니다. 본인 확인에 실패했습니다.');
  if (pw.length < 6) return renderResetPw('새 비밀번호는 6자 이상이어야 합니다.');
  if (pw !== pw2) return renderResetPw('새 비밀번호가 일치하지 않습니다.');
  users[email].pw = pw;
  saveUsers(users);
  alert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
  renderLogin();
}

// ---------- 완료/잠금 ----------
function isConvoDone(day) { return !!state.done['convo-' + day]; }
function isVocabDone(day) { return !!state.done['vocab-' + day]; }
function isDayComplete(day) { return isConvoDone(day) && isVocabDone(day); }
function isUnlocked(day) { return day === 1 || isConvoDone(day - 1); }

// ---------- 날짜 기준 연속(streak) ----------
function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayKey() { return dateKey(new Date()); }
function streakCount() {
  const set = new Set(Object.values(state.completedOn));
  if (set.size === 0) return 0;
  const cursor = new Date();
  if (!set.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
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

// ---------- 완료 처리(사용자별 저장) ----------
function persistDone(key) {
  state.done[key] = true;
  localStorage.setItem('done:' + state.session, JSON.stringify(state.done));
  if (isDayComplete(state.day) && !state.completedOn[state.day]) {
    state.completedOn[state.day] = todayKey();
    localStorage.setItem('completedOn:' + state.session, JSON.stringify(state.completedOn));
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
  if (!state.session) { renderAuth(state.authMode); return; }
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
      <span class="label">${state.profile.name}님 · Day ${les.day}</span>
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
  $('#playAll').onclick = () => speakSequence(les.dialog_turns.map(t => t.text));
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
      if (answered) return;
      answered = true;
      const isRight = btn.dataset.correct === 'true';
      btn.classList.add(isRight ? 'correct' : 'wrong');
      if (!isRight) content.querySelector('.opt[data-correct="true"]').classList.add('correct');
      content.querySelectorAll('.opt').forEach(b => b.disabled = true);
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
  persistDone('vocab-' + state.day);
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
  const completed = Object.keys(state.completedOn).length;
  content.innerHTML = `
    <div class="card">
      <span class="label">계정</span>
      <div class="account">
        <div class="avatar">${(state.profile.name || '?').slice(0, 1).toUpperCase()}</div>
        <div>
          <div style="font-weight:800;font-size:16px;">${state.profile.name}</div>
          <div class="subtle">${state.session}</div>
        </div>
      </div>
      <div class="setrow"><label>🔥 연속 학습</label><span class="subtle">${streakCount()}일</span></div>
      <div class="setrow"><label>✅ 완료한 Day</label><span class="subtle">${completed} / ${state.lessons.length}</span></div>
      <button class="btn ghost" id="logout">로그아웃</button>
    </div>
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
      <span class="label">내 진행 초기화</span>
      <div class="subtle" style="margin:6px 0;">이 계정의 완료 기록·연속 일수를 모두 지웁니다.</div>
      <button class="btn ghost" id="reset">진행 초기화</button>
    </div>
    <div class="card">
      <span class="label">정보</span>
      <div class="subtle">언어: 영어(en) · 콘텐츠 60일 / 단어 600개<br/>인증: Supabase(예정) · 구글 로그인 추후 · 확장 예정: 일본어 · 프랑스어</div>
    </div>
  `;
  const rate = $('#rate');
  rate.oninput = () => { state.rate = parseFloat(rate.value); $('#rateVal').textContent = state.rate.toFixed(1) + 'x'; };
  $('#testVoice').onclick = () => speakOne('Hello! How are you today?');
  $('#logout').onclick = () => { clearSession(); renderAuth('login'); };
  $('#reset').onclick = () => {
    if (!confirm('이 계정의 진행 기록을 모두 초기화할까요?')) return;
    state.done = {}; state.completedOn = {};
    localStorage.removeItem('done:' + state.session);
    localStorage.removeItem('completedOn:' + state.session);
    state.day = 1; switchTab('today');
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
