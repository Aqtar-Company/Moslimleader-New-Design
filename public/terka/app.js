/* app.js — إدارة الشاشات والأدوار وسحب البطاقات وربط الواجهة بمحرك المواريث */

let state = null; // حالة المباراة الحالية
let setupChoice = { count: 2, rounds: 8, difficulty: 'easy' };
let selection = { heirId: null, cardEl: null, mode: 'play' }; // mode: 'play' | 'substitute'

// ---------- أدوات عامة ----------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function showScreen(id) {
  $all('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

function shuffle(array) {
  // خوارزمية Fisher-Yates
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawFrom(deckArrName, discardArrName) {
  if (state[deckArrName].length === 0) {
    if (state[discardArrName].length === 0) return null;
    state[deckArrName] = shuffle(state[discardArrName]);
    state[discardArrName] = [];
  }
  return state[deckArrName].pop();
}

// ============================================================
// شاشة البداية
// ============================================================
function initStartScreen() {
  if (GameStorage.hasSavedGame()) {
    $('#btn-continue').classList.remove('hidden');
  }
  $('#btn-start-new').addEventListener('click', () => {
    AudioManager.playClick();
    showScreen('screen-setup');
  });
  $('#btn-continue').addEventListener('click', () => {
    const saved = GameStorage.load();
    if (saved) {
      state = saved;
      resumeSavedGame();
    }
  });
  $('#btn-how-to-play').addEventListener('click', () => { renderHowTo(); showScreen('screen-how-to'); });
  $('#btn-heir-guide').addEventListener('click', () => { renderHeirGuide(); showScreen('screen-heir-guide'); });
  $('#btn-solver').addEventListener('click', () => { AudioManager.playClick(); resetSolverScreen(); showScreen('screen-solver'); });
  $('#howto-back').addEventListener('click', () => showScreen('screen-start'));
  $('#heirguide-back').addEventListener('click', () => showScreen('screen-start'));
  $('#setup-back').addEventListener('click', () => showScreen('screen-start'));
  $('#solver-back').addEventListener('click', () => showScreen('screen-start'));
}

function renderHowTo() {
  const items = [
    ['الهدف', 'اجمع أكبر عدد من نقاط التركة عبر عدة جولات بلعب بطاقة الوارث المناسبة لكل حالة.'],
    ['بداية كل جولة', 'تُكشف بطاقة حالة المتوفى وبطاقة قيمة التركة، ثم يختار كل لاعب بسرّية بطاقة وارث من يده.'],
    ['الكشف والحساب', 'بعد اختيار الجميع، تُكشف البطاقات ويُحسب نصيب كل وارث حسب قواعد الفرائض المبسطة.'],
    ['الاستبدال', 'إن لم تناسبك بطاقاتك، استبدل بطاقة واحدة، لكنك تخسر مشاركتك في تلك الجولة.'],
    ['الفوز', 'يفوز صاحب أكبر مجموع نقاط بعد انتهاء كل الجولات.']
  ];
  $('#howto-list').innerHTML = items.map(([t, d]) => `<div class="guide-item"><h4>${t}</h4><p>${d}</p></div>`).join('');
}

function renderHeirGuide() {
  $('#heir-guide-list').innerHTML = HEIR_TYPES.map(h =>
    `<div class="guide-item"><h4>${h.icon} ${h.name}</h4><p>${h.description}</p></div>`
  ).join('');
}

// ============================================================
// احسب حالتك (الحلّال التفاعلي)
// ============================================================
const SOLVER_MULTI_HEIRS = ['son', 'daughter', 'brother', 'sister', 'wife'];
const SOLVER_MAX_COUNT = { wife: 4, son: 9, daughter: 9, brother: 9, sister: 9 };

let solverState = {
  gender: 'male',
  selections: { son: 0, daughter: 0, father: 0, mother: 0, husband: 0, wife: 0, brother: 0, sister: 0 }
};

function initSolverScreen() {
  $all('#solver-gender-group .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      solverState.gender = btn.dataset.gender;
      $all('#solver-gender-group .pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // الزوج يفترض متوفاة أنثى، والزوجة يفترض متوفى ذكر — تعطيل الاختيار المتناقض تلقائيًا
      if (solverState.gender === 'male') solverState.selections.husband = 0;
      if (solverState.gender === 'female') solverState.selections.wife = 0;
      renderSolverHeirList();
    });
  });
  $(`#solver-gender-group [data-gender="male"]`).classList.add('selected');
  renderSolverHeirList();
  $('#btn-solver-compute').addEventListener('click', computeSolverResult);
}

function resetSolverScreen() {
  solverState = {
    gender: 'male',
    selections: { son: 0, daughter: 0, father: 0, mother: 0, husband: 0, wife: 0, brother: 0, sister: 0 }
  };
  $all('#solver-gender-group .pill').forEach(b => b.classList.remove('selected'));
  $(`#solver-gender-group [data-gender="male"]`).classList.add('selected');
  $('#solver-estate').value = 24;
  $('#solver-results-card').classList.add('hidden');
  renderSolverHeirList();
}

function renderSolverHeirList() {
  const wrap = $('#solver-heir-list');
  wrap.innerHTML = '';

  HEIR_TYPES.forEach(h => {
    if (h.id === 'husband' && solverState.gender !== 'female') return;
    if (h.id === 'wife' && solverState.gender !== 'male') return;

    const isMulti = SOLVER_MULTI_HEIRS.includes(h.id);
    const count = solverState.selections[h.id] || 0;
    const row = document.createElement('div');
    row.className = 'solver-heir-row' + (count > 0 ? ' checked' : '');
    row.innerHTML = `
      <label class="solver-heir-label">
        <input type="checkbox" data-heir="${h.id}" ${count > 0 ? 'checked' : ''}>
        <span class="heir-icon">${h.icon}</span>
        <span class="heir-name">${h.name}</span>
      </label>
      ${isMulti && count > 0 ? `
      <div class="solver-stepper">
        <button type="button" class="step-minus" data-heir="${h.id}">−</button>
        <span class="count">${count}</span>
        <button type="button" class="step-plus" data-heir="${h.id}" ${count >= (SOLVER_MAX_COUNT[h.id] || 9) ? 'disabled' : ''}>+</button>
      </div>` : ''}
    `;
    wrap.appendChild(row);
  });

  $all('.solver-heir-label input[type="checkbox"]', wrap).forEach(cb => {
    cb.addEventListener('change', () => {
      solverState.selections[cb.dataset.heir] = cb.checked ? 1 : 0;
      AudioManager.playClick();
      renderSolverHeirList();
    });
  });
  $all('.step-minus', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.heir;
      if (solverState.selections[id] > 1) solverState.selections[id]--;
      renderSolverHeirList();
    });
  });
  $all('.step-plus', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.heir;
      const max = SOLVER_MAX_COUNT[id] || 9;
      if (solverState.selections[id] < max) solverState.selections[id]++;
      renderSolverHeirList();
    });
  });
}

function computeSolverResult() {
  const estateValue = parseInt($('#solver-estate').value, 10);
  if (!estateValue || estateValue <= 0) {
    alert('اكتب قيمة تركة صحيحة أكبر من صفر.');
    return;
  }
  const playedHeirIds = [];
  Object.entries(solverState.selections).forEach(([id, count]) => {
    for (let i = 0; i < count; i++) playedHeirIds.push(id);
  });
  if (playedHeirIds.length === 0) {
    alert('اختر وارثًا واحدًا على الأقل.');
    return;
  }
  AudioManager.playReveal();
  const result = computeInheritance({ deceasedGender: solverState.gender }, playedHeirIds, estateValue);
  renderSolverResult(result, playedHeirIds);
}

function renderSolverResult(result, playedHeirIds) {
  $('#solver-results-card').classList.remove('hidden');
  const uniqueIds = [...new Set(playedHeirIds)];
  const orderedIds = HEIR_TYPES.map(h => h.id).filter(id => uniqueIds.includes(id));

  $('#solver-result-body').innerHTML = orderedIds.map(id => {
    const heir = getHeirType(id);
    const info = result.perHeirType[id];
    const count = playedHeirIds.filter(x => x === id).length;
    const nameCell = `${heir.icon} ${heir.name}${count > 1 ? ' ×' + count : ''}`;
    if (!info) {
      return `<tr><td>${nameCell}</td><td>—</td><td>0</td><td><span class="status-tag invalid">لا يرث في هذه الحالة</span></td></tr>`;
    }
    let statusClass = 'inherits';
    if (info.status === 'محجوب') statusClass = 'blocked';
    else if (info.status === 'غير مناسب') statusClass = 'invalid';
    else if ((info.status || '').includes('مراجعة')) statusClass = 'review';
    const ratioText = info.fraction ? info.fraction.toString() : '—';
    return `<tr><td>${nameCell}</td><td>${ratioText}</td><td>${info.points ?? 0}</td><td><span class="status-tag ${statusClass}">${info.status}</span></td></tr>`;
  }).join('');

  const undistributedBox = $('#solver-undistributed');
  if (result.undistributedPoints > 0) {
    undistributedBox.classList.remove('hidden');
    undistributedBox.textContent = `⚠️ ${TEXTS.undistributedMessage} (${result.undistributedPoints} نقطة بلا وارث معروف)`;
  } else {
    undistributedBox.classList.add('hidden');
  }

  const reasonsWrap = $('#solver-reasons');
  reasonsWrap.innerHTML = orderedIds.map(id => {
    const heir = getHeirType(id);
    const info = result.perHeirType[id];
    if (!info) return '';
    const ref = HEIR_QURAN_REF[id];
    const ayah = ref ? QURAN_AYAT[ref.ayah] : null;
    return `
      <div class="solver-reason-item">
        <h4>${heir.icon} ${heir.name}</h4>
        <p>${info.reason || ''}</p>
        ${ayah ? `
        <div class="ayah-box">
          <div class="ayah-ref">سورة ${ayah.surah} — الآية ${ayah.ayah}</div>
          <div class="ayah-text">﴿ ${ayah.text} ﴾</div>
          ${ref.note ? `<div class="ayah-note">${ref.note}</div>` : ''}
        </div>` : ''}
      </div>`;
  }).join('');

  if (result.notes && result.notes.length) {
    reasonsWrap.innerHTML += `<div class="warning-box" style="margin-top:10px;">${result.notes.map(n => `⚠️ ${n}`).join('<br>')}</div>`;
  }

  $('#solver-results-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// شاشة الإعداد
// ============================================================
function initSetupScreen() {
  $all('#player-count-group .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      setupChoice.count = parseInt(btn.dataset.count, 10);
      $all('#player-count-group .pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderNameInputs();
    });
  });
  $all('#rounds-group .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      setupChoice.rounds = parseInt(btn.dataset.rounds, 10);
      $all('#rounds-group .pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  $all('#difficulty-group .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      setupChoice.difficulty = btn.dataset.diff;
      $all('#difficulty-group .pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  // إعداد افتراضي
  $(`#player-count-group [data-count="2"]`).classList.add('selected');
  $(`#rounds-group [data-rounds="8"]`).classList.add('selected');
  $(`#difficulty-group [data-diff="easy"]`).classList.add('selected');
  renderNameInputs();

  $('#btn-launch-match').addEventListener('click', () => {
    const names = $all('#name-inputs input').map((inp, i) => inp.value.trim() || `لاعب ${i + 1}`);
    startMatch(names, setupChoice.rounds, setupChoice.difficulty);
  });
}

function renderNameInputs() {
  const wrap = $('#name-inputs');
  const existing = $all('#name-inputs input').map(i => i.value);
  wrap.innerHTML = '';
  for (let i = 0; i < setupChoice.count; i++) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = `اسم اللاعب ${i + 1}`;
    inp.maxLength = 16;
    inp.value = existing[i] || '';
    wrap.appendChild(inp);
  }
}

// ============================================================
// بناء المباراة
// ============================================================
function buildHeirDeck() {
  let deck = [];
  HEIR_TYPES.forEach(h => { for (let i = 0; i < h.count; i++) deck.push(h.id); });
  return shuffle(deck);
}

function buildEstateDeck() {
  let deck = [];
  ESTATE_VALUES.forEach(e => { for (let i = 0; i < e.count; i++) deck.push(e.value); });
  return shuffle(deck);
}

function buildCaseDeck(difficulty) {
  let pool;
  if (difficulty === 'mixed') pool = DECEASED_CASES.filter(c => c.difficulty !== 'expert');
  else pool = DECEASED_CASES.filter(c => c.difficulty === difficulty);
  return shuffle(pool.map(c => c.id));
}

function buildJudgmentDeck() {
  return shuffle(JUDGMENT_CARDS.map(c => c.id));
}

function startMatch(names, rounds, difficulty) {
  const heirDeck = buildHeirDeck();
  const players = names.map(name => ({
    name, score: 0, roundsWon: 0, blockedCount: 0, hand: [], balance: 0
  }));
  // توزيع 4 بطاقات لكل لاعب
  players.forEach(p => { for (let i = 0; i < 4; i++) p.hand.push(heirDeck.pop()); });

  state = {
    players,
    totalRounds: rounds,
    difficulty,
    roundNum: 1,
    heirDeck, heirDiscard: [],
    caseDeck: buildCaseDeck(difficulty), caseDiscard: [],
    estateDeck: buildEstateDeck(), estateDiscard: [],
    judgmentDeck: buildJudgmentDeck(), judgmentDiscard: [],
    judgmentTurnIndex: 0,
    currentJudgmentCardId: null,
    judgmentRevealed: false,
    judgmentApplied: false,
    judgmentChosenPlayers: [],
    currentCaseId: null,
    currentEstateValue: null,
    turnIndex: 0,
    roundPlays: {}, // playerIndex -> heirId | 'substituted'
    substitutedThisRound: {},
    muted: false,
    phase: 'setup' // setup | acting | reveal | result | judgment | end
  };
  AudioManager.playClick();
  beginRound();
}

function resumeSavedGame() {
  AudioManager.setMuted(!!state.muted);
  updateMuteIcon();
  if (state.phase === 'result') {
    showRoundResult(state.lastRoundResult);
  } else if (state.phase === 'judgment') {
    showScreen('screen-judgment');
    renderJudgmentScreen();
  } else if (state.phase === 'end') {
    showEndScreen();
  } else {
    // نعيد بدء الجولة الحالية بأمان (تجنبًا لتعقيد استرجاع منتصف الدور).
    // أي لاعب كان قد لعب بطاقته بالفعل قبل الخروج تكون قد خرجت من يده دون أن
    // تدخل كومة الاستخدام (ذلك يحدث فقط عند حساب نتيجة الجولة) — نعوّض يده
    // حتى تكتمل لأربع بطاقات قبل إعادة بدء الجولة من أولها.
    state.players.forEach(p => {
      while (p.hand.length < 4) {
        const card = drawFrom('heirDeck', 'heirDiscard');
        if (!card) break;
        p.hand.push(card);
      }
    });
    state.turnIndex = 0;
    state.roundPlays = {};
    state.substitutedThisRound = {};
    renderPlayScreenShell();
    beginTurnFlow();
  }
}

function beginRound() {
  state.phase = 'acting';
  state.turnIndex = 0;
  state.roundPlays = {};
  state.substitutedThisRound = {};

  const caseId = drawFrom('caseDeck', 'caseDiscard');
  state.currentCaseId = caseId;
  state.currentEstateValue = drawFrom('estateDeck', 'estateDiscard');

  saveGame();
  renderPlayScreenShell();
  beginTurnFlow();
}

function saveGame() {
  GameStorage.save(state);
}

// ============================================================
// شاشة اللعب — الهيكل الثابت
// ============================================================
function renderPlayScreenShell() {
  showScreen('screen-play');
  $('#info-round-num').textContent = state.roundNum;
  $('#info-round-total').textContent = state.totalRounds;
  const diffBadge = $('#info-diff-badge');
  const caseObj = DECEASED_CASES.find(c => c.id === state.currentCaseId);
  const diffKey = caseObj.difficulty;
  diffBadge.textContent = TEXTS.difficultyNames[diffKey];
  diffBadge.className = 'diff-badge ' + diffKey;

  renderPlayersRow();

  // بطاقة الحالة (مقلوبة أولًا ثم تُكشف)
  $('#status-card-slot').innerHTML = `
    <div class="card status-card gender-${caseObj.deceasedGender} card-flip">
      <div class="card-icon">${caseObj.deceasedGender === 'male' ? '🕌' : '🕋'}</div>
      <div class="card-name">${caseObj.title}</div>
      <div class="card-sub">${caseObj.note}</div>
    </div>`;

  $('#estate-card-slot').innerHTML = `
    <div class="card estate-card ${estateTierClass(state.currentEstateValue)} card-flip">
      <div class="card-icon">📦</div>
      <div class="card-value">${state.currentEstateValue}</div>
      <div class="card-sub">وزّع التركة بالعدل</div>
    </div>`;

  $('#revealed-heirs').innerHTML = '';
  $('#round-lesson-box').innerHTML = '';
  AudioManager.playReveal();
}

function estateTierClass(value) {
  if (value >= 48) return 'tier-4';
  if (value >= 36) return 'tier-3';
  if (value >= 24) return 'tier-2';
  return 'tier-1';
}

function renderPlayersRow() {
  const row = $('#players-row');
  row.innerHTML = state.players.map((p, i) => {
    const activeCls = (i === state.turnIndex && state.phase === 'acting') ? 'active-turn' : '';
    let stateText = 'ينتظر';
    if (state.roundPlays[i] === 'substituted') stateText = 'استبدل';
    else if (state.roundPlays[i] !== undefined) stateText = 'جاهز';
    else if (i === state.turnIndex && state.phase === 'acting') stateText = 'يختار';
    return `<div class="player-chip ${activeCls}">
      <span class="p-name">${p.name}</span>
      <span class="p-score">${p.score} نقطة</span>
      <span class="p-balance">💰 ${p.balance}</span>
      <span class="p-state">${stateText}</span>
    </div>`;
  }).join('');
}

// ============================================================
// تدفّق الأدوار (تمرير الجهاز)
// ============================================================
function beginTurnFlow() {
  if (state.turnIndex >= state.players.length) {
    revealRoundAndCompute();
    return;
  }
  renderPlayersRow();
  const player = state.players[state.turnIndex];
  $('#pass-overlay-text').textContent = TEXTS.passDeviceMessage;
  $('#pass-player-name').textContent = player.name;
  $('#hand-area').classList.add('hidden');
  $('#pass-overlay').classList.remove('hidden');
}

function initPassOverlay() {
  $('#btn-im-ready').addEventListener('click', () => {
    $('#pass-overlay').classList.add('hidden');
    $('#hand-area').classList.remove('hidden');
    renderHandForCurrentPlayer();
  });
}

function renderHandForCurrentPlayer() {
  selection = { heirId: null, cardEl: null, mode: 'play' };
  $('#btn-confirm-choice').disabled = true;
  $('#btn-substitute').disabled = !!state.substitutedThisRound[state.turnIndex];

  const player = state.players[state.turnIndex];
  const caseObj = DECEASED_CASES.find(c => c.id === state.currentCaseId);
  const wrap = $('#hand-cards');
  wrap.innerHTML = '';

  player.hand.forEach((heirId, idx) => {
    const heir = getHeirType(heirId);
    const disallowed = caseObj.disallowed.includes(heirId);
    const cardEl = document.createElement('div');
    cardEl.className = 'card small selectable' + (disallowed ? ' disallowed' : '');
    cardEl.innerHTML = `
      <button class="info-btn" title="معلومات">؟</button>
      <div class="card-icon">${heir.icon}</div>
      <div class="card-name">${heir.name}</div>`;
    cardEl.querySelector('.info-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      alert(`${heir.name}: ${heir.description}`);
    });
    cardEl.addEventListener('click', () => {
      if (selection.mode !== 'substitute' && disallowed) {
        AudioManager.playError();
        flashMessage('لا يمكن اختيار هذه البطاقة في هذه الحالة.');
        return;
      }
      $all('.card', wrap).forEach(c => c.classList.remove('selected'));
      cardEl.classList.add('selected');
      selection.heirId = heirId;
      selection.handIndex = idx;
      selection.cardEl = cardEl;
      $('#btn-confirm-choice').disabled = false;
      AudioManager.playClick();
    });
    wrap.appendChild(cardEl);
  });
}

function flashMessage(text) {
  const box = $('#round-lesson-box');
  box.innerHTML = `<div class="warning-box">${text}</div>`;
  setTimeout(() => { if (state.phase === 'acting') box.innerHTML = ''; }, 2200);
}

function initHandActions() {
  $('#btn-confirm-choice').addEventListener('click', () => {
    if (selection.mode === 'substitute') {
      doSubstitute();
    } else {
      doConfirmPlay();
    }
  });
  $('#btn-substitute').addEventListener('click', () => {
    if (state.substitutedThisRound[state.turnIndex]) return;
    selection.mode = 'substitute';
    selection.heirId = null;
    $all('#hand-cards .card').forEach(c => c.classList.remove('selected'));
    $('#btn-confirm-choice').disabled = true;
    flashMessage('اختر بطاقة من يدك لاستبدالها.');
    // إعادة ربط اختيار البطاقات لوضع الاستبدال
    $all('#hand-cards .card').forEach((cardEl, idx) => {
      cardEl.classList.remove('disallowed');
      cardEl.onclick = () => {
        $all('#hand-cards .card').forEach(c => c.classList.remove('selected'));
        cardEl.classList.add('selected');
        selection.handIndex = idx;
        selection.cardEl = cardEl;
        $('#btn-confirm-choice').disabled = false;
      };
    });
  });
}

function doConfirmPlay() {
  const playerIndex = state.turnIndex;
  const player = state.players[playerIndex];
  state.roundPlays[playerIndex] = selection.heirId;
  player.hand.splice(selection.handIndex, 1); // البطاقة تُلعب وتخرج من اليد مؤقتًا (ستُضاف لكومة الاستخدام لاحقًا)
  AudioManager.playDraw();
  advanceTurn();
}

function doSubstitute() {
  const playerIndex = state.turnIndex;
  const player = state.players[playerIndex];
  const discardedId = player.hand[selection.handIndex];
  player.hand.splice(selection.handIndex, 1);
  state.heirDiscard.push(discardedId);
  const newCard = drawFrom('heirDeck', 'heirDiscard');
  if (newCard) player.hand.push(newCard);
  state.substitutedThisRound[playerIndex] = true;
  state.roundPlays[playerIndex] = 'substituted';
  flashMessage(TEXTS.substituteMessage);
  AudioManager.playDraw();
  advanceTurn();
}

function advanceTurn() {
  state.turnIndex += 1;
  saveGame();
  setTimeout(() => beginTurnFlow(), 350);
}

// ============================================================
// الكشف والحساب
// ============================================================
function revealRoundAndCompute() {
  state.phase = 'reveal';
  renderPlayersRow();
  const caseObj = DECEASED_CASES.find(c => c.id === state.currentCaseId);
  const playedHeirIds = [];
  const revealWrap = $('#revealed-heirs');
  revealWrap.innerHTML = '';

  state.players.forEach((p, i) => {
    const play = state.roundPlays[i];
    if (play && play !== 'substituted') {
      playedHeirIds.push(play);
      const heir = getHeirType(play);
      const el = document.createElement('div');
      el.className = 'card small card-flip';
      el.innerHTML = `<div class="card-icon">${heir.icon}</div><div class="card-name">${heir.name}</div><div class="card-sub">${p.name}</div>`;
      revealWrap.appendChild(el);
    }
  });
  AudioManager.playReveal();

  const engineResult = computeInheritance(caseObj, playedHeirIds, state.currentEstateValue);

  setTimeout(() => finalizeRoundScoring(caseObj, engineResult), 700);
}

function finalizeRoundScoring(caseObj, engineResult) {
  // توزيع النقاط على اللاعبين حسب البطاقة التي لعبوها
  const perPlayerRows = [];
  const heirPlayCounts = {}; // لتقسيم النقاط بالتساوي عند تكرار نفس الوارث (مثل تعدد الزوجات)
  Object.values(state.roundPlays).forEach(v => {
    if (v && v !== 'substituted') heirPlayCounts[v] = (heirPlayCounts[v] || 0) + 1;
  });

  state.players.forEach((p, i) => {
    const play = state.roundPlays[i];
    if (!play || play === 'substituted') {
      perPlayerRows.push({ player: p.name, card: play === 'substituted' ? 'استبدال' : '—', status: 'invalid', statusText: play === 'substituted' ? 'استبدل ولم يشارك' : 'لم يشارك', ratio: '—', points: 0 });
      return;
    }
    const heirInfo = engineResult.perHeirType[play];
    const heir = getHeirType(play);
    if (!heirInfo) {
      perPlayerRows.push({ player: p.name, card: heir.name, status: 'invalid', statusText: 'غير مناسب', ratio: '—', points: 0 });
      return;
    }
    let statusClass = 'inherits', statusText = 'يرث';
    if (heirInfo.status === 'محجوب') { statusClass = 'blocked'; statusText = heirInfo.reason; p.blockedCount++; }
    else if (heirInfo.status === 'غير مناسب') { statusClass = 'invalid'; statusText = heirInfo.reason; }
    else if ((heirInfo.status || '').includes('مراجعة')) { statusClass = 'review'; statusText = heirInfo.reason; }
    else statusText = heirInfo.reason || 'يرث';

    const totalCardHolders = heirPlayCounts[play] || 1;
    const points = totalCardHolders > 1 ? Math.floor((heirInfo.points || 0) / totalCardHolders) : (heirInfo.points || 0);
    const ratioText = heirInfo.fraction ? heirInfo.fraction.toString() : '—';

    p.score += points;
    perPlayerRows.push({ player: p.name, card: heir.name, status: statusClass, statusText, ratio: ratioText, points });
  });

  // إعادة البطاقات الملعوبة إلى كومة الاستخدام وسحب بطاقات جديدة لإعادة اليد إلى 4
  Object.entries(state.roundPlays).forEach(([i, play]) => {
    if (play && play !== 'substituted') {
      state.heirDiscard.push(play);
      const p = state.players[i];
      const newCard = drawFrom('heirDeck', 'heirDiscard');
      if (newCard) p.hand.push(newCard);
    }
  });
  state.caseDiscard.push(state.currentCaseId);
  state.estateDiscard.push(state.currentEstateValue);

  // تحديد الفائز/الفائزين بالجولة (لأعلى نقاط في هذه الجولة تحديدًا)
  const maxRoundPoints = Math.max(...perPlayerRows.map(r => r.points));
  if (maxRoundPoints > 0) {
    perPlayerRows.forEach((r, i) => { if (r.points === maxRoundPoints) state.players[i].roundsWon++; });
  }

  AudioManager.playPoints();

  const resultPayload = { caseObj, rows: perPlayerRows, engineResult };
  state.lastRoundResult = resultPayload;
  state.phase = 'result';
  saveGame();
  showRoundResult(resultPayload);
}

// ============================================================
// شاشة نتيجة الجولة
// ============================================================
function showRoundResult(payload) {
  showScreen('screen-round-result');
  const { caseObj, rows, engineResult } = payload;
  $('#result-table-body').innerHTML = rows.map(r => `
    <tr>
      <td>${r.player}</td>
      <td>${r.card}</td>
      <td><span class="status-tag ${r.status}">${r.statusText}</span></td>
      <td>${r.ratio}</td>
      <td>${r.points}</td>
    </tr>`).join('');

  const undistributedBox = $('#result-undistributed');
  if (engineResult.undistributedPoints > 0) {
    undistributedBox.classList.remove('hidden');
    undistributedBox.textContent = `⚠️ ${TEXTS.undistributedMessage} (${engineResult.undistributedPoints} نقطة بلا وارث معروف في هذه اللعبة)`;
  } else {
    undistributedBox.classList.add('hidden');
  }

  let lessonHtml = `<b>💡 </b>${caseObj.lesson}`;
  if (engineResult.notes && engineResult.notes.length) {
    lessonHtml += '<br>' + engineResult.notes.map(n => `⚠️ ${n}`).join('<br>');
  }
  $('#result-lesson').innerHTML = lessonHtml;

  const sorted = state.players.slice().sort((a, b) => b.score - a.score);
  $('#result-totals').innerHTML = sorted.map(p => `<li><span>${p.name}</span><span>${p.score} نقطة</span></li>`).join('');
}

function initRoundResultScreen() {
  $('#btn-next-round').addEventListener('click', () => {
    beginJudgmentStep();
  });
}

function proceedAfterJudgment() {
  state.judgmentTurnIndex = (state.judgmentTurnIndex + 1) % state.players.length;
  if (state.roundNum >= state.totalRounds) {
    state.phase = 'end';
    saveGame();
    showEndScreen();
  } else {
    state.roundNum++;
    beginRound();
  }
}

// ============================================================
// بطاقات الأحكام (تُكشف بالتناوب بعد كل جولة توزيع ميراث)
// ============================================================
const AQILAH_HEIRS = ['son', 'father', 'brother'];

function getAqilahPlayerIndexes() {
  const idxs = [];
  Object.entries(state.roundPlays).forEach(([i, play]) => {
    if (AQILAH_HEIRS.includes(play)) idxs.push(parseInt(i, 10));
  });
  return idxs;
}

function beginJudgmentStep() {
  state.phase = 'judgment';
  state.currentJudgmentCardId = drawFrom('judgmentDeck', 'judgmentDiscard');
  state.judgmentRevealed = false;
  state.judgmentApplied = false;
  state.judgmentChosenPlayers = [];
  saveGame();
  showScreen('screen-judgment');
  renderJudgmentScreen();
}

function renderJudgmentScreen() {
  const player = state.players[state.judgmentTurnIndex];
  $('#judgment-turn-label').textContent = `${TEXTS.judgmentTurnLabel} ${player.name}`;
  $('#judgment-intro').textContent = TEXTS.judgmentIntro;

  const card = JUDGMENT_CARDS.find(c => c.id === state.currentJudgmentCardId);
  const cardEl = $('#judgment-card');

  if (!state.judgmentRevealed) {
    cardEl.className = 'judgment-card';
    cardEl.innerHTML = `
      <div class="judgment-card-back">
        <div class="judgment-card-back-icon">🃏</div>
        <div class="judgment-card-back-label">بطاقة حكم</div>
      </div>`;
  } else {
    cardEl.className = 'judgment-card revealed card-flip';
    cardEl.innerHTML = `
      <div class="judgment-card-front">
        <div class="judgment-card-title">${card.title}</div>
        <div class="judgment-card-story">${card.story}</div>
        <div class="judgment-card-fact">💡 هل تعلم؟ ${card.didYouKnow}</div>
        <div class="judgment-card-ruling">⚖️ ${card.ruling}</div>
      </div>`;
  }

  renderJudgmentControls(card);
  if (state.judgmentApplied) {
    renderJudgmentSummary(card, state.lastJudgmentDeltas || []);
  } else {
    $('#judgment-summary').innerHTML = '';
  }
}

function renderJudgmentControls(card) {
  const wrap = $('#judgment-controls');
  wrap.innerHTML = '';

  if (!state.judgmentRevealed) {
    wrap.innerHTML = `<button class="btn btn-primary btn-block" id="btn-judgment-reveal">${TEXTS.judgmentRevealButton}</button>`;
    $('#btn-judgment-reveal').addEventListener('click', () => {
      state.judgmentRevealed = true;
      AudioManager.playReveal();
      saveGame();
      renderJudgmentScreen();
    });
    return;
  }

  if (state.judgmentApplied) {
    wrap.innerHTML = `<button class="btn btn-primary btn-block" id="btn-judgment-continue">${TEXTS.judgmentContinueButton}</button>`;
    $('#btn-judgment-continue').addEventListener('click', proceedAfterJudgment);
    return;
  }

  const needsChoice = card.effect.target === 'chosenPlayer' || card.effect.target === 'chosenPlayers2';
  if (needsChoice) {
    const neededCount = card.effect.target === 'chosenPlayers2' ? 2 : 1;
    const candidates = state.players.map((p, i) => i).filter(i => i !== state.judgmentTurnIndex);
    const label = neededCount === 2 ? TEXTS.judgmentChooseTwoPlayers : TEXTS.judgmentChoosePlayer;
    wrap.innerHTML = `
      <div class="section-title">${label}</div>
      <div class="judgment-player-pick pill-group">
        ${candidates.map(i => `<button type="button" class="pill judgment-pick-btn ${state.judgmentChosenPlayers.includes(i) ? 'selected' : ''}" data-idx="${i}">${state.players[i].name}</button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="btn-judgment-apply" style="margin-top:12px;" ${state.judgmentChosenPlayers.length === neededCount ? '' : 'disabled'}>${TEXTS.judgmentApplyButton}</button>
    `;
    $all('.judgment-pick-btn', wrap).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const pos = state.judgmentChosenPlayers.indexOf(idx);
        if (pos >= 0) {
          state.judgmentChosenPlayers.splice(pos, 1);
        } else if (state.judgmentChosenPlayers.length < neededCount) {
          state.judgmentChosenPlayers.push(idx);
        }
        renderJudgmentControls(card);
      });
    });
    $('#btn-judgment-apply').addEventListener('click', () => applyCurrentJudgment(card));
  } else {
    wrap.innerHTML = `<button class="btn btn-primary btn-block" id="btn-judgment-apply">${TEXTS.judgmentApplyButton}</button>`;
    $('#btn-judgment-apply').addEventListener('click', () => applyCurrentJudgment(card));
  }
}

function resolveJudgmentTargets(card, revealerIndex, chosenPlayers) {
  const eff = card.effect;
  const n = state.players.length;
  const deltas = state.players.map(() => 0);
  const rows = (state.lastRoundResult && state.lastRoundResult.rows) || [];

  const addAll = (idxs, amount) => idxs.forEach(i => { deltas[i] += amount; });

  switch (eff.target) {
    case 'self':
      deltas[revealerIndex] += eff.amount;
      break;
    case 'allPlayers':
      addAll(state.players.map((_, i) => i), eff.amount);
      break;
    case 'allExceptSelf':
      addAll(state.players.map((_, i) => i).filter(i => i !== revealerIndex), eff.amount);
      break;
    case 'heirsThisRound': {
      const heirIdxs = rows.map((r, i) => ({ i, points: r.points })).filter(r => r.points > 0).map(r => r.i);
      addAll(heirIdxs, eff.amount);
      break;
    }
    case 'aqilah':
      addAll(getAqilahPlayerIndexes(), eff.amount);
      break;
    case 'largestAqilahShare': {
      const aqilahIdxs = getAqilahPlayerIndexes();
      if (aqilahIdxs.length) {
        let best = aqilahIdxs[0];
        aqilahIdxs.forEach(i => { if ((rows[i] ? rows[i].points : 0) > (rows[best] ? rows[best].points : 0)) best = i; });
        deltas[best] += eff.amount;
      }
      break;
    }
    case 'lowestBalance': {
      let idx = 0;
      state.players.forEach((p, i) => { if (p.balance < state.players[idx].balance) idx = i; });
      deltas[idx] += eff.amount;
      break;
    }
    case 'highestBalance': {
      let idx = 0;
      state.players.forEach((p, i) => { if (p.balance > state.players[idx].balance) idx = i; });
      deltas[idx] += eff.amount;
      break;
    }
    case 'largestShareThisRound': {
      if (rows.length) {
        let idx = 0;
        rows.forEach((r, i) => { if (r.points > rows[idx].points) idx = i; });
        deltas[idx] += eff.amount;
      }
      break;
    }
    case 'smallestShareThisRound': {
      if (rows.length) {
        let idx = 0;
        rows.forEach((r, i) => { if (r.points < rows[idx].points) idx = i; });
        deltas[idx] += eff.amount;
      }
      break;
    }
    case 'rightNeighbor': {
      const idx = (revealerIndex + 1) % n;
      deltas[idx] += eff.amount;
      deltas[revealerIndex] += (eff.selfAmount || 0);
      break;
    }
    case 'leftNeighbor': {
      const idx = (revealerIndex - 1 + n) % n;
      deltas[idx] += eff.amount;
      deltas[revealerIndex] += (eff.selfAmount || 0);
      break;
    }
    case 'allOthersPayToSelf': {
      const others = state.players.map((_, i) => i).filter(i => i !== revealerIndex);
      addAll(others, eff.amount);
      deltas[revealerIndex] += -eff.amount * others.length;
      break;
    }
    case 'firstToNotice':
      deltas[revealerIndex] += eff.amount;
      break;
    case 'chosenPlayer':
      (chosenPlayers || []).forEach(idx => { deltas[idx] += eff.amount; });
      deltas[revealerIndex] += (eff.selfAmount || 0);
      break;
    case 'chosenPlayers2':
      (chosenPlayers || []).forEach(idx => { deltas[idx] += eff.amount; });
      break;
    case 'none':
    default:
      break;
  }
  return deltas;
}

function applyCurrentJudgment(card) {
  const deltas = resolveJudgmentTargets(card, state.judgmentTurnIndex, state.judgmentChosenPlayers);
  deltas.forEach((d, i) => { state.players[i].balance += d; });
  state.judgmentApplied = true;
  state.lastJudgmentDeltas = deltas;
  AudioManager.playPoints();
  saveGame();
  renderJudgmentScreen();
}

function renderJudgmentSummary(card, deltas) {
  const lines = deltas
    .map((d, i) => (d !== 0 ? `${state.players[i].name}: ${d > 0 ? '+' : ''}${d} سهم` : null))
    .filter(Boolean);
  $('#judgment-summary').innerHTML = lines.length
    ? `<div class="lesson-box">${lines.join('<br>')}</div>`
    : `<div class="lesson-box">لا يوجد أثر رقمي لهذه البطاقة (إعفاء/معلومة فقط).</div>`;
}

// ============================================================
// شاشة نهاية المباراة
// ============================================================
function showEndScreen() {
  showScreen('screen-end');
  const maxScore = Math.max(...state.players.map(p => p.score));
  const winners = state.players.filter(p => p.score === maxScore);
  AudioManager.playWin();

  $('#winner-name').textContent = winners.length > 1
    ? 'تعادل بين: ' + winners.map(w => w.name).join(' و ')
    : winners[0].name;
  $('#winner-score').textContent = `${maxScore} نقطة`;

  const sorted = state.players.slice().sort((a, b) => b.score - a.score);
  $('#final-rank-list').innerHTML = sorted.map((p, i) => `
    <li class="${i === 0 ? 'first' : ''}">
      <span>${i + 1}. ${p.name}</span>
      <span>${p.score} نقطة · فاز بـ${p.roundsWon} جولة · حُجب ${p.blockedCount} مرة</span>
    </li>`).join('');

  GameStorage.clear();
}

function initEndScreen() {
  $('#btn-new-match').addEventListener('click', () => {
    state = null;
    showScreen('screen-setup');
  });
  $('#btn-replay-names').addEventListener('click', () => {
    const names = state.players.map(p => p.name);
    startMatch(names, setupChoice.rounds, setupChoice.difficulty);
  });
}

// ============================================================
// أزرار شريط اللعب العلوي
// ============================================================
function updateMuteIcon() {
  $('#btn-mute').textContent = AudioManager.isMuted() ? '🔇' : '🔊';
}

function initTopBarActions() {
  $('#btn-mute').addEventListener('click', () => {
    AudioManager.setMuted(!AudioManager.isMuted());
    state.muted = AudioManager.isMuted();
    updateMuteIcon();
    saveGame();
  });
  $('#btn-restart').addEventListener('click', () => {
    if (confirm('هل تريد إعادة المباراة من البداية بنفس الأسماء؟')) {
      const names = state.players.map(p => p.name);
      const rounds = state.totalRounds, diff = state.difficulty;
      startMatch(names, rounds, diff);
    }
  });
  $('#btn-exit').addEventListener('click', () => {
    if (confirm('هل تريد العودة للقائمة الرئيسية؟ سيتم حفظ تقدّمك تلقائيًا.')) {
      saveGame();
      showScreen('screen-start');
    }
  });
}

// ============================================================
// التشغيل
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initStartScreen();
  initSetupScreen();
  initPassOverlay();
  initHandActions();
  initRoundResultScreen();
  initEndScreen();
  initTopBarActions();
  initSolverScreen();
});
