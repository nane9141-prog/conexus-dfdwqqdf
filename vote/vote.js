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
      g: ['#00C853', '#00E6A8', '#76FF03', '#C6FF4D'] },
    { key: 'kakaobank', co: '카카오뱅크', term: '제10기 정기주주총회',
      sh: 1200, seat: 'C412', asof: '2026년 9월 14일 기준', live: false,
      g: ['#FF6A00', '#FFC400', '#FF2D55', '#FFD166'] }
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
  var scanT = null;
  /* iOS NFC 스캔 시트를 띄우고 2초 뒤 진입한다 */
  function doTag() {
    if (tagged) return;
    tagged = true;
    openScan();
    scanT = setTimeout(function () {
      closeScan(); buzz([30, 60, 30]);
      if (!PIN.set) { openPin('new'); return; }   /* 첫 태깅이면 비밀번호부터 */
      drawCards();
    }, 2000);
  }
  function openScan() {
    var el = $('#nfcSheet'); el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('on'); });
  }
  function closeScan() {
    var el = $('#nfcSheet'); el.classList.remove('on');
    setTimeout(function () { el.hidden = true; }, 230);
  }
  function cancelScan() { clearTimeout(scanT); tagged = false; closeScan(); }
  $('#nfcSheetX').addEventListener('click', cancelScan);
  $('#nfcSheetC').addEventListener('click', cancelScan);
  (function () {
    if (!('NDEFReader' in window)) return;
    try { var r = new window.NDEFReader(); r.scan().then(function () { r.onreading = doTag; }).catch(function () {}); } catch (e) {}
  })();
  if (/[?&]nfc=1/.test(location.search)) setTimeout(doTag, 200);

  /* ══ 2. 출입증 카드 ══════════════════════════ */
  /* 카드 대표색을 그림자 색으로 쓰기 위해 hex → rgba */
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function warnRun() {
    var s = '';
    for (var i = 0; i < 3; i++) s += '<span><i class="ph-fill ph-warning"></i>캡처 화면으로는 입장할 수 없습니다</span>';
    return s;
  }
  function drawCards() {
    $('#deck').innerHTML = CARDS.map(function (c) {
      return '<div class="pcard' + (c.live ? '' : ' off') + '" role="button" tabindex="0" data-card="' + c.key + '"'
        + ' style="--c0:' + c.g[0] + ';--c1:' + c.g[1] + ';--c2:' + c.g[2]
        + ';--sh:' + rgba(c.g[0], .34) + ';--sh2:' + rgba(c.g[0], .18) + '">'
        + '<span class="nfcic"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.5191 20.8294C10.5191 21.2009 10.4967 21.5842 10.4517 21.9792C10.4064 22.3742 10.346 22.7561 10.2705 23.125C10.1719 23.6072 10.2257 24.0683 10.4319 24.5082C10.6381 24.9485 10.9705 25.26 11.4293 25.4428C11.8738 25.6116 12.2973 25.5965 12.6998 25.3975C13.1019 25.1985 13.364 24.8767 13.486 24.4323C13.6227 23.8572 13.7288 23.2632 13.8043 22.6504C13.8798 22.0375 13.9176 21.4318 13.9176 20.8333C13.9176 20.2348 13.8798 19.6291 13.8043 19.0163C13.7288 18.4034 13.6227 17.8095 13.486 17.2344C13.364 16.7899 13.1019 16.4682 12.6998 16.2692C12.2973 16.0702 11.8738 16.0551 11.4293 16.2239C10.9705 16.4067 10.6381 16.7182 10.4319 17.1585C10.2257 17.5984 10.1719 18.0594 10.2705 18.5416C10.346 18.9106 10.4064 19.2912 10.4517 19.6835C10.4967 20.0759 10.5191 20.4578 10.5191 20.8294ZM18.4489 20.8333C18.4489 21.7687 18.3886 22.6923 18.2682 23.6042C18.1473 24.5165 17.9665 25.4026 17.7255 26.2624C17.5802 26.7446 17.6049 27.1998 17.7997 27.628C17.9942 28.0566 18.3008 28.3539 18.7196 28.5201C19.1663 28.7142 19.6104 28.7053 20.0518 28.4934C20.4932 28.2816 20.7853 27.9357 20.928 27.4558C21.2524 26.3887 21.4867 25.3032 21.6309 24.1995C21.7752 23.0954 21.8473 21.9729 21.8473 20.8322C21.8473 19.6915 21.7752 18.5694 21.6309 17.466C21.4867 16.3627 21.2524 15.2776 20.928 14.2109C20.7853 13.7309 20.4932 13.3851 20.0518 13.1732C19.6104 12.9614 19.1663 12.9525 18.7196 13.1466C18.3008 13.3127 17.9942 13.6101 17.7997 14.0387C17.6049 14.4669 17.5802 14.9221 17.7255 15.4043C17.9665 16.2641 18.1473 17.1502 18.2682 18.0625C18.3886 18.9744 18.4489 19.898 18.4489 20.8333ZM26.3786 20.8333C26.3786 22.2596 26.2768 23.6646 26.0733 25.0486C25.8701 26.4329 25.5609 27.7815 25.1455 29.0944C25.0001 29.591 25.0062 30.0698 25.1636 30.5308C25.3211 30.9923 25.6286 31.3238 26.0863 31.5254C26.5308 31.7173 26.9737 31.7137 27.4151 31.5147C27.8565 31.3161 28.1486 30.9755 28.2913 30.4929C28.8053 28.9504 29.1814 27.3746 29.4196 25.7656C29.6579 24.1563 29.777 22.5122 29.777 20.8333C29.777 19.1545 29.6579 17.5104 29.4196 15.901C29.1814 14.2921 28.8053 12.7163 28.2913 11.1738C28.1486 10.6912 27.8565 10.3506 27.4151 10.152C26.9737 9.95299 26.5308 9.9494 26.0863 10.1412C25.6286 10.3429 25.3211 10.6744 25.1636 11.1358C25.0062 11.5969 25.0001 12.0757 25.1455 12.5723C25.5609 13.8852 25.8701 15.2338 26.0733 16.6181C26.2768 18.002 26.3786 19.4071 26.3786 20.8333Z" fill="currentColor"/> </svg></span>'
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
    $('#deck').querySelectorAll('[data-card]').forEach(function (el) {
      el.addEventListener('click', function () {
        if ($('#deck').dataset.drag) return;        /* 드래그로 넘긴 직후면 열지 않는다 */
        var c = CARDS.filter(function (x) { return x.key === el.dataset.card; })[0];
        if (!c.live) { toast(c.co + ' 주주총회는 아직 시작 전입니다'); return; }
        CUR = c; drawList(); show('#scrList');
      });
    });
    $('#cCount').textContent = '출입증 ' + CARDS.length + '개';
    show('#scrCards', 'site');
    dragDeck(); markCenter();
  }
  /* 가운데에 온 카드만 원래 크기로 키운다 */
  function markCenter() {
    var deck = $('#deck'), mid = deck.scrollLeft + deck.clientWidth / 2, best = 0, gap = Infinity;
    for (var i = 0; i < deck.children.length; i++) {
      var el = deck.children[i], d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < gap) { gap = d; best = i; }
    }
    for (var j = 0; j < deck.children.length; j++) deck.children[j].classList.toggle('mid', j === best);
  }
  /* 카드 덱: 자동 전환 없이 손/마우스 드래그로만 넘긴다 */
  var dragBound = false;
  function cardPos(i) {
    var deck = $('#deck'), el = deck.children[i];
    if (!el) return 0;
    return el.offsetLeft - (deck.clientWidth - el.offsetWidth) / 2;
  }
  function nearestCardFrom(sl) {
    var deck = $('#deck'), best = 0, gap = Infinity;
    for (var i = 0; i < deck.children.length; i++) {
      var g = Math.abs(sl - cardPos(i));
      if (g < gap) { gap = g; best = i; }
    }
    return best;
  }
  function nearestCard() {
    var deck = $('#deck'), best = 0, gap = Infinity;
    for (var i = 0; i < deck.children.length; i++) {
      var d = Math.abs(deck.scrollLeft - cardPos(i));
      if (d < gap) { gap = d; best = i; }
    }
    return best;
  }
  /* 놓은 뒤 — 손가락이 가지고 있던 속도를 그대로 이어받아
     임계감쇠 스프링으로 가장 가까운 카드에 미끄러져 멈춘다 (튕김 없음) */
  var glideId = 0;
  function glideTo(i, v0) {
    var deck = $('#deck');
    i = Math.max(0, Math.min(deck.children.length - 1, i));
    var to = cardPos(i), x = deck.scrollLeft, v = v0 || 0;   /* v: px/s */
    if (Math.abs(to - x) < 0.5 && Math.abs(v) < 30) { deck.scrollLeft = to; markCenter(); return; }
    var k = 95, c = 2 * Math.sqrt(k), last = 0, id = ++glideId;
    deck.classList.add('glide');
    function step(t) {
      if (id !== glideId) return;
      if (!last) { last = t; requestAnimationFrame(step); return; }
      var dt = Math.min(0.032, (t - last) / 1000); last = t;
      /* 한 프레임을 잘게 쪼개 적분해야 큰 dt에서도 흔들리지 않는다 */
      var n = Math.ceil(dt / 0.008), h = dt / n;
      for (var j = 0; j < n; j++) {
        var a = -k * (x - to) - c * v;
        v += a * h; x += v * h;
      }
      deck.scrollLeft = x; markCenter();
      if (Math.abs(x - to) > 0.4 || Math.abs(v) > 25) requestAnimationFrame(step);
      else { deck.scrollLeft = to; markCenter(); deck.classList.remove('glide'); }
    }
    requestAnimationFrame(step);
  }
  function dragDeck() {
    if (dragBound) return;
    dragBound = true;
    var deck = $('#deck'), down = false, moved = 0, sx = 0, sl = 0, vx = 0, lx = 0, lt = 0;
    deck.addEventListener('scroll', markCenter, { passive: true });
    deck.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;      /* 터치는 브라우저 기본 스크롤에 맡긴다 */
      glideId++; deck.classList.remove('glide');   /* 진행 중이던 글라이드 중단 */
      down = true; moved = 0; vx = 0;
      sx = lx = e.clientX; lt = e.timeStamp; sl = deck.scrollLeft;
      deck.classList.add('grab');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - sx;
      if (Math.abs(d) > moved) moved = Math.abs(d);
      deck.scrollLeft = sl - d;
      var dt = e.timeStamp - lt;
      if (dt > 0) vx = 0.8 * ((e.clientX - lx) / dt) + 0.2 * vx;   /* px/ms, 평활화 */
      lx = e.clientX; lt = e.timeStamp;
      if (moved > 4) e.preventDefault();
    }, { passive: false });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; deck.classList.remove('grab');
      if (moved > 6) {
        deck.dataset.drag = '1'; setTimeout(function () { delete deck.dataset.drag; }, 0);
        /* 한 장 넘기려면 카드 폭의 45% 이상 끌거나 확실히 빠르게 튕겨야 한다 */
        var w = deck.children[0] ? deck.children[0].offsetWidth : 300;
        var start = nearestCardFrom(sl), moveX = deck.scrollLeft - sl;
        var next = (Math.abs(moveX) > w * 0.45 || Math.abs(vx) > 1.1)
          ? start + (moveX > 0 ? 1 : -1) : start;
        glideTo(next, -vx * 1000);      /* 손가락 속도를 스크롤 속도로 환산 */
      }
    });
  }

  /* ══ 3. 의안 목록 ════════════════════════════ */
  var LIVE = { ag: null, stage: 0, sec: null, done: null, ts: 0 };
  $('#lsBack').addEventListener('click', function () { show('#scrCards', 'site'); });

  function drawList() {
    $('#lsTitle').textContent = CUR.co + ' ' + CUR.term;
    $('#agList').innerHTML = agenda().map(function (a) {
      var kids = a.children || [];
      if (!kids.length) return agRow(a, false);
      /* 상위 + 하위를 한 묶음으로 감싸고, 하위에는 타임라인 레일을 붙인다 */
      return '<div class="agg">' + agRow(a, false, true)
        + '<div class="agkids">' + kids.map(function (k) { return agRow(k, true); }).join('') + '</div></div>';
    }).join('');
    $('#agList').querySelectorAll('[data-ag]').forEach(function (r) {
      r.addEventListener('click', function () { openVote(r.dataset.ag); });
    });
    show('#scrList');
  }
  /* 의안 상태 — 집계 결과 > 진행중/집계중 > 대기 */
  function agState(no) {
    var res = LIVE.done && LIVE.done[no];
    if (res) return { k: res === '가결' ? 'pass' : res === '부결' ? 'fail' : 'gray', nm: res,
                      off: res === '폐기' || res === '철회' };
    if (LIVE.ag === no && LIVE.stage === 2) return { k: 'live', nm: '진행중', dot: true };
    if (LIVE.ag === no && LIVE.stage === 3) return { k: 'cnt', nm: '집계중', dot: true };
    return null;
  }
  function agRow(a, sub, lead) {
    var no = a.no, st = agState(no), mv = myVote(no);
    /* 집중투표·양립불가의 하위는 상위에서 한 번에 고르므로 따로 누르지 않는다 */
    var pick = !a.header && !sub;
    var nd = st && st.k === 'live' ? 'cur' : st && st.off ? 'off' : mv || (st && !st.dot) ? 'done' : 'wait';
    var cls = 'agr' + (sub ? ' k' : '') + (lead ? ' lead' : '') + (st && st.off ? ' mute' : '');
    return '<div class="' + cls + '"' + (pick ? ' role="button" tabindex="0" data-ag="' + no + '"' : '') + '>'
      + (sub ? '<i class="nd ' + nd + (nd === 'cur' ? ' ph ph-arrow-right' : '') + '"></i>' : '')
      + '<div class="top"><span class="left">'
      + '<span class="nbadge">' + (sub ? '<i class="ph ph-arrow-elbow-down-right"></i>' : '') + esc(no) + '</span>'
      + (mv ? '<span class="vchk"><i class="ph-fill ph-check"></i></span>' : '')
      + '</span>'
      + (st ? '<span class="st2 ' + st.k + '">' + (st.dot ? '<span class="dot"></span>' : '')
              + '<span class="tx">' + st.nm + '</span></span>' : '')
      + '</div><div class="nm">' + esc(a.nm) + '</div></div>';
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
  /* ══ 내역 ════════════════════════════════════ */
  /* 지난 주총은 데모용 고정 데이터, 큐더스전자는 실제 투표 기록에서 만든다 */
  var PASTAG = {
    신세계: [
      { no: '제 1호 의안', nm: '제51기 연결 및 별도 재무제표\n(이익잉여금처분계산서 포함) 승인의 건', res: '가결', my: '찬성' },
      { no: '제 2호 의안', nm: '정관 일부 변경의 건', res: '가결', my: '찬성' },
      { no: '제 3호 의안', nm: '사외이사 선임의 건', res: '부결', my: '반대' },
      { no: '제 4호 의안', nm: '감사위원회 위원 선임의 건', res: '가결', my: '기권' },
      { no: '제 5호 의안', nm: '이사 보수한도 승인의 건', res: '가결', my: '찬성' },
      { no: '제 6호 의안', nm: '집중투표에 의한 이사 3인 선임의 건', res: '집중투표', sp: 'cum',
        kids: [
          { no: '제 6-1호 의안', nm: '사내이사 후보 A 선임의 건', res: '가결', my: '찬성' },
          { no: '제 6-2호 의안', nm: '사외이사 후보 B 선임의 건', res: '부결', my: '반대' }
        ] }
    ],
    기아: [
      { no: '제 1호 의안', nm: '제9기 재무제표 승인의 건', res: '가결', my: '찬성' },
      { no: '제 2호 의안', nm: '정관 일부 변경의 건', res: '가결', my: '찬성' },
      { no: '제 3호 의안', nm: '이사 선임의 건', res: '분리의안', sp: 'excl',
        kids: [
          { no: '제 3-1호 의안', nm: '회사 제안 후보 선임의 건', res: '가결', my: '찬성' },
          { no: '제 3-2호 의안', nm: '주주 제안 후보 선임의 건', res: '부결', my: '반대' }
        ] },
      { no: '제 4호 의안', nm: '감사위원 선임의 건', res: '가결', my: '중립' },
      { no: '제 5호 의안', nm: '이사 보수한도 승인의 건', res: '가결', my: '불통일행사' }
    ]
  };
  var HIST = [
    { d: '2026-09-29', co: (M.org || '큐더스전자'), term: (M.name || '제10기 정기주주총회'), live: true },
    { d: '2026-03-12', co: '신세계', term: '제 9기 정기 주주총회', items: PASTAG['신세계'] },
    { d: '2026-03-12', co: '기아', term: '제 9기 정기 주주총회', items: PASTAG['기아'] },
    { d: '2026-03-05', co: '네이버', term: '제 27기 정기 주주총회', items: [] }
  ];
  var SPTIP = {
    cum: { t: '집중투표', d: '선임할 이사 수만큼의 의결권을 특정 후보에게 몰아서 행사할 수 있는 방식입니다. 개별 찬반 대신 후보별 배분 결과가 표시됩니다.' },
    excl: { t: '분리·양립불가 의안', d: '함께 가결될 수 없는 의안들이 묶인 유형입니다. 하위 의안 중 득표가 높은 안건만 가결되어, 상위에는 유형만 표시됩니다.' },
    uni: { t: '불통일행사', d: '보유 주식을 나누어 서로 다른 의견으로 행사한 경우입니다. 찬성·반대 수량이 함께 집계됩니다.' },
    part: { t: '일부선임', d: '후보 전원이 아닌 일부만 선임된 결과입니다.' }
  };

  function hdate(s) {
    var p = s.split('-');
    return p[0] + '년 ' + (+p[1]) + '월 ' + (+p[2]) + '일';
  }
  /* 큐더스전자 — 실제 의안·내 표·집계 결과로 상세 항목을 만든다 */
  function liveItems() {
    return agenda().filter(function (a) { return !a.header; }).map(function (a) {
      var k = kindOf(a.no);
      var kids = (a.children || []).map(function (c) {
        return { no: c.no, nm: c.nm, res: (LIVE.done && LIVE.done[c.no]) || null,
                 my: (myVote(c.no) || {}).pick || null };
      });
      return { no: a.no, nm: a.nm, kids: kids,
        sp: k === 'cum' ? 'cum' : k === 'excl' ? 'excl' : null,
        res: (LIVE.done && LIVE.done[a.no]) || (k === 'cum' ? '집중투표' : k === 'excl' ? '분리의안' : null),
        my: (myVote(a.no) || {}).pick || null };
    });
  }
  function itemsOf(h) { return h.live ? liveItems() : (h.items || []); }

  function drawHist() {
    var body = $('#histBd');
    var rows = HIST.slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    if (!rows.length) { body.innerHTML = emptyHtml(); return; }
    var html = '', day = '';
    rows.forEach(function (h, i) {
      if (h.d !== day) { day = h.d; html += '<div class="hday">' + hdate(h.d) + '</div>'; }
      var it = itemsOf(h);
      var done = it.filter(function (x) { return x.my; }).length;
      html += '<button class="hrow" type="button" data-h="' + i + '"><div class="c">'
        + '<div class="co">' + esc(h.co) + '</div><div class="tm">' + esc(h.term) + '</div></div>'
        + '<span class="n">투표 ' + done + ' / ' + it.length + '건</span>'
        + '<i class="ph ph-caret-right cv"></i></button>';
    });
    body.innerHTML = html;
    body.querySelectorAll('[data-h]').forEach(function (b) {
      b.addEventListener('click', function () { openHdet(rows[+b.dataset.h]); });
    });
  }
  function emptyHtml() {
    return '<div class="hempty"><img src="hist-empty.png" alt="">'
      + '<div class="t">현장 투표 내역이 없습니다</div>'
      + '<div class="d">* 현장 투표 내역은 주주총회 다음 날부터 목록에 제공되며, 1개월간 확인이 가능합니다.</div></div>';
  }

  /* ── 상세 ───────────────────────────────────── */
  var HD = null, HDFIL = '전체';
  function openHdet(h) {
    HD = h; HDFIL = '전체';
    $('#hdTitle').textContent = h.co + ' ' + h.term;
    drawHdet();
    show('#scrHdet', 'hist');
  }
  $('#hdBack').addEventListener('click', function () { drawHist(); show('#scrHist', 'hist'); });

  function drawHdet() {
    var it = itemsOf(HD);
    if (!it.length) { $('#hdFil').innerHTML = ''; $('#hdBd').innerHTML = emptyHtml(); return; }
    /* 내 투표현황 탭 — 내가 고른 값으로만 집계 */
    var cnt = {};
    function tally(x) { if (x.my) cnt[x.my] = (cnt[x.my] || 0) + 1; (x.kids || []).forEach(tally); }
    it.forEach(tally);
    var keys = ['찬성', '반대', '기권', '중립', '불통일행사'].filter(function (k) { return cnt[k]; });
    var tot = keys.reduce(function (s, k) { return s + cnt[k]; }, 0);
    $('#hdFil').innerHTML = [['전체', tot]].concat(keys.map(function (k) { return [k, cnt[k]]; }))
      .map(function (p) {
        return '<button type="button" data-f="' + p[0] + '"' + (HDFIL === p[0] ? ' class="on"' : '') + '>'
          + p[0] + '<span class="c">' + p[1] + '</span></button>';
      }).join('');
    $('#hdFil').querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { HDFIL = b.dataset.f; drawHdet(); });
    });

    var show2 = it.filter(function (x) {
      if (HDFIL === '전체') return true;
      if (x.my === HDFIL) return true;
      return (x.kids || []).some(function (k) { return k.my === HDFIL; });
    });
    $('#hdBd').innerHTML = show2.map(vcardHtml).join('')
      || '<div class="hempty"><div class="t">해당하는 투표 내역이 없습니다</div></div>';
    bindHdet();
  }
  function resCls(r) { return r === '가결' ? 'pass' : r === '부결' ? 'fail' : r ? 'gray' : 'gray'; }
  function myCls(m) { return m === '찬성' ? 'yes' : m === '반대' ? 'no' : 'gray'; }
  function vrow(k, v, cls, tip) {
    return '<div class="vrow"><span class="k">' + k + '</span><span class="v ' + cls + '">' + esc(v || '-')
      + (tip ? '<i class="ph ph-info" data-tip="' + tip + '"></i>' : '') + '</span></div>';
  }
  function vcardHtml(x, i) {
    var kids = x.kids || [], has = kids.length > 0;
    var h = '<div class="vcard' + (has ? ' fold' : '') + '" data-i="' + i + '">'
      + '<div class="hd"><span class="no">' + esc(x.no) + '</span>'
      + (has ? '<span class="cnt">의안 ' + kids.length + '건</span>' : '') + '</div>'
      + '<div class="ttl">' + esc(x.nm).replace(/\n/g, '<br>') + '</div>'
      + '<div class="meta"><div class="col">'
      + vrow('가결 여부', x.res, resCls(x.res), x.sp ? x.sp : '')
      + (x.sp ? '' : vrow('내 의견', x.my, myCls(x.my), x.my === '불통일행사' ? 'uni' : ''))
      + '</div><i class="ph ph-caret-right cv"></i></div>';
    if (has) {
      h += '<div class="vkids">' + kids.map(function (k) {
        return '<div class="vkid"><div class="hd"><span class="no">' + esc(k.no) + '</span></div>'
          + '<div class="ttl">' + esc(k.nm).replace(/\n/g, '<br>') + '</div>'
          + '<div class="meta"><div class="col">'
          + vrow('가결여부', k.res, resCls(k.res))
          + vrow('내 의견', k.my, myCls(k.my))
          + '</div><i class="ph ph-caret-right cv"></i></div></div>';
      }).join('') + '</div>'
      + '<button class="vfold" type="button">하위의안 펼치기<i class="ph ph-caret-down"></i></button>';
    }
    return h + '</div>';
  }
  function bindHdet() {
    $('#hdBd').querySelectorAll('.vfold').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var card = b.closest('.vcard'), on = card.classList.toggle('fold');
        b.innerHTML = (on ? '하위의안 펼치기' : '하위의안 접기')
          + '<i class="ph ph-caret-' + (on ? 'down' : 'up') + '"></i>';
      });
    });
    $('#hdBd').querySelectorAll('[data-tip]').forEach(function (ic) {
      ic.addEventListener('click', function (e) { e.stopPropagation(); openTip(ic); });
    });
  }
  /* 특수투표 유형 툴팁 */
  var tipEl = null;
  function openTip(ic) {
    closeTip();
    var t = SPTIP[ic.dataset.tip]; if (!t) return;
    tipEl = document.createElement('div');
    tipEl.className = 'vtip';
    tipEl.innerHTML = '<b>' + t.t + '</b>' + t.d;
    $('#phone').appendChild(tipEl);
    var r = ic.getBoundingClientRect(), p = $('#phone').getBoundingClientRect();
    var left = Math.min(Math.max(12, r.left - p.left - 10), p.width - tipEl.offsetWidth - 12);
    var top = r.bottom - p.top + 8;
    if (top + tipEl.offsetHeight > p.height - 20) top = r.top - p.top - tipEl.offsetHeight - 8;
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
    requestAnimationFrame(function () { tipEl && tipEl.classList.add('on'); });
    setTimeout(function () { document.addEventListener('click', closeTip, { once: true }); }, 0);
  }
  function closeTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

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
