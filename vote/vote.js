/* 현장투표 앱 — 주주총회장에서 주주가 직접 의결권을 행사한다.
 *
 *  의안은 CONEXUS 와 같은 정본(cx-data.js)을 쓰고, 진행 상태는 현장 제어가
 *  localStorage 'cx.live' 로 내보내는 신호를 그대로 구독한다.
 *    { ag:'제1호', stage:0~4, sec:남은 초, done:{의안:결과} }   stage 2=표결 중 · 3=집계 · 4=결과
 */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cm(n) { return (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR'); }

  /* ── 주주 · 출입증 ──────────────────────────── */
  var ME = { nm: '윤대일', no: '8100461' };
  var M = (window.CX && CX.meeting) || {};
  var CARDS = [
    { key: 'kudos', co: M.org || '큐더스전자', term: M.name || '제10기 정기주주총회',
      sh: 41847, seat: 'A129', asof: '2026년 9월 14일 기준', live: true,
      g: ['#3D5AFE', '#7A4DFF', '#2E9BFF', '#63C2FF'] },
    { key: 'naver', co: '네이버', term: '제27기 정기주주총회',
      sh: 20000, seat: 'B061', asof: '2026년 9월 14일 기준', live: false,
      g: ['#0FA968', '#12B76A', '#37C7A0', '#7BE3B4'] },
    { key: 'kakaobank', co: '카카오뱅크', term: '제10기 정기주주총회',
      sh: 1200, seat: 'C412', asof: '2026년 9월 14일 기준', live: false,
      g: ['#FF9E1B', '#FF7A3D', '#FFC24D', '#FFD97A'] }
  ];
  var CUR = null, CURAG = null;

  /* 의안 — CONEXUS 목록 그대로 (상위 묶음 + 하위 항목) */
  function agenda() {
    var A = (window.CX && CX.agenda) || [];
    return A.length ? A : [{ no: '제1호', nm: '재무제표 승인의 건', types: ['보통결의'] }];
  }
  /* 실제로 표를 던지는 단위 — 하위가 있으면 하위, 없으면 자기 자신 */
  function units() {
    var out = [];
    agenda().forEach(function (a) {
      if (a.header) return;
      out.push(a);
    });
    return out;
  }
  function detail(no) { return ((window.CX && CX.center) || {})[no] || {}; }
  function kindOf(no) {
    var d = detail(no);
    if (d.type === '집중투표') return 'cum';
    if (d.type === '양립불가') return 'excl';
    return 'plain';
  }

  /* ── 내가 던진 표 — cx.onsite ───────────────── */
  var VKEY = 'cx.onsite';
  function votes() { try { return JSON.parse(localStorage.getItem(VKEY) || '{}'); } catch (e) { return {}; } }
  function myVote(no) { var v = votes()[no]; return v || null; }
  function saveVote(no, data) {
    var v = votes();
    v[no] = Object.assign({ sh: CUR.sh, nm: ME.nm, co: CUR.co, at: Date.now() }, data);
    v._sum = {};
    Object.keys(v).forEach(function (k) {
      if (k.charAt(0) === '_' || !v[k].pick) return;
      var s = (v._sum[k] = v._sum[k] || { 찬성: 0, 반대: 0, 기권: 0 });
      s[v[k].pick] += v[k].sh;
    });
    try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('cx-onsite', { detail: v })); } catch (e) {}
  }

  /* ── 토스트 · 화면 전환 ─────────────────────── */
  var tT = null;
  function toast(t) {
    var el = $('#toastT'); el.textContent = t; el.classList.add('on');
    clearTimeout(tT); tT = setTimeout(function () { el.classList.remove('on'); }, 2400);
  }
  var TABS = { site: null, hist: '#scrHist', set: '#scrSet' };
  function show(sel, tab) {
    $$('.scr').forEach(function (s) { s.classList.toggle('on', '#' + s.id === sel); });
    $('#tabbar').hidden = !tab;
    if (tab) $$('#tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
  }
  $$('#tabbar button').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.tab;
      if (k === 'site') { tagged ? drawCards() : show('#scrNfc', 'site'); }
      else if (k === 'hist') { drawHist(); show('#scrHist', 'hist'); }
      else { drawSet(); show('#scrSet', 'set'); }
    });
  });
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  /* ══ 1. NFC 태깅 ═════════════════════════════ */
  var tagged = false;
  show('#scrNfc', 'site');
  $('#nfcGo').addEventListener('click', doTag);
  function doTag() {
    if (tagged) return;
    tagged = true; buzz([30, 60, 30]);
    if (!PIN.set) { openPin('new'); return; }     /* 첫 태깅이면 비밀번호부터 */
    drawCards();
  }
  (function () {
    if (!('NDEFReader' in window)) return;
    try { var r = new window.NDEFReader(); r.scan().then(function () { r.onreading = doTag; }).catch(function () {}); } catch (e) {}
  })();
  if (/[?&]nfc=1/.test(location.search)) setTimeout(doTag, 200);

  /* ══ 2. 출입증 카드 ══════════════════════════ */
  function drawCards() {
    $('#deck').innerHTML = CARDS.map(function (c) {
      return '<div class="pcard' + (c.live ? '' : ' off') + '" role="button" tabindex="0" data-card="' + c.key + '"'
        + ' style="--c0:' + c.g[0] + ';--c1:' + c.g[1] + ';--c2:' + c.g[2] + ';--c3:' + c.g[3] + '">'
        + '<i class="ph-fill ph-cell-signal-full nfcic"></i>'
        + '<div class="nm">' + esc(ME.nm) + '</div>'
        + '<div class="mid"><div class="co">' + esc(c.co) + '</div>'
        + '<div class="term">' + esc(c.term) + '</div>'
        + '<div class="hr"></div>'
        + '<div class="rows"><div class="rw"><div class="k">주식 수</div><div class="v">' + cm(c.sh) + '주</div></div>'
        + '<div class="rw"><div class="k">참석번호</div><div class="v">' + esc(c.seat) + '</div></div></div>'
        + '<div class="asof">' + esc(c.asof) + '</div></div>'
        + '<div class="warn"><div>' + warnRun() + warnRun() + '</div></div>'
        + '</div>';
    }).join('');
    $('#dots').innerHTML = CARDS.map(function (c, i) { return '<span class="' + (i ? '' : 'on') + '"></span>'; }).join('');
    $('#deck').querySelectorAll('[data-card]').forEach(function (el) {
      el.addEventListener('click', function () {
        var c = CARDS.filter(function (x) { return x.key === el.dataset.card; })[0];
        if (!c.live) { toast(c.co + ' 주주총회는 아직 시작 전입니다'); return; }
        CUR = c; drawList(); show('#scrList');
      });
    });
    tint(0);
    show('#scrCards', 'site');
    autoSlide();
  }
  function warnRun() {
    var s = '';
    for (var i = 0; i < 3; i++) s += '<span><i class="ph-fill ph-warning"></i>캡처 화면으로는 입장할 수 없습니다</span>';
    return s;
  }
  /* 뒤 배경을 지금 보는 카드 색으로 천천히 바꾼다 */
  function tint(i) {
    $$('#dots span').forEach(function (d, n) { d.classList.toggle('on', n === i); });
  }
  var slideT = null, slideIdx = 0;
  function autoSlide() {
    var deck = $('#deck');
    deck.addEventListener('scroll', function () {
      var w = deck.clientWidth, i = Math.round(deck.scrollLeft / (w - 34));
      i = Math.max(0, Math.min(CARDS.length - 1, i));
      if (i !== slideIdx) { slideIdx = i; tint(i); }
    });
    clearInterval(slideT);
    slideT = setInterval(function () {
      if (!$('#scrCards').classList.contains('on')) return;
      slideIdx = (slideIdx + 1) % CARDS.length;
      var w = deck.clientWidth;
      deck.scrollTo({ left: slideIdx * (w - 34), behavior: 'smooth' });
      tint(slideIdx);
    }, 4200);
  }

  /* ══ 3. 의안 목록 ════════════════════════════ */
  var LIVE = { ag: null, stage: 0, sec: null, done: null, ts: 0 };
  $('#lsBack').addEventListener('click', function () { show('#scrCards', 'site'); });

  function drawList() {
    $('#lsTitle').textContent = CUR.co + ' ' + CUR.term;
    var A = agenda();
    $('#agList').innerHTML = A.map(function (a) {
      var kids = a.children || [];
      var h = agRow(a, false);
      kids.forEach(function (k) { h += agRow(k, true, a); });
      return h;
    }).join('');
    $('#agList').querySelectorAll('[data-ag]').forEach(function (r) {
      r.addEventListener('click', function () { openVote(r.dataset.ag); });
    });
    show('#scrList');
  }
  function agRow(a, sub, parent) {
    var no = a.no, live = LIVE.ag === no, res = LIVE.done && LIVE.done[no];
    var mv = myVote(no), k = kindOf(no);
    /* 집중투표·양립불가의 하위는 상위에서 한 번에 고르므로 따로 누르지 않는다 */
    var pick = !a.header && !sub;
    var cls = 'agrow' + (sub ? ' sub' : '') + (live ? ' cur' : '') + (res ? ' done' : '')
      + (res === '폐기' || res === '철회' ? ' mute' : '');
    var bg = res ? '<span class="bg ' + (res === '가결' ? 'pass' : res === '부결' ? 'fail' : 'gray') + '">' + res + '</span>'
      : live && LIVE.stage === 2 ? '<span class="bg live">진행중</span>'
      : live && LIVE.stage === 3 ? '<span class="bg cnt">집계중</span>' : '';
    return '<div class="' + cls + '"' + (pick ? ' role="button" tabindex="0" data-ag="' + no + '"' : '') + '>'
      + (sub ? '' : '<div class="rail"><div class="d"></div></div>')
      + '<div class="c"><div class="top"><span class="no">' + (sub ? '↳ ' : '') + esc(no) + '</span>' + bg + '</div>'
      + '<div class="nm">' + esc(a.nm) + '</div>'
      + (mv && !sub ? '<span class="mv ' + (mv.pick || '행사') + '">' + (mv.pick || '행사 완료') + '</span>' : '')
      + '</div></div>';
  }

  /* ══ 4. 의안 투표 ════════════════════════════ */
  var PICK = {};                                  /* 일반·양립불가 선택 */
  var CUMV = {};                                  /* 집중투표 후보별 주식 수 */
  $('#vBack').addEventListener('click', function () { drawList(); show('#scrList'); });

  function openVote(no) {
    CURAG = no; PICK = {}; CUMV = {};
    var saved = myVote(no);
    if (saved) { PICK = saved.picks || (saved.pick ? { _: saved.pick } : {}); CUMV = saved.cum || {}; }
    drawVote();
    show('#scrVote');
  }
  function agOf(no) {
    var f = null;
    agenda().forEach(function (a) {
      if (a.no === no) f = a;
      (a.children || []).forEach(function (k) { if (k.no === no) f = k; });
    });
    return f || { no: no, nm: '' };
  }
  function drawVote() {
    var no = CURAG, a = agOf(no), k = kindOf(no), d = detail(no);
    $('#vTitle').textContent = no.replace('제', '제 ') + ' 의안';

    var top = '<div class="vtop"><div class="nm">' + esc(a.nm) + '</div>'
      + (k === 'cum' ? '<div class="vtip"><div class="k">집중투표</div>'
          + '<div class="t">보유 주식 1주마다 ' + (d.directors || 2) + '개의 의결권이 부여됩니다.</div>'
          + '<div class="d">원하는 후보자에게 집중 또는 분산하여 자유롭게 의결권을 행사할 수 있습니다.</div></div>' : '')
      + (k === 'excl' ? '<div class="vtip"><div class="k">양립불가</div>'
          + '<div class="t">함께 가결될 수 없는 의안입니다.</div>'
          + '<div class="d">각 안건에 대해 따로 의견을 선택해 주세요.</div></div>' : '')
      + '<div class="vinfo">'
      + '<div class="vrow"><span class="k">행사 가능 주식 수</span><span class="v">'
      + cm(k === 'cum' ? CUR.sh * (d.directors || 2) : CUR.sh) + ' 주</span></div>'
      + '<div class="vrow" id="vLim"><span class="k"><i class="ph-fill ph-info"></i>의결권 제한</span>'
      + '<span class="sel">' + esc(limitName()) + '<i class="ph ph-caret-down"></i></span></div>'
      + '</div>'
      + '<div class="vlimit" id="vLimTx">' + esc(limitDesc()) + '</div></div>';

    var pick;
    if (k === 'cum') pick = cumHtml(no, d);
    else if (k === 'excl') pick = exclHtml(no, d);
    else pick = '<div class="pbox">' + ch3('_') + '</div>';

    $('#voteBd').innerHTML = top + '<div class="vpick">' + pick + '</div>';
    bindPick(k);
    syncGo(k);
    $('#voteBd').scrollTop = 0;

    $('#vLim').addEventListener('click', function () { $('#vLimTx').classList.toggle('on'); });
  }
  function limitName() { return '최대주주'; }
  function limitDesc() {
    return '최대주주 및 특수관계인은 감사·감사위원 선임 의안에서 의결권 있는 주식의 3%까지만 행사할 수 있습니다.';
  }
  function ch3(key) {
    var cur = PICK[key];
    var I = { 찬성: 'ph-circle', 반대: 'ph-x', 기권: 'ph-minus', 중립: 'ph-triangle' };
    return '<div class="ch3' + (cur ? ' has' : '') + '" data-k="' + key + '">'
      + ['찬성', '반대', '기권'].map(function (c) {
          return '<button type="button" data-c="' + c + '"' + (cur === c ? ' class="on"' : '') + '>'
            + '<i class="ph ' + I[c] + '"></i>' + c + '</button>';
        }).join('') + '</div>';
  }
  function exclHtml(no, d) {
    var opts = d.options || (agOf(no).children || []);
    if (!opts.length) return '<div class="pbox">' + ch3('_') + '</div>';
    return opts.map(function (o, i) {
      return '<div class="pbox"><span class="sno">' + esc(o.no || ('n-' + (i + 1))) + '</span>'
        + '<div class="snm">' + esc(o.name || o.nm || '') + '</div>' + ch3(o.no || ('o' + i)) + '</div>';
    }).join('');
  }
  function cumHtml(no, d) {
    var C = d.cands || (agOf(no).children || []).map(function (c) { return { no: c.no, name: c.nm }; });
    var pool = CUR.sh * (d.directors || 2);
    var used = Object.keys(CUMV).reduce(function (s, k) { return s + (+CUMV[k] || 0); }, 0);
    return C.map(function (c) {
      return '<div class="cand"><div class="c"><span class="sno">' + esc(c.no) + '</span>'
        + '<div class="snm">' + esc(c.name || c.nm || '') + '</div></div>'
        + '<input inputmode="numeric" data-cd="' + esc(c.no) + '" placeholder="주식 수" value="'
        + (CUMV[c.no] || '') + '"></div>';
    }).join('')
      + '<div class="cumsum' + (used > pool ? ' over' : '') + '" id="cumSum"><span class="k">배분한 의결권</span>'
      + '<span class="v">' + cm(used) + ' / ' + cm(pool) + '</span></div>';
  }
  function bindPick(k) {
    $$('#voteBd .ch3').forEach(function (row) {
      row.querySelectorAll('[data-c]').forEach(function (b) {
        b.addEventListener('click', function () {
          var key = row.dataset.k, c = b.dataset.c;
          /* 같은 버튼을 다시 누르면 선택 해제 */
          if (PICK[key] === c) delete PICK[key]; else PICK[key] = c;
          row.classList.toggle('has', !!PICK[key]);
          row.querySelectorAll('[data-c]').forEach(function (o) {
            o.classList.toggle('on', PICK[key] === o.dataset.c);
          });
          syncGo(k);
        });
      });
    });
    $$('#voteBd [data-cd]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = this.value.replace(/[^0-9]/g, '');
        this.value = v ? cm(+v) : '';
        if (v) CUMV[this.dataset.cd] = +v; else delete CUMV[this.dataset.cd];
        var d = detail(CURAG), pool = CUR.sh * (d.directors || 2);
        var used = Object.keys(CUMV).reduce(function (s, x) { return s + (+CUMV[x] || 0); }, 0);
        var el = $('#cumSum');
        if (el) {
          el.classList.toggle('over', used > pool);
          el.querySelector('.v').textContent = cm(used) + ' / ' + cm(pool);
        }
        syncGo('cum');
      });
    });
  }
  /* 투표하기 버튼 — 고르기 전 비활성, 이미 낸 표와 같으면 비활성 */
  function syncGo(k) {
    var go = $('#vGo'), saved = myVote(CURAG);
    var ok, same = false;
    if (k === 'cum') {
      var d = detail(CURAG), pool = CUR.sh * (d.directors || 2);
      var used = Object.keys(CUMV).reduce(function (s, x) { return s + (+CUMV[x] || 0); }, 0);
      ok = used > 0 && used <= pool;
      same = saved && JSON.stringify(saved.cum || {}) === JSON.stringify(CUMV);
    } else {
      var need = (k === 'excl') ? $$('#voteBd .ch3').length : 1;
      ok = Object.keys(PICK).length >= need;
      same = saved && JSON.stringify(saved.picks || {}) === JSON.stringify(PICK);
    }
    go.textContent = saved ? '투표 변경하기' : '투표하기';
    go.disabled = !ok || !!same;
    var f = $('.vfoot'), old = f.querySelector('.vdone');
    if (old) old.remove();
    if (saved) f.insertAdjacentHTML('afterbegin',
      '<div class="vdone"><i class="ph-fill ph-check-circle"></i>투표가 완료되었습니다</div>');
  }
  $('#vGo').addEventListener('click', function () {
    var k = kindOf(CURAG);
    auth(function () {
      var data = (k === 'cum') ? { cum: Object.assign({}, CUMV) }
        : { picks: Object.assign({}, PICK), pick: PICK._ || PICK[Object.keys(PICK)[0]] };
      saveVote(CURAG, data);
      drawVote();
      toast(CURAG + ' 투표가 완료되었습니다');
      buzz(40);
    });
  });

  /* ══ 본인인증 — 생체인증을 쓰면 Face ID, 아니면 비밀번호 ══ */
  function auth(done) {
    if (SET.bio) faceAuth(done);
    else openPin('check', done);
  }

  /* ── 비밀번호 ───────────────────────────────── */
  var PIN = { set: false, val: '', tmp: '' };
  try { PIN.val = localStorage.getItem('cx.vote.pin') || ''; PIN.set = !!PIN.val; } catch (e) {}
  var pinMode = 'new', pinBuf = '', pinDone = null;
  function openPin(mode, cb) {
    pinMode = mode; pinBuf = ''; pinDone = cb || null;
    $('#pinT').textContent = '비밀번호 입력';
    $('#pinD').innerHTML = mode === 'new'
      ? '안전한 투표를 위해 비밀번호 설정이 필요합니다.<br>비밀번호를 입력해주세요.'
      : mode === 'again' ? '확인을 위해 한 번 더 입력해 주세요.'
      : '투표를 위해 비밀번호를 입력해 주세요.';
    padDraw(); dotsDraw();
    show('#scrPin');
  }
  $('#pinX').addEventListener('click', function () {
    if (pinMode === 'check') { show('#scrVote'); return; }
    tagged = false; show('#scrNfc', 'site');
  });
  function dotsDraw() {
    $('#pinDots').innerHTML = [0, 1, 2, 3, 4, 5].map(function (i) {
      return '<span class="' + (i < pinBuf.length ? 'on' : '') + '"></span>';
    }).join('');
  }
  function padDraw() {
    /* 숫자 자리를 섞어 어깨너머로 보이지 않게 한다 */
    var n = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(function () { return Math.random() - .5; });
    var keys = n.slice(0, 9).concat(['재배열', n[9], 'back']);
    $('#pinPad').innerHTML = keys.map(function (k) {
      if (k === '재배열') return '<button type="button" class="sm" data-p="mix">재배열</button>';
      if (k === 'back') return '<button type="button" data-p="back"><i class="ph ph-arrow-left"></i></button>';
      return '<button type="button" data-p="' + k + '">' + k + '</button>';
    }).join('');
    $('#pinPad').querySelectorAll('[data-p]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.dataset.p;
        if (p === 'mix') { padDraw(); return; }
        if (p === 'back') { pinBuf = pinBuf.slice(0, -1); dotsDraw(); return; }
        if (pinBuf.length >= 6) return;
        pinBuf += p; dotsDraw(); buzz(8);
        if (pinBuf.length === 6) setTimeout(pinSubmit, 160);
      });
    });
  }
  function pinSubmit() {
    if (pinMode === 'new') { PIN.tmp = pinBuf; openPin('again'); return; }
    if (pinMode === 'again') {
      if (pinBuf !== PIN.tmp) { toast('비밀번호가 일치하지 않습니다'); openPin('new'); return; }
      PIN.val = pinBuf; PIN.set = true;
      try { localStorage.setItem('cx.vote.pin', PIN.val); } catch (e) {}
      $('#bioOv').classList.add('on');            /* 생체인증 사용 안내 */
      return;
    }
    if (pinBuf !== PIN.val) { toast('비밀번호가 맞지 않습니다'); pinBuf = ''; dotsDraw(); return; }
    show('#scrVote');
    if (pinDone) { var f = pinDone; pinDone = null; f(); }
  }
  $('#bioYes').addEventListener('click', function () {
    $('#bioOv').classList.remove('on');
    SET.bio = true; saveSet();
    passkeyWarmup();
    drawCards();
  });
  $('#bioNo').addEventListener('click', function () {
    $('#bioOv').classList.remove('on');
    SET.bio = false; saveSet();
    drawCards();
  });

  /* ── Face ID — 기기 인증을 부르되 결과와 무관하게 진행 ── */
  var BIO = null;
  function hasBio(cb) {
    if (BIO !== null) return cb(BIO);
    var P = window.PublicKeyCredential;
    if (!P || !P.isUserVerifyingPlatformAuthenticatorAvailable) { BIO = false; return cb(false); }
    var done = false;
    function ans(v) { if (done) return; done = true; BIO = !!v; cb(BIO); }
    try { P.isUserVerifyingPlatformAuthenticatorAvailable().then(ans, function () { ans(false); }); }
    catch (e) { ans(false); }
    setTimeout(function () { ans(false); }, 1200);
  }
  function rand(n) { var a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) {} return a; }
  function passkeyWarmup() {
    if (!window.PublicKeyCredential || sessionStorage.getItem('cx.pk')) return;
    hasBio(function (yes) {
      if (!yes) return;
      try {
        navigator.credentials.create({
          publicKey: {
            challenge: rand(32), rp: { name: '현장투표' },
            user: { id: rand(16), name: ME.nm, displayName: ME.nm },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { userVerification: 'preferred' }, timeout: 15000
          }
        }).then(function () { sessionStorage.setItem('cx.pk', '1'); }).catch(function () {});
      } catch (e) {}
    });
  }
  function faceAuth(done) {
    var ov = $('#faceOv'), box = ov.querySelector('.facebox');
    box.classList.remove('ok');
    $('#faceIc').innerHTML = '<i class="ph ph-scan"></i>';
    $('#faceT').textContent = 'Face ID';
    $('#faceD').textContent = '얼굴을 화면에 맞춰 주세요';
    ov.classList.add('on');
    finish.done = false;
    hasBio(function (yes) {
      if (!yes) { setTimeout(finish, 1300); return; }
      try {
        navigator.credentials.get({
          publicKey: { challenge: rand(32), userVerification: 'preferred', timeout: 20000 }
        }).then(finish, finish);
      } catch (e) { finish(); }
      setTimeout(finish, 22000);
    });
    function finish() {
      if (finish.done) return; finish.done = true;
      box.classList.add('ok');
      $('#faceIc').innerHTML = '<i class="ph-fill ph-check"></i>';
      $('#faceT').textContent = '인증 완료';
      $('#faceD').textContent = ME.nm + ' 님 본인 확인이 끝났습니다';
      buzz([20, 40, 20]);
      setTimeout(function () { ov.classList.remove('on'); done(); }, 800);
    }
  }

  /* ══ 내역 ════════════════════════════════════ */
  function drawHist() {
    var v = votes(), U = units();
    var n = U.filter(function (a) { return v[a.no]; }).length;
    var rows = CARDS.map(function (c) {
      return { co: c.co, term: c.term, n: c.key === 'kudos' ? n : 0, tot: U.length };
    });
    $('#histBd').innerHTML =
      '<div class="hday">2026년 9월 29일</div>'
      + rows.map(function (r) {
          return '<button class="hrow" type="button"><div class="c">'
            + '<div class="co">' + esc(r.co) + '</div><div class="tm">' + esc(r.term) + '</div></div>'
            + '<span class="n">투표 ' + r.n + ' / ' + r.tot + '건</span></button>';
        }).join('')
      + '<div class="hday">2026년 3월 12일</div>'
      + '<button class="hrow" type="button"><div class="c"><div class="co">신세계</div>'
      + '<div class="tm">제 9기 정기 주주총회</div></div><span class="n">투표 6 / 6건</span></button>'
      + '<button class="hrow" type="button"><div class="c"><div class="co">기아</div>'
      + '<div class="tm">제 9기 정기 주주총회</div></div><span class="n">투표 5 / 5건</span></button>';
  }

  /* ══ 설정 ════════════════════════════════════ */
  var SET = { bio: false, noti: true };
  try { SET = Object.assign(SET, JSON.parse(localStorage.getItem('cx.vote.set') || '{}')); } catch (e) {}
  function saveSet() { try { localStorage.setItem('cx.vote.set', JSON.stringify(SET)); } catch (e) {} }
  function drawSet() {
    $('#setBd').innerHTML =
      '<div class="sgrp">'
      + '<div class="srow"><div class="c"><div class="t">생체인증 사용</div>'
      + '<div class="d">생체인증을 추가로 사용하면 매번 비밀번호를 입력하지 않아도 돼요.</div></div>'
      + '<span class="sw' + (SET.bio ? ' on' : '') + '" id="swBio" role="button"></span></div>'
      + '<div class="srow"><div class="c"><div class="t">서비스 알림</div>'
      + '<div class="d">투표 시작과 마감 전 알림을 받을 수 있습니다.</div></div>'
      + '<span class="sw' + (SET.noti ? ' on' : '') + '" id="swNoti" role="button"></span></div>'
      + '</div><div class="sgap"></div>'
      + '<div class="slist"><div class="lb">약관</div>'
      + '<button class="slink" type="button" data-help="이용약관">이용약관<i class="ph ph-caret-right"></i></button>'
      + '<button class="slink" type="button" data-help="개인정보처리방침">개인정보처리방침<i class="ph ph-caret-right"></i></button>'
      + '</div>';
    $('#swBio').addEventListener('click', function () {
      SET.bio = !SET.bio; saveSet(); this.classList.toggle('on', SET.bio);
      if (SET.bio) passkeyWarmup();
      toast(SET.bio ? '생체인증을 사용합니다' : '생체인증을 끄고 비밀번호로 확인합니다');
    });
    $('#swNoti').addEventListener('click', function () {
      SET.noti = !SET.noti; saveSet(); this.classList.toggle('on', SET.noti);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-help]');
    if (b) toast(b.dataset.help + ' — 시연 범위 밖입니다');
  });

  /* ══ 현장 제어 신호 구독 ═════════════════════ */
  var lastOpen = null;
  function apply(s) {
    if (!s || !s.ts) return;
    LIVE.ag = s.ag || null;
    LIVE.stage = isFinite(s.stage) ? +s.stage : 0;
    LIVE.sec = (s.sec == null ? null : +s.sec);
    LIVE.done = s.done || null;
    LIVE.ts = s.ts;

    var key = LIVE.ag + '/' + LIVE.stage;
    if (LIVE.stage === 2 && key !== lastOpen) {
      lastOpen = key;
      if (SET.noti && !myVote(LIVE.ag)) alertOpen(LIVE.ag + ' 표결이 시작되었습니다');
    }
    if ($('#scrList').classList.contains('on')) drawList();
  }
  function alertOpen(msg) {
    var b = $('#alertBar');
    $('#alertTx').textContent = msg;
    b.classList.add('on'); buzz([60, 80, 60, 80, 120]); beep();
    clearTimeout(alertOpen.t);
    alertOpen.t = setTimeout(function () { b.classList.remove('on'); }, 4200);
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var c = new C(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
      o.start(); o.stop(c.currentTime + 0.52);
      setTimeout(function () { try { c.close(); } catch (e) {} }, 800);
    } catch (e) {}
  }
  function liveGet() { try { return JSON.parse(localStorage.getItem('cx.live') || '{}'); } catch (e) { return {}; } }
  apply(liveGet());
  window.addEventListener('storage', function (e) { if (e.key === 'cx.live') apply(liveGet()); });
  setInterval(function () { var s = liveGet(); if (s.ts && s.ts !== LIVE.ts) apply(s); }, 1000);
})();
