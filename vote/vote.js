/* 현장투표 앱 — 주주총회장에서 주주가 직접 의결권을 행사한다.
 *
 *  현장 제어(onsite-control.html)가 localStorage 'cx.live' 로 내보내는 신호를 그대로 구독한다.
 *  같은 오리진이라 별도 배선이 없어도 같은 값을 본다 — 주주PASS 시청 페이지와 같은 방식이다.
 *    { ag: '제1호', stage: 0~4, sec: 남은 초, done: {의안:결과} }
 *    stage 2 = 표결 중 · 3 = 집계 중 · 4 = 결과
 */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cm(n) { return (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR'); }

  /* ── 주주 · 출입증 ──────────────────────────── */
  var ME = { nm: '윤대일', no: '8100461', id: '800101-1******', sh: 41847, rt: 0.0089 };
  var M = (window.CX && CX.meeting) || {};
  var PASSES = [
    { key: 'kudos', co: M.org || '큐더스전자', term: M.name || '제10기 정기주주총회',
      date: '2026년 9월 29일 (화) 오전 10:00', place: '서울 강남구 큐더스전자 본사 대강당',
      sh: 41847, seat: 'B-24', code: 'KDS-2026-0461', live: true },
    { key: 'naver', co: '네이버', term: '제27기 정기주주총회',
      date: '2026년 9월 29일 (화) 오전 11:00', place: '경기 성남시 분당구 네이버 1784 커넥트홀',
      sh: 20000, seat: 'A-08', code: 'NVR-2026-1182', live: false },
    { key: 'kakaobank', co: '카카오뱅크', term: '제10기 정기주주총회',
      date: '2026년 9월 29일 (화) 오전 10:00', place: '서울 영등포구 카카오뱅크 본사 대강당',
      sh: 1200, seat: 'C-15', code: 'KKB-2026-0733', live: false }
  ];
  var CUR = null;                                  /* 보고 있는 출입증 */

  /* 의안 — 선택 가능한 단위만 (상위 묶음 제외) */
  function agenda() {
    var A = ((window.CX && CX.agenda) || []).filter(function (a) { return !a.header; });
    return A.length ? A : [{ no: '제1호', nm: '재무제표 승인의 건', types: ['보통결의'] }];
  }
  function agType(a) { return (a.types && a.types[0]) || '보통결의'; }

  /* ── 내가 행사한 표 — 같은 오리진의 cx.onsite 에 쌓는다 ─── */
  var VKEY = 'cx.onsite';
  function votes() {
    try { return JSON.parse(localStorage.getItem(VKEY) || '{}'); } catch (e) { return {}; }
  }
  function saveVote(no, pick) {
    var v = votes();
    v[no] = { pick: pick, sh: ME.sh, nm: ME.nm, at: Date.now() };
    /* 현장 제어가 바로 집계할 수 있게 합계도 같이 적어 둔다 */
    v._sum = {};
    Object.keys(v).forEach(function (k) {
      if (k.charAt(0) === '_') return;
      var s = (v._sum[k] = v._sum[k] || { 찬성: 0, 반대: 0, 기권: 0 });
      s[v[k].pick] += v[k].sh;
    });
    try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('cx-onsite', { detail: v })); } catch (e) {}
  }
  function myVote(no) { var v = votes()[no]; return v ? v.pick : null; }

  /* ── 토스트 ─────────────────────────────────── */
  var tT = null;
  function toast(t) {
    var el = $('#toastT'); el.textContent = t; el.classList.add('on');
    clearTimeout(tT); tT = setTimeout(function () { el.classList.remove('on'); }, 2400);
  }
  function show(sel) { $$('.scr').forEach(function (s) { s.classList.toggle('on', '#' + s.id === sel); }); }

  /* ══ 1. NFC 태깅 ═════════════════════════════ */
  var tagged = false;
  function doTag() {
    if (tagged) return;
    tagged = true;
    $('.nfc').classList.add('done');
    $('#nfcHint').textContent = '태그를 인식했습니다';
    $('#nfcIcSwap') || ($('#nfcGo').querySelector('.core i').className = 'ph-fill ph-check-circle');
    buzz([30, 60, 30]);
    setTimeout(function () { drawPasses(); show('#scrPass'); }, 700);
  }
  $('#nfcGo').addEventListener('click', doTag);
  /* 안드로이드 크롬이면 진짜 태그도 읽어 본다 — 안 되면 탭으로 진행 */
  (function () {
    if (!('NDEFReader' in window)) return;
    try {
      var r = new window.NDEFReader();
      r.scan().then(function () { r.onreading = doTag; }).catch(function () {});
    } catch (e) {}
  })();
  if (/[?&]nfc=1/.test(location.search)) setTimeout(doTag, 200);

  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  /* ══ 2. 출입증 ═══════════════════════════════ */
  function drawPasses() {
    $('#passBd').innerHTML =
      '<div class="who"><div class="nm">' + esc(ME.nm) + ' 님</div>'
      + '<div class="sub">주주번호 ' + ME.no + ' · ' + esc(ME.id) + '</div>'
      + '<div class="tags"><span class="tg">본인 확인 완료</span><span class="tg">NFC 태깅 ' + nowHM() + '</span></div></div>'
      + '<div class="plist"><div class="plb">오늘 참석 가능한 주주총회 ' + PASSES.length + '건</div>'
      + PASSES.map(function (p) {
          return '<div class="pcard' + (p.live ? '' : ' off') + '" role="button" tabindex="0" data-pass="' + p.key + '">'
            + '<div class="top"><div class="l1"><span class="co">' + esc(p.co) + '</span>'
            + '<span class="st' + (p.live ? ' live' : '') + '">' + (p.live ? '진행 중' : '예정') + '</span></div>'
            + '<div class="tm">' + esc(p.term) + ' · ' + esc(p.date) + '</div>'
            + '<div class="rows">'
            + '<div class="rw"><div class="k">보유 주식</div><div class="v">' + cm(p.sh) + '주</div></div>'
            + '<div class="rw"><div class="k">좌석</div><div class="v">' + esc(p.seat) + '</div></div>'
            + '</div></div>'
            + '<div class="tick"><span class="code">' + esc(p.code) + '</span>'
            + '<span class="go">' + (p.live ? '투표하기' : '대기 중') + '<i class="ph ph-caret-right"></i></span></div>'
            + '</div>';
        }).join('') + '</div>';

    $('#passBd').querySelectorAll('[data-pass]').forEach(function (c) {
      c.addEventListener('click', function () {
        var p = PASSES.filter(function (x) { return x.key === c.dataset.pass; })[0];
        if (!p.live) { toast(p.co + ' 주주총회는 아직 시작 전입니다'); return; }
        openVote(p);
      });
    });
  }
  function nowHM() {
    var d = new Date();
    function p(v) { return (v < 10 ? '0' : '') + v; }
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }
  $('#pvOut').addEventListener('click', function () {
    tagged = false;
    $('.nfc').classList.remove('done');
    $('#nfcHint').textContent = '태그를 기다리는 중…';
    $('#nfcGo').querySelector('.core i').className = 'ph ph-wifi-high';
    show('#scrNfc');
  });

  /* ══ 3·4. 투표 ═══════════════════════════════ */
  var LIVE = { ag: null, stage: 0, sec: null, done: null, ts: 0 };
  var lastOpen = null;                             /* 알림을 한 번만 띄우기 위한 표시 */

  function openVote(p) {
    CUR = p;
    $('#vTitle').textContent = p.co;
    passkeyWarmup();                               /* Face ID 가 바로 뜨도록 미리 등록해 둔다 */
    drawVote();
    show('#scrVote');
  }
  $('#vBack').addEventListener('click', function () { show('#scrPass'); });

  function drawVote() {
    if (!CUR) return;
    var A = agenda(), cur = LIVE.ag, i = idx(A, cur);
    /* 머리말 — 의안 진행 막대 */
    $('#vHead').innerHTML = '<div class="co">' + esc(CUR.co) + ' ' + esc(CUR.term) + '</div>'
      + '<div class="mt">좌석 ' + esc(CUR.seat) + ' · 행사 가능 ' + cm(ME.sh) + '주</div>'
      + '<div class="bar">' + A.map(function (a, n) {
          var st = doneOf(a.no) ? 'done' : (n === i ? 'cur' : '');
          return '<span class="' + st + '"></span>';
        }).join('') + '</div>';

    var body;
    if (!cur || LIVE.stage < 1) body = waitHtml('총회 시작을 기다리고 있습니다', '의장이 의안을 상정하면 투표가 열립니다.');
    else if (LIVE.stage === 1) body = waitHtml('의안 상정 중', esc(cur) + ' 안건을 상정하고 있습니다. 잠시만 기다려 주세요.');
    else if (LIVE.stage >= 2) body = voteHtml(A, i);

    $('#voteBd').innerHTML = '<div class="vbody">' + body + histHtml(A) + '</div>';
    bindVote();
  }
  function idx(A, no) { for (var i = 0; i < A.length; i++) if (A[i].no === no) return i; return -1; }
  function doneOf(no) { return LIVE.done && LIVE.done[no]; }

  function waitHtml(h, p) {
    return '<div class="wait"><div class="ic"><i class="ph ph-hourglass-medium"></i></div>'
      + '<h3>' + esc(h) + '</h3><p>' + p + '</p>'
      + '<div class="now"><div class="k">현재 진행</div><div class="v">'
      + (LIVE.ag ? esc(LIVE.ag) + ' · ' + esc(nameOf(LIVE.ag)) : '개회 전') + '</div></div></div>';
  }
  function nameOf(no) {
    var a = agenda().filter(function (x) { return x.no === no; })[0];
    return a ? a.nm : '';
  }

  function voteHtml(A, i) {
    var a = A[i]; if (!a) return waitHtml('대기 중', '진행 중인 의안이 없습니다.');
    var mine = myVote(a.no), res = doneOf(a.no);
    var h = '<div class="vcard"><div class="cat"><span class="no">' + esc(a.no) + '</span>'
      + (LIVE.stage === 2 && LIVE.sec ? '<span class="left" id="vLeft">남은 시간 ' + mmss(LIVE.sec) + '</span>' : '')
      + '</div>'
      + '<div class="nm">' + esc(a.nm) + '</div>'
      + '<div class="base">' + esc(agType(a)) + ' · 행사 주식 ' + cm(ME.sh) + '주</div>'
      + '<div class="mine"><span class="k">내 의결권</span><span class="v">' + cm(ME.sh) + '주</span>'
      + '<span class="k" style="margin-left:auto">지분율</span><span class="v">' + ME.rt + '%</span></div>';

    if (res) {
      h += '<div class="vres ' + (res === '가결' ? 'pass' : 'fail') + '">' + esc(res) + '</div>';
      if (mine) h += '<div class="vdone"><i class="ph-fill ph-check-circle"></i>' + esc(mine) + ' 행사 완료</div>';
    } else if (mine) {
      h += '<div class="vdone"><i class="ph-fill ph-check-circle"></i>' + esc(mine) + ' 행사가 완료되었습니다</div>';
      if (LIVE.stage === 3) h += '<div class="vres pass" style="background:#F1F2F4;color:#5B6070">집계 중입니다</div>';
    } else if (LIVE.stage === 2) {
      h += '<div class="choices" id="vCh">'
        + ['찬성', '반대', '기권'].map(function (c) {
            return '<button class="choice" type="button" data-c="' + c + '">'
              + '<i class="ph-fill ph-check-circle ck"></i>' + c + '</button>';
          }).join('') + '</div>'
        + '<button class="vgo" id="vGo" type="button" disabled>의결권 행사하기</button>';
    } else {
      h += '<div class="vres pass" style="background:#F1F2F4;color:#5B6070">표결이 마감되었습니다</div>';
    }
    return h + '</div>';
  }
  function mmss(n) { n = Math.max(0, n | 0); return Math.floor(n / 60) + ':' + (n % 60 < 10 ? '0' : '') + (n % 60); }

  function histHtml(A) {
    var rows = A.filter(function (a) { return doneOf(a.no) || myVote(a.no); });
    if (!rows.length) return '';
    return '<div class="hlist">' + rows.map(function (a) {
      var mv = myVote(a.no) || '미행사';
      return '<div class="hrow"><span class="no">' + esc(a.no) + '</span>'
        + '<span class="nm">' + esc(a.nm) + '</span>'
        + '<span class="mv ' + mv + '">' + mv + '</span></div>';
    }).join('') + '</div>';
  }

  function bindVote() {
    var pick = null, go = $('#vGo');
    $$('#vCh .choice').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#vCh .choice').forEach(function (o) { o.classList.remove('sel'); });
        b.classList.add('sel'); pick = b.dataset.c;
        if (go) go.disabled = false;
      });
    });
    if (go) go.addEventListener('click', function () {
      if (!pick) return;
      var a = agenda()[idx(agenda(), LIVE.ag)];
      faceAuth(function () {
        saveVote(a.no, pick);
        drawVote();
        toast(a.no + ' · ' + pick + ' 행사가 완료되었습니다');
        buzz(40);
      });
    });
  }

  /* ── Face ID — 기기 인증을 부르되 결과와 무관하게 진행한다 ─ */
  function passkeyWarmup() {
    /* 등록된 패스키가 없으면 인증 창이 바로 닫히므로 조용히 하나 만들어 둔다 */
    if (!window.PublicKeyCredential || sessionStorage.getItem('cx.pk')) return;
    hasBio(function (yes) { if (yes) mk(); });
    function mk() {
    try {
      navigator.credentials.create({
        publicKey: {
          challenge: rand(32),
          rp: { name: '현장투표' },
          user: { id: rand(16), name: ME.nm, displayName: ME.nm },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { userVerification: 'preferred' },
          timeout: 15000
        }
      }).then(function () { sessionStorage.setItem('cx.pk', '1'); }).catch(function () {});
    } catch (e) {}
    }
  }
  function rand(n) { var a = new Uint8Array(n); (crypto.getRandomValues || function () {})(a); return a; }
  /* 기기에 Face ID · 지문 같은 인증기가 있는지 먼저 물어본다 (1.2초 안에 답이 없으면 없는 것으로) */
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

  function faceAuth(done) {
    var ov = $('#faceOv'), box = ov.querySelector('.facebox');
    box.classList.remove('ok');
    $('#faceIc').innerHTML = '<i class="ph ph-scan"></i>';
    $('#faceT').textContent = 'Face ID';
    $('#faceD').textContent = '얼굴을 화면에 맞춰 주세요';
    ov.classList.add('on');

    finish.done = false;
    /* 기기에 생체인증기가 있을 때만 실제 인증 창을 부른다.
       없는 기기(데스크톱 등)에서 부르면 응답이 오지 않고 멈추므로 바로 화면만 보여 준다.
       실제로 불렀을 때는 성공·실패·취소 어느 쪽이든 똑같이 다음으로 넘어간다. */
    hasBio(function (yes) {
      if (!yes) { setTimeout(function () { finish(); }, 1300); return; }
      try {
        navigator.credentials.get({
          publicKey: { challenge: rand(32), userVerification: 'preferred', timeout: 20000 }
        }).then(finish, finish);
      } catch (e) { finish(); }
      setTimeout(finish, 22000);                            /* 최후 보루 */
    });

    function finish() {
      if (finish.done) return; finish.done = true;
      box.classList.add('ok');
      $('#faceIc').innerHTML = '<i class="ph-fill ph-check"></i>';
      $('#faceT').textContent = '인증 완료';
      $('#faceD').textContent = ME.nm + ' 님 본인 확인이 끝났습니다';
      buzz([20, 40, 20]);
      setTimeout(function () { ov.classList.remove('on'); done(); }, 850);
    }
  }

  /* ══ 현장 제어 신호 구독 ═════════════════════ */
  function apply(s) {
    if (!s || !s.ts) return;
    var was = LIVE.ag, wasStage = LIVE.stage;
    LIVE.ag = s.ag || null;
    LIVE.stage = isFinite(s.stage) ? +s.stage : 0;
    LIVE.sec = (s.sec == null ? null : +s.sec);
    LIVE.done = s.done || null;
    LIVE.ts = s.ts;

    /* 표결이 열리는 순간 한 번만 알린다 */
    var key = LIVE.ag + '/' + LIVE.stage;
    if (LIVE.stage === 2 && key !== lastOpen) {
      lastOpen = key;
      if (!myVote(LIVE.ag)) alertOpen(LIVE.ag + ' 표결이 시작되었습니다');
    }
    if (LIVE.stage !== 2) lastOpen = (LIVE.stage >= 3) ? lastOpen : null;

    if ($('#scrVote').classList.contains('on')) drawVote();
  }
  function alertOpen(msg) {
    var b = $('#alertBar');
    $('#alertTx').textContent = msg;
    b.classList.add('on');
    buzz([60, 80, 60, 80, 120]);
    beep();
    clearTimeout(alertOpen.t);
    alertOpen.t = setTimeout(function () { b.classList.remove('on'); }, 4200);
  }
  /* 짧은 알림음 — 오디오 파일 없이 만든다 */
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

  /* 현장 제어와 같은 칸(cx.live)을 본다. 다른 탭에서 쓴 값은 storage 이벤트로 들어오고,
     같은 탭에서 열어 둔 경우를 대비해 1초마다 한 번 더 확인한다. */
  function liveGet() {
    try { return JSON.parse(localStorage.getItem('cx.live') || '{}'); } catch (e) { return {}; }
  }
  apply(liveGet());
  window.addEventListener('storage', function (e) { if (e.key === 'cx.live') apply(liveGet()); });
  setInterval(function () { var s = liveGet(); if (s.ts && s.ts !== LIVE.ts) apply(s); }, 1000);
  /* 남은 표결 시간은 1초마다 스스로 줄인다 */
  setInterval(function () {
    if (LIVE.stage !== 2 || LIVE.sec == null) return;
    LIVE.sec = Math.max(0, LIVE.sec - 1);
    var el = $('#vLeft'); if (el) el.textContent = '남은 시간 ' + mmss(LIVE.sec);
  }, 1000);
})();
