/* 의결권 위임 플랫폼 (현장 파트너용) — 데이터 레이어
 *
 *  주주명부·의안은 CONEXUS 와 같은 정본(cx-roster.js · cx-data.js)을 그대로 쓴다.
 *  여기서는 "수집 대상"에 필요한 것만 덧붙인다 — 주소·좌표·방문 상태·거주 가능성.
 *  덧붙이는 값은 명부 순번에서 뽑으므로 새로 고쳐도 같은 사람은 같은 값을 갖는다.
 *
 *  앱에서 바꾼 상태(방문 예정 · 위임 완료 …)는 localStorage 'cx.collect' 한 칸에 쌓이고,
 *  CONEXUS 는 같은 오리진이라 그 칸을 그대로 읽어 실시간 주주 확보 현황에 반영한다.
 */
(function (global) {
  'use strict';

  var CX = global.CX || {};
  var APP = global.APP = {};

  /* ── 상태 ─────────────────────────────────────────────────────────── */
  APP.STATES = {
    plan:  { k: 'plan',  nm: '방문예정',   cls: 'blue'   },
    replan:{ k: 'replan',nm: '재방문예정', cls: 'orange' },
    no:    { k: 'no',    nm: '수집불가',   cls: 'red'    },
    done:  { k: 'done',  nm: '위임완료',   cls: 'green'  },
    fix:   { k: 'fix',   nm: '보완요청',   cls: 'purple' }
  };
  APP.STATE_ORDER = ['plan', 'replan', 'no', 'done', 'fix'];

  /* ── 주소 표본 ────────────────────────────────────────────────────────
     시연용 좌표는 실제 행정동 근처 값으로 흩뿌린다(파주 운정 · 고양 일산 · 서울 여의도). */
  var AREAS = [
    { zip: '10881', si: '경기도 파주시', dong: '와동동',   road: '소리천로',     lat: 37.7250, lng: 126.7660, apt: ['해솔마을 6단지', '가람마을 3단지', '한빛마을 1단지'] },
    { zip: '10390', si: '경기도 고양시 일산동구', dong: '백석동', road: '중앙로', lat: 37.6440, lng: 126.7880, apt: ['백송마을 3단지', '흰돌마을 5단지', '강선마을 2단지'] },
    { zip: '07330', si: '서울특별시 영등포구', dong: '여의도동', road: '국제금융로8길', lat: 37.5250, lng: 126.9250, apt: ['서울아파트', '시범아파트', '광장아파트'] },
    { zip: '06243', si: '서울특별시 강남구', dong: '역삼동',  road: '테헤란로',     lat: 37.5000, lng: 127.0360, apt: ['역삼래미안', '개나리래미안', '진달래아파트'] },
    { zip: '13561', si: '경기도 성남시 분당구', dong: '정자동', road: '불정로',    lat: 37.3670, lng: 127.1080, apt: ['정든마을 신화', '한솔마을 5단지', '느티마을 3단지'] },
    { zip: '22382', si: '인천광역시 중구', dong: '운서동',   road: '공항로',       lat: 37.4930, lng: 126.4930, apt: ['하늘도시 유승한내들', '영종자이', '풍림아이원'] }
  ];

  /* 순번에서 뽑는 난수 — 같은 순번이면 늘 같은 값 */
  function rnd(i, salt) {
    var x = Math.sin((i + 1) * 9301 + (salt || 0) * 49297) * 233280;
    return x - Math.floor(x);
  }
  function pick(arr, i, salt) { return arr[Math.floor(rnd(i, salt) * arr.length) % arr.length]; }

  function addrOf(i) {
    var a = AREAS[i % AREAS.length];
    var no = 10 + Math.floor(rnd(i, 3) * 180);
    var dong = 101 + Math.floor(rnd(i, 4) * 12);
    var ho = 101 + Math.floor(rnd(i, 5) * 20) * 10 + Math.floor(rnd(i, 6) * 4);
    return {
      zip: a.zip,
      full: a.si + ' ' + a.road + ' ' + no + ' ' + pick(a.apt, i, 7) + ' ' + dong + '동 ' + ho + '호',
      short: a.si + ' ' + a.dong,
      lat: a.lat + (rnd(i, 1) - 0.5) * 0.045,
      lng: a.lng + (rnd(i, 2) - 0.5) * 0.055
    };
  }

  /* 생년월일 · 성별 — 주주번호(마스킹) 앞자리에서 만들 수 없으니 순번으로 만든다 */
  function bornOf(i) {
    var y = 1948 + Math.floor(rnd(i, 11) * 52);
    var m = 1 + Math.floor(rnd(i, 12) * 12);
    var d = 1 + Math.floor(rnd(i, 13) * 28);
    function p(v) { return (v < 10 ? '0' : '') + v; }
    return { ymd: y + '-' + p(m) + '-' + p(d), age: 2026 - y, sex: rnd(i, 14) < 0.47 ? '남성' : '여성' };
  }

  /* 거주 가능성 — 명부 주소와 최근 우편물 반송 여부를 섞은 값(시연용) */
  function liveOf(i) {
    var v = rnd(i, 21);
    if (v > 0.72) return { k: 'high', nm: '거주 가능성 높음' };
    if (v > 0.30) return { k: 'mid',  nm: '거주 가능성 보통' };
    return { k: 'low', nm: '거주 가능성 낮음' };
  }

  /* ── 캠페인(주주총회) ──────────────────────────────────────────────── */
  var M = (CX.meeting || {});
  APP.CAMPAIGNS = [
    { id: 'c1', org: M.org || '큐더스전자', term: M.name || '제10기 정기주주총회',
      due: M.date || '2026-09-29', state: 'live',
      goalSh: 50, goalVt: 15000000 },
    /* 지난 캠페인은 마감된 실적을 그대로 보여 준다 */
    { id: 'c2', org: '아이알큐더스', term: '제 1기 정기주주총회', due: '2026-03-12', state: 'end',
      goalSh: 50, goalVt: 15000000, doneSh: 50, doneVt: 15420000 },
    { id: 'c3', org: '아이알큐더스', term: '제 1기 임시주주총회', due: '2026-02-20', state: 'end',
      goalSh: 50, goalVt: 15000000, doneSh: 44, doneVt: 13610000 }
  ];

  /* ── 수집 대상 만들기 ──────────────────────────────────────────────── */
  var SAVED = load();

  function baseState(i) {
    var v = rnd(i, 31);
    if (v > 0.86) return 'done';
    if (v > 0.74) return 'fix';
    if (v > 0.60) return 'no';
    if (v > 0.34) return 'replan';
    return 'plan';
  }

  function build() {
    /* 현장 방문 대상이라 국내 거주 개인 주주만 본다 */
    var R = (CX.roster || []).filter(function (r) { return r.gb === '개인' && /[가-힣]/.test(r.nm || ''); });
    if (!R.length) R = (CX.roster || []).filter(function (r) { return r.gb === '개인'; });
    if (!R.length) R = (CX.roster || []).slice();
    /* 현장에서 찾아갈 만한 규모 — 보유주식이 큰 개인부터 200명 */
    R = R.slice().sort(function (a, b) { return b.sh - a.sh; }).slice(0, 200);
    return R.map(function (r, i) {
      var ad = addrOf(r.i), bn = bornOf(r.i), lv = liveOf(r.i);
      var st = SAVED.st[r.i] || baseState(r.i);
      return {
        i: r.i, name: r.nm, sh: r.sh, rt: r.rt,
        org: APP.CAMPAIGNS[0].org, camp: 'c1',
        sex: bn.sex, born: bn.ymd, age: bn.age,
        tel: SAVED.tel[r.i] || '',
        zip: ad.zip, addr: ad.full, area: ad.short, lat: ad.lat, lng: ad.lng,
        live: lv, st: st,
        memo: SAVED.memo[r.i] || '',
        at: SAVED.at[r.i] || ''
      };
    });
  }

  /* ── 저장 — CONEXUS 와 같은 칸(cx.collect)을 쓴다 ───────────────────── */
  var KEY = 'cx.collect';
  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    return { st: s.st || {}, memo: s.memo || {}, tel: s.tel || {}, at: s.at || {} };
  }
  function save() {
    var s = { st: SAVED.st, memo: SAVED.memo, tel: SAVED.tel, at: SAVED.at, ts: Date.now() };
    /* CONEXUS 가 바로 쓰도록 확보 합계도 함께 적어 둔다 */
    var done = APP.list().filter(function (x) { return x.st === 'done'; });
    s.done = done.length;
    s.doneShares = done.reduce(function (a, x) { return a + x.sh; }, 0);
    s.rows = done.slice(0, 60).map(function (x) {
      return { i: x.i, nm: x.name, sh: x.sh, at: x.at, addr: x.area };
    });
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('cx-collect', { detail: s })); } catch (e) {}
  }

  var LIST = null;
  APP.list = function () { if (!LIST) LIST = build(); return LIST; };
  APP.find = function (i) {
    var out = null;
    APP.list().forEach(function (x) { if (String(x.i) === String(i)) out = x; });
    return out;
  };
  APP.setState = function (i, st) {
    var x = APP.find(i); if (!x) return;
    x.st = st; SAVED.st[x.i] = st;
    x.at = new Date().toISOString().slice(0, 16).replace('T', ' ');
    SAVED.at[x.i] = x.at;
    save();
  };
  APP.setMemo = function (i, t) { var x = APP.find(i); if (!x) return; x.memo = t; SAVED.memo[x.i] = t; save(); };
  APP.setTel  = function (i, t) { var x = APP.find(i); if (!x) return; x.tel  = t; SAVED.tel[x.i]  = t; save(); };

  /* 수집현황 — 캠페인별 확보 주주 수 · 주식수 */
  APP.stat = function (campId) {
    var L = APP.list().filter(function (x) { return x.camp === campId; });
    var done = L.filter(function (x) { return x.st === 'done'; });
    var c = null; APP.CAMPAIGNS.forEach(function (x) { if (x.id === campId) c = x; });
    var gSh = (c && c.goalSh) || 50, gVt = (c && c.goalVt) || 15000000;
    var vt = done.reduce(function (a, x) { return a + x.sh; }, 0);
    if (c && c.state === 'end') {
      return { sh: c.doneSh, goalSh: gSh, vt: c.doneVt, goalVt: gVt,
        pct: Math.min(100, Math.round(Math.min(c.doneSh / gSh, c.doneVt / gVt) * 100)) };
    }
    /* 달성률은 주주 수·주식 수 둘 다 본다 — 낮은 쪽이 실제 진척이다 */
    var p1 = gSh ? done.length / gSh : 0, p2 = gVt ? vt / gVt : 0;
    return {
      sh: done.length, goalSh: gSh,
      vt: vt, goalVt: gVt,
      pct: Math.min(100, Math.round(Math.min(p1, p2) * 100))
    };
  };

  /* 로그인 — 시연이라 아이디만 기억한다 */
  APP.auth = {
    get: function () { try { return JSON.parse(localStorage.getItem('cx.app.auth') || 'null'); } catch (e) { return null; } },
    set: function (id, keep) {
      try { localStorage.setItem('cx.app.auth', JSON.stringify({ id: id, at: Date.now() })); } catch (e) {}
      try { keep ? localStorage.setItem('cx.app.id', id) : localStorage.removeItem('cx.app.id'); } catch (e) {}
    },
    savedId: function () { try { return localStorage.getItem('cx.app.id') || ''; } catch (e) { return ''; } },
    out: function () { try { localStorage.removeItem('cx.app.auth'); } catch (e) {} }
  };

  /* 지도 딥링크 — 앱이 깔려 있으면 앱으로, 아니면 웹으로 열린다 */
  APP.mapLinks = function (x) {
    var q = encodeURIComponent(x.addr), nm = encodeURIComponent(x.name + ' 주주');
    return {
      naver:  'https://map.naver.com/p/search/' + q,
      google: 'https://www.google.com/maps/search/?api=1&query=' + x.lat + ',' + x.lng,
      route:  'https://map.naver.com/p/directions/-/' + x.lng + ',' + x.lat + ',' + nm + '/-/car'
    };
  };
})(window);
