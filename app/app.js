/* 의결권 위임 플랫폼 — 현장 파트너 앱 */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cm(n) { return (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR'); }
  var ST = APP.STATES;

  /* ── 토스트 ─────────────────────────────────── */
  var tTimer = null;
  function toast(t, ok) {
    var el = $('#toastT'); el.textContent = t;
    el.classList.toggle('ok', !!ok);
    el.classList.add('on');
    clearTimeout(tTimer); tTimer = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  /* ── 화면 이동 ──────────────────────────────── */
  var TABS = { list: '#scrList', stat: '#scrStat', news: '#scrNews', set: '#scrSet' };
  var curTab = 'list', backTo = 'list';
  function show(sel) {
    $$('.scr').forEach(function (s) { s.classList.toggle('on', '#' + s.id === sel); });
    var tabbar = $('#tabbar');
    var isTab = Object.keys(TABS).some(function (k) { return TABS[k] === sel; });
    tabbar.hidden = !isTab;
    if (isTab) {
      /* 아이콘 모양은 그대로 두고 색만 바꾼다 */
      $$('#tabbar button').forEach(function (b) {
        b.classList.toggle('on', TABS[b.dataset.tab] === sel);
      });
    }
  }
  function goTab(k) {
    curTab = k; show(TABS[k]);
    if (k === 'list') { MAPMODE ? (show(TABS.list), drawChips(), setTimeout(function(){ resize(); paintMarkers(); }, 60)) : drawList(); }
    if (k === 'stat') drawStat();
    if (k === 'news') drawNews();
    if (k === 'set') drawSet();
  }
  $$('#tabbar button').forEach(function (b) { b.addEventListener('click', function () { goTab(b.dataset.tab); }); });

  /* ── 오버레이 ───────────────────────────────── */
  function sheet(o) {
    var ov = $('#ov'), bx = $('#ovBx');
    ov.classList.toggle('mid', !!o.mid);
    bx.innerHTML = '<div class="bh">'
      + (o.back ? '<button class="bk2" type="button" data-ovback><i class="ph ph-arrow-left"></i></button>' : '')
      + '<b>' + esc(o.title) + '</b>'
      + (o.x === false ? '' : '<button class="x" type="button" data-ovx><i class="ph ph-x"></i></button>') + '</div>'
      + '<div class="bb">' + (o.body || '') + '</div>'
      + (o.foot ? '<div class="bf">' + o.foot + '</div>' : '');
    ov.classList.add('on');
    bx.querySelectorAll('[data-ovx]').forEach(function (b) { b.addEventListener('click', closeSheet); });
    if (o.back) bx.querySelectorAll('[data-ovback]').forEach(function (b) {
      b.addEventListener('click', function () { closeSheet(); o.back(); });
    });
    if (o.after) o.after(bx);
  }
  function closeSheet() { $('#ov').classList.remove('on'); }
  $('#ov').addEventListener('click', function (e) { if (e.target === $('#ov')) closeSheet(); });
  function todo() { /* 시연 범위 밖 화면 — 아무 것도 하지 않는다 */ }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-help]'); if (b) todo(b.dataset.help);
  });

  /* ══ 로그인 ══════════════════════════════════ */
  (function () {
    var id = $('#lgId'), pw = $('#lgPw'), go = $('#lgGo'), cb = $('#lgSaveCb');
    var saved = APP.auth.savedId();
    if (saved) { id.value = saved; cb.classList.add('on'); }
    function chk() { go.disabled = !(id.value.trim() && pw.value.trim()); }
    id.addEventListener('input', chk); pw.addEventListener('input', chk); chk();
    $('#lgSave').addEventListener('click', function () { cb.classList.toggle('on'); });
    $('#lgEye').addEventListener('click', function () {
      var on = pw.type === 'password';
      pw.type = on ? 'text' : 'password';
      this.querySelector('i').className = on ? 'ph ph-eye' : 'ph ph-eye-slash';
    });
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !go.disabled) go.click(); });
    go.addEventListener('click', function () {
      APP.auth.set(id.value.trim(), cb.classList.contains('on'));
      goTab('list'); toast(id.value.trim() + ' 님, 오늘도 화이팅!');
    });
    if (APP.auth.get()) setTimeout(function () { goTab('list'); }, 0);
  })();

  /* ══ 수집 — 주주 목록 ════════════════════════ */
  var F = { st: [], bookOnly: false, q: '', sort: 'live' };
  var BOOK = (function () { try { return JSON.parse(localStorage.getItem('cx.app.book') || '[]'); } catch (e) { return []; } })();
  function saveBook() { try { localStorage.setItem('cx.app.book', JSON.stringify(BOOK)); } catch (e) {} }

  function drawChips() {
    var c = $('#chips');
    var x = '<span class="x"><i class="ph ph-x"></i></span>';
    var html = '<button class="chip act" data-act="detail" type="button"><i class="ph ph-sliders-horizontal"></i>상세</button>'
      + '<button class="chip" data-act="book" type="button">관심 주주'
      + (F.bookOnly ? x : '') + '</button>';
    ADV.co.forEach(function (n) {
      html += '<button class="chip" data-co="' + esc(n) + '" type="button">' + esc(n) + x + '</button>';
    });
    /* 적용된 진행상태만 지울 수 있는 칩으로 — 조건 추가는 '상세'에서 */
    ST_FILTER.forEach(function (k) {
      if (F.st.indexOf(k) < 0) return;
      html += '<button class="chip" data-st="' + k + '" type="button">' + ST[k].nm + x + '</button>';
    });
    c.innerHTML = html;
    c.querySelectorAll('[data-st]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.st, i = F.st.indexOf(k);
        if (i >= 0) F.st.splice(i, 1); else F.st.push(k);
        ADV.st = F.st.slice();
        refresh();
      });
    });
    c.querySelector('[data-act="book"]').addEventListener('click', function () { F.bookOnly = !F.bookOnly; refresh(); });
    c.querySelectorAll('[data-co]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = ADV.co.indexOf(b.dataset.co);
        if (i >= 0) ADV.co.splice(i, 1);
        refresh();
      });
    });
    c.querySelector('[data-act="detail"]').addEventListener('click', openAdvFilter);
  }

  /* ══ 상세 조건 설정 ══════════════════════════ */
  var MAXSH = 0;
  function maxSh() {
    if (!MAXSH) APP.list().forEach(function (x) { if (x.sh > MAXSH) MAXSH = x.sh; });
    return MAXSH;
  }
  /* 화면에서 만지는 값 — '조건 적용하기'를 눌러야 F 로 옮겨 간다 */
  function blankAdv() {
    return { co: [], st: [], si: '', gu: '', live: [],
      shMode: 'sh', shFrom: 0, shTo: 0,     /* 보유주식수 */
      rtFrom: 0, rtTo: 0,                   /* 지분율 % */
      gbs: [], sex: [], ageFrom: '', ageTo: '', bld: [] };
  }
  var MAXRT = 0;
  function maxRt() {
    if (!MAXRT) APP.list().forEach(function (x) { if (x.rt > MAXRT) MAXRT = x.rt; });
    return Math.ceil(MAXRT * 1000) / 1000;
  }
  var ADV = blankAdv(), DRAFT = null, OPEN = {};

  /* 방문 진행상태 필터에 쓰는 상태 — 보완요청은 처리 결과라 여기서는 빼둔다 */
  var ST_FILTER = ['plan', 'replan', 'no', 'done'];

  function guList() { return (APP.REGION[DRAFT.si] || []).slice(); }

  /* 값 하나를 고르는 바텀 시트 — 시스템 select 대신 쓴다 */
  function pickSheet(title, items, cur, onPick) {
    var q = '';
    function body(bx) {
      var L = items.filter(function (n) { return !q || n.indexOf(q) >= 0; });
      bx.querySelector('.bb').innerHTML =
        (items.length > 12
          ? '<div class="srch" style="padding:0 0 10px"><div class="wrap"><i class="ph ph-magnifying-glass"></i>'
            + '<input id="pkQ" placeholder="검색" value="' + esc(q) + '"></div></div>' : '')
        + '<div class="colist">'
        + (L.length ? L.map(function (n) {
            return '<div class="corow' + (n === cur ? ' on' : '') + '" role="button" tabindex="0" data-pk="' + esc(n) + '">'
              + '<span class="sp2">' + esc(n) + '</span>'
              + (n === cur ? '<i class="ph ph-check"></i>' : '') + '</div>';
          }).join('') : '<div class="empty" style="padding:36px 0">결과가 없습니다</div>')
        + '</div>';
      bx.querySelectorAll('[data-pk]').forEach(function (r) {
        r.addEventListener('click', function () { onPick(r.dataset.pk); closeSheet(); });
      });
      var qi = bx.querySelector('#pkQ');
      if (qi) qi.addEventListener('input', function () { q = this.value; body(bx); bx.querySelector('#pkQ').focus(); });
    }
    sheet({
      title: title, body: '',
      foot: '<button class="btn gh" type="button" id="pkClr">선택 안 함</button>',
      after: function (bx) {
        body(bx);
        bx.querySelector('#pkClr').addEventListener('click', function () { onPick(''); closeSheet(); });
      }
    });
  }

  function chipRow(key, all, items, multi, label) {
    var cur = DRAFT[key];
    var on = multi ? !cur.length : !cur;
    var h = '<button class="opt2' + (on ? ' on' : '') + '" type="button" data-fk="' + key + '" data-fv="">' + all + '</button>';
    items.forEach(function (v) {
      var sel = multi ? cur.indexOf(v) >= 0 : cur === v;
      h += '<button class="opt2' + (sel ? ' on' : '') + '" type="button" data-fk="' + key + '" data-fv="' + esc(v) + '">'
        + esc(label ? label(v) : v) + '</button>';
    });
    return '<div class="opts">' + h + '</div>';
  }

  function FSECS() {
    var mx = maxSh();
    return [
      { k: 'co', t: '기업 선택', d: '조회할 대상 기업을 선택해 주세요.',
        sum: DRAFT.co.length ? DRAFT.co.join(', ') : '',
        body: coBody() },
      { k: 'st', t: '방문 진행상태', d: '방문할 대상의 진행상태를 선택해주세요.',
        sum: DRAFT.st.map(function (v) { return ST[v].nm; }).join(', '),
        body: chipRow('st', '전체', ST_FILTER, true, function (v) { return ST[v].nm; }) },
      { k: 'area', t: '주주 거주 지역', d: '조회할 지역을 선택해 주세요.',
        sum: [DRAFT.si, DRAFT.gu].filter(Boolean).join(' '),
        body: '<div class="f2">'
          + '<button class="fsel' + (DRAFT.si ? '' : ' ph') + '" type="button" id="fSi">'
          + esc(DRAFT.si || '지역 선택') + '</button>'
          + '<button class="fsel' + (DRAFT.gu ? '' : ' ph') + '" type="button" id="fGu"'
          + (DRAFT.si ? '' : ' disabled') + '>' + esc(DRAFT.gu || '시/군/구 선택') + '</button></div>' },
      { k: 'live', t: '실거주 가능성', d: '실거주 가능성을 선택해 주세요. \'높음\'은 집으로 방문해 주세요.',
        sum: DRAFT.live.join(', '),
        body: chipRow('live', '전체', ['높음', '보통', '낮음'], true) },
      { k: 'sh', t: '보유 주식', d: '주주가 보유한 주식 수 또는 지분율의 범위를 지정해 주세요.',
        sum: shSum(mx), body: shBody(mx) },
      { k: 'gb', t: '주주 유형', d: '개인 및 법인 주주를 구분하여 검색할 수 있습니다.',
        sum: DRAFT.gbs.join(', '),
        body: chipRow('gbs', '전체', ['개인', '법인'], true) },
      { k: 'bld', t: '건물 유형', d: '단독주택 또는 아파트 등 거주 중인 건물 형태를 선택해 주세요.',
        sum: DRAFT.bld.join(', '),
        body: chipRow('bld', '전체', ['집합건물', '단독건물'], true) }
    ];
  }
  /* 기업 선택 — 체크 목록 */
  function coBody() {
    var L = APP.liveCompanies(), all = L.length && L.every(function (c) { return DRAFT.co.indexOf(c) >= 0; });
    return '<div class="fchk"><button class="r" type="button" data-coall>'
      + '<span class="cb' + (all ? ' on' : '') + '"></span><span class="t">전체선택</span></button>'
      + L.map(function (c) {
          return '<button class="r" type="button" data-co="' + esc(c) + '">'
            + '<span class="cb' + (DRAFT.co.indexOf(c) >= 0 ? ' on' : '') + '"></span>'
            + '<span class="t">' + esc(c) + '</span></button>';
        }).join('') + '</div>';
  }

  /* 보유 주식 — 보유주식수 · 지분율 두 방식을 같은 모양으로 쓴다 */
  function pc(v) { return (Math.round(v * 10000) / 10000) + ''; }
  function shSum(mx) {
    if (DRAFT.shMode === 'rt') {
      if (!DRAFT.rtFrom && !DRAFT.rtTo) return '';
      return pc(DRAFT.rtFrom) + '% ~ ' + pc(DRAFT.rtTo || maxRt()) + '%';
    }
    if (!DRAFT.shFrom && !DRAFT.shTo) return '';
    return cm(DRAFT.shFrom) + ' ~ ' + cm(DRAFT.shTo || mx) + '주';
  }
  function shBody(mx) {
    var rt = DRAFT.shMode === 'rt', mr = maxRt();
    var seg = '<div class="seg2">'
      + '<button type="button" data-shm="sh"' + (rt ? '' : ' class="on"') + '>보유주식수</button>'
      + '<button type="button" data-shm="rt"' + (rt ? ' class="on"' : '') + '>지분율</button></div>';
    if (rt) {
      return seg
        + '<div class="rng"><input type="range" id="fRtR" min="0" max="' + mr + '" step="0.0001" value="' + (DRAFT.rtTo || mr) + '">'
        + '<div class="lb"><span>0%</span><span>' + pc(mr) + '%</span></div></div>'
        + '<div class="f2"><div class="unit"><input class="finp" id="fRtA" inputmode="decimal" placeholder="0" value="' + (DRAFT.rtFrom || '') + '"><span>%</span></div>'
        + '<div class="unit"><input class="finp" id="fRtB" inputmode="decimal" placeholder="N (Max)" value="' + (DRAFT.rtTo || '') + '"><span>%</span></div></div>';
    }
    return seg
      + '<div class="rng"><input type="range" id="fShR" min="0" max="' + mx + '" step="1000" value="' + (DRAFT.shTo || mx) + '">'
      + '<div class="lb"><span>0</span><span>' + cm(mx) + '</span></div></div>'
      + '<div class="f2"><div class="unit"><input class="finp" id="fShA" inputmode="numeric" placeholder="0" value="' + (DRAFT.shFrom || '') + '"><span>주</span></div>'
      + '<div class="unit"><input class="finp" id="fShB" inputmode="numeric" placeholder="N (Max)" value="' + (DRAFT.shTo || '') + '"><span>주</span></div></div>';
  }

  /* 연령대 — 양쪽 손잡이 슬라이더 */
  var AGE_MIN = 20, AGE_MAX = 90;
  function ageLo() { return DRAFT.ageFrom || AGE_MIN; }
  function ageHi() { return DRAFT.ageTo || AGE_MAX; }
  function ageLabel() {
    if (!DRAFT.ageFrom && !DRAFT.ageTo) return '전체 연령';
    return ageLo() + '세 ~ ' + (ageHi() >= AGE_MAX ? AGE_MAX + '세 이상' : ageHi() + '세');
  }
  function ageSlider() {
    var lo = ageLo(), hi = ageHi(), span = AGE_MAX - AGE_MIN;
    var l = (lo - AGE_MIN) / span * 100, r = 100 - (hi - AGE_MIN) / span * 100;
    return '<div class="drng" id="fAgeW" style="margin-top:6px">'
      + '<div class="trk"><div class="fill" style="left:' + l + '%;right:' + r + '%"></div></div>'
      + '<input type="range" id="fAgeA" min="' + AGE_MIN + '" max="' + AGE_MAX + '" step="1" value="' + lo + '">'
      + '<input type="range" id="fAgeB" min="' + AGE_MIN + '" max="' + AGE_MAX + '" step="1" value="' + hi + '">'
      + '<div class="lb"><span>' + AGE_MIN + '세</span><b id="fAgeT">' + ageLabel() + '</b><span>' + AGE_MAX + '세+</span></div>'
      + '</div>';
  }

  var FTAB = 'co';
  function drawFilter() {
    var el = $('#flAcc'), secs = FSECS();
    if (!secs.some(function (x) { return x.k === FTAB; })) FTAB = secs[0].k;
    var cur = secs.filter(function (x) { return x.k === FTAB; })[0];
    el.innerHTML = '<div class="ftabs" id="fTabs">'
      + secs.map(function (x) {
          return '<button type="button" data-ft="' + x.k + '"' + (x.k === FTAB ? ' class="on"' : '') + '>' + x.t + '</button>';
        }).join('') + '</div>'
      + '<div class="fpane"><div class="fd">' + esc(cur.sum || cur.d) + '</div>' + cur.body + '</div>';

    dragScroll($('#fTabs'));
    el.querySelectorAll('[data-ft]').forEach(function (b) {
      b.addEventListener('click', function () {
        FTAB = b.dataset.ft; drawFilter();
        var t = $('#fTabs'), on = t && t.querySelector('.on');
        if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
      });
    });
    el.querySelectorAll('[data-co]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.co, i = DRAFT.co.indexOf(v);
        if (i >= 0) DRAFT.co.splice(i, 1); else DRAFT.co.push(v);
        drawFilter();
      });
    });
    (function () {
      var b = el.querySelector('[data-coall]'); if (!b) return;
      b.addEventListener('click', function () {
        var L = APP.liveCompanies();
        DRAFT.co = L.every(function (c) { return DRAFT.co.indexOf(c) >= 0; }) ? [] : L.slice();
        drawFilter();
      });
    })();
    el.querySelectorAll('[data-fk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.fk, v = b.dataset.fv;
        if (!v) DRAFT[k] = [];
        else {
          var i = DRAFT[k].indexOf(v);
          if (i >= 0) DRAFT[k].splice(i, 1); else DRAFT[k].push(v);
        }
        drawFilter();
      });
    });
    bind('#fSi', 'click', function () {
      pickSheet('지역 선택', APP.SIDO, DRAFT.si, function (v) {
        if (DRAFT.si !== v) DRAFT.gu = '';
        DRAFT.si = v; drawFilter();
      });
    });
    bind('#fGu', 'click', function () {
      if (!DRAFT.si) { toast('지역을 먼저 선택해 주세요'); return; }
      pickSheet(DRAFT.si, guList(), DRAFT.gu, function (v) { DRAFT.gu = v; drawFilter(); });
    });
    /* 연령대 슬라이더 — 두 손잡이가 서로를 넘지 않게 */
    (function () {
      var w = el.querySelector('#fAgeW'); if (!w) return;
      var a = w.querySelector('#fAgeA'), b = w.querySelector('#fAgeB');
      var fill = w.querySelector('.fill'), lab = w.querySelector('#fAgeT');
      function sync(from) {
        var lo = +a.value, hi = +b.value;
        if (lo > hi) { if (from === 'a') { hi = lo; b.value = hi; } else { lo = hi; a.value = lo; } }
        DRAFT.ageFrom = lo === AGE_MIN ? '' : lo;
        DRAFT.ageTo = hi === AGE_MAX ? '' : hi;
        var span = AGE_MAX - AGE_MIN;
        fill.style.left = (lo - AGE_MIN) / span * 100 + '%';
        fill.style.right = 100 - (hi - AGE_MIN) / span * 100 + '%';
        lab.textContent = ageLabel();
      }
      a.addEventListener('input', function () { sync('a'); });
      b.addEventListener('input', function () { sync('b'); });
      /* 손잡이가 겹쳤을 때 가까운 쪽을 잡도록 */
      w.addEventListener('pointerdown', function (e) {
        var r = w.getBoundingClientRect();
        var v = AGE_MIN + (e.clientX - r.left) / r.width * (AGE_MAX - AGE_MIN);
        var near = Math.abs(v - +a.value) <= Math.abs(v - +b.value);
        a.style.zIndex = near ? 4 : 3; b.style.zIndex = near ? 3 : 4;
      });
    })();
    bind('#fShR', 'input', function () { DRAFT.shTo = +this.value; el.querySelector('#fShB').value = this.value; });
    bind('#fShA', 'input', function () { DRAFT.shFrom = parseInt(this.value.replace(/\D/g, ''), 10) || 0; });
    bind('#fShB', 'input', function () { DRAFT.shTo = parseInt(this.value.replace(/\D/g, ''), 10) || 0; });
    bind('#fRtR', 'input', function () { DRAFT.rtTo = +this.value; el.querySelector('#fRtB').value = this.value; });
    bind('#fRtA', 'input', function () { DRAFT.rtFrom = parseFloat(this.value.replace(/[^0-9.]/g, '')) || 0; });
    bind('#fRtB', 'input', function () { DRAFT.rtTo = parseFloat(this.value.replace(/[^0-9.]/g, '')) || 0; });
    el.querySelectorAll('[data-shm]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (DRAFT.shMode === b.dataset.shm) return;
        DRAFT.shMode = b.dataset.shm;
        /* 방식을 바꾸면 반대쪽 조건은 비운다 — 두 조건이 겹치지 않게 */
        if (DRAFT.shMode === 'rt') { DRAFT.shFrom = DRAFT.shTo = 0; }
        else { DRAFT.rtFrom = DRAFT.rtTo = 0; }
        drawFilter();
      });
    });
    bind('#fCo', 'click', openCoSheet);
    function bind(sel, ev, fn) { var e = el.querySelector(sel); if (e) e.addEventListener(ev, fn); }
  }

  function openCoSheet() {
    var pick = DRAFT.co.slice(), q = '';
    function body() {
      var L = APP.liveCompanies().filter(function (n) { return !q || n.indexOf(q) >= 0; });
      return '<div class="srch" style="padding:0 0 12px"><div class="wrap">'
        + '<i class="ph ph-magnifying-glass"></i><input id="coQ" placeholder="기업명 검색" value="' + esc(q) + '"></div></div>'
        + '<div class="colist">' + L.map(function (n) {
          return '<div class="corow" role="button" tabindex="0" data-co="' + esc(n) + '">'
            + '<span class="cb rd' + (pick.indexOf(n) >= 0 ? ' on' : '') + '"></span>' + esc(n) + '</div>';
        }).join('') + '</div>'
        + '<button class="coclr" type="button" id="coClr"><i class="ph ph-arrow-counter-clockwise"></i>선택 초기화</button>';
    }
    function paint(bx) {
      bx.querySelector('.bb').innerHTML = body();
      bx.querySelectorAll('[data-co]').forEach(function (r) {
        r.addEventListener('click', function () {
          var n = r.dataset.co, i = pick.indexOf(n);
          if (i >= 0) pick.splice(i, 1); else pick.push(n);
          r.querySelector('.cb').classList.toggle('on', pick.indexOf(n) >= 0);
        });
      });
      var qi = bx.querySelector('#coQ');
      qi.addEventListener('input', function () { q = this.value; paint(bx); bx.querySelector('#coQ').focus(); });
      bx.querySelector('#coClr').addEventListener('click', function () { pick = []; paint(bx); });
    }
    sheet({
      title: '기업 선택', body: '',
      foot: '<button class="btn gh" type="button" id="coAll">전체 선택</button>'
        + '<button class="btn" type="button" id="coOk">선택 완료</button>',
      after: function (bx) {
        paint(bx);
        bx.querySelector('#coAll').addEventListener('click', function () { pick = APP.liveCompanies(); paint(bx); });
        bx.querySelector('#coOk').addEventListener('click', function () {
          DRAFT.co = pick; closeSheet(); drawFilter();
        });
      }
    });
  }

  function openAdvFilter() {
    DRAFT = JSON.parse(JSON.stringify(ADV));
    drawFilter();
    show('#scrFilter'); $('#tabbar').hidden = true;
  }
  $('#flBack').addEventListener('click', function () { goTab('list'); });
  $('#flReset').addEventListener('click', function () { DRAFT = blankAdv(); drawFilter(); });
  $('#flApply').addEventListener('click', function () {
    ADV = JSON.parse(JSON.stringify(DRAFT));
    F.st = ADV.st.slice();                 /* 상태는 상단 칩과 같이 움직인다 */
    goTab('list'); refresh();
    toast('조건을 적용했습니다 — ' + cm(filtered().length) + '건');
  });

  /* 상세 조건이 실제로 목록을 거르는 곳 */
  function advPass(x) {
    var a = ADV;
    if (a.co.length && a.co.indexOf(x.org) < 0) return false;
    if (a.si && x.area.indexOf(a.si) < 0) return false;
    if (a.gu && x.area.indexOf(a.gu) < 0) return false;
    if (a.live.length && a.live.indexOf(x.live.nm.replace('거주 가능성 ', '')) < 0) return false;
    if (a.shMode === 'rt') {
      if (a.rtFrom && x.rt < a.rtFrom) return false;
      if (a.rtTo && x.rt > a.rtTo) return false;
    } else {
      if (a.shFrom && x.sh < a.shFrom) return false;
      if (a.shTo && x.sh > a.shTo) return false;
    }
    if (a.gbs.length && a.gbs.indexOf(x.gb) < 0) return false;
    if (a.sex.length && a.sex.indexOf(x.sex) < 0) return false;
    if (a.ageFrom && x.age < a.ageFrom) return false;
    if (a.ageTo && x.age > a.ageTo) return false;
    if (a.bld.length && a.bld.indexOf(x.bld) < 0) return false;
    return true;
  }

  function openDetailFilter() {
    var body = '<div style="padding:4px 0 8px">'
      + APP.STATE_ORDER.map(function (k) {
        return '<button class="opt" type="button" data-fst="' + k + '"><span class="cb' + (F.st.indexOf(k) >= 0 ? ' on' : '') + '"></span>'
          + '<span class="sp">' + ST[k].nm + '</span>'
          + '<span class="bg ' + ST[k].cls + '">' + cnt(k) + '</span></button>';
      }).join('')
      + '<button class="opt" type="button" data-fbook><span class="cb' + (F.bookOnly ? ' on' : '') + '"></span>'
      + '<span class="sp">관심 주주만 보기</span><span class="bg gray">' + BOOK.length + '</span></button>'
      + '</div>';
    sheet({
      title: '상세 필터', body: body,
      foot: '<button class="btn gh" type="button" data-clr>초기화</button><button class="btn" type="button" data-ovx>적용</button>',
      after: function (bx) {
        bx.querySelectorAll('[data-fst]').forEach(function (b) {
          b.addEventListener('click', function () {
            var k = b.dataset.fst, i = F.st.indexOf(k);
            if (i >= 0) F.st.splice(i, 1); else F.st.push(k);
            b.querySelector('.cb').classList.toggle('on', F.st.indexOf(k) >= 0); refresh();
          });
        });
        bx.querySelector('[data-fbook]').addEventListener('click', function (e) {
          F.bookOnly = !F.bookOnly;
          e.currentTarget.querySelector('.cb').classList.toggle('on', F.bookOnly); refresh();
        });
        bx.querySelector('[data-clr]').addEventListener('click', function () {
          F.st = []; F.bookOnly = false; F.q = ''; $('#q').value = ''; $('#qClr').hidden = true; refresh(); closeSheet();
        });
      }
    });
  }
  function cnt(k) { return APP.list().filter(function (x) { return x.st === k; }).length; }

  function filtered() {
    var q = F.q.trim().toLowerCase();
    var L = APP.list().filter(function (x) {
      if (F.st.length && F.st.indexOf(x.st) < 0) return false;
      if (F.bookOnly && BOOK.indexOf(x.i) < 0) return false;
      if (q && (x.name + ' ' + x.addr + ' ' + x.zip + ' ' + x.born).toLowerCase().indexOf(q) < 0) return false;
      if (!advPass(x)) return false;
      return true;
    });
    var LVW = { '거주 가능성 높음': 0, '거주 가능성 보통': 1, '거주 가능성 낮음': 2 };
    /* 담당 구역 기준점 — 여의도역 */
    function ydist(x) {
      var dy = (x.lat - 37.52156) * 111, dx = (x.lng - 126.92430) * 88;
      return Math.sqrt(dy * dy + dx * dx);
    }
    function dueOf(x) {
      var c = (APP.CAMPAIGNS || []).filter(function (c) { return c.id === x.camp; })[0];
      return c ? c.due : '9999-12-31';
    }
    if (F.sort === 'sh') L.sort(function (a, b) { return b.sh - a.sh; });
    else if (F.sort === 'due') L.sort(function (a, b) {
      var d = String(dueOf(a)).localeCompare(String(dueOf(b)));
      return d || (b.sh - a.sh);
    });
    else L.sort(function (a, b) {                       /* 거주 가능성 높은 순 — 끝난 건은 뒤로, 같으면 여의도역에서 가까운 순 */
      var da = (a.st === 'done' ? 1 : 0) - (b.st === 'done' ? 1 : 0);
      if (da) return da;
      var d = (LVW[a.live.nm] == null ? 3 : LVW[a.live.nm]) - (LVW[b.live.nm] == null ? 3 : LVW[b.live.nm]);
      return d || (ydist(a) - ydist(b));
    });
    return L;
  }

  var SORTS = [{ k: 'live', nm: '거주 가능성 높은 순' }, { k: 'due', nm: '권유일 임박 순' }, { k: 'sh', nm: '보유 주식 많은 순' }];
  $('#btnSort').addEventListener('click', function () {
    sheet({
      title: '정렬', body: '<div style="padding:4px 0 8px">' + SORTS.map(function (s) {
        return '<button class="opt" type="button" data-srt="' + s.k + '"><span class="cb rd' + (F.sort === s.k ? ' on' : '') + '"></span><span class="sp">' + s.nm + '</span></button>';
      }).join('') + '</div>',
      after: function (bx) {
        bx.querySelectorAll('[data-srt]').forEach(function (b) {
          b.addEventListener('click', function () { F.sort = b.dataset.srt; closeSheet(); refresh(); });
        });
      }
    });
  });
  $('#q').addEventListener('input', function () {
    F.q = this.value; $('#qClr').hidden = !this.value; refresh();
  });
  $('#qClr').addEventListener('click', function () {
    $('#q').value = ''; F.q = ''; this.hidden = true; refresh();
  });
  /* 목록·지도 어느 쪽을 보고 있든 필터 결과를 같이 갱신한다 */
  function refresh() { MAPMODE ? (drawChips(), paintMarkers()) : drawList(); }
  $('#btnBook').addEventListener('click', function () { openBook(); });

  /* ══ 즐겨찾기 — 저장한 주주 · 추천 주주 ══════════════ */
  var BKTAB = 'save', BKSORT = 'live';
  function bkRows() {
    var L = APP.list();
    if (BKTAB === 'save') L = L.filter(function (x) { return BOOK.indexOf(x.i) >= 0; });
    else L = L.filter(function (x) {
      return BOOK.indexOf(x.i) < 0 && x.live.k === 'high' && x.st !== 'done';
    }).slice(0, 30);
    var W = { high: 0, mid: 1, low: 2 };
    if (BKSORT === 'sh') L.sort(function (a, b) { return b.sh - a.sh; });
    else if (BKSORT === 'near') L.sort(function (a, b) { return dist(a) - dist(b); });
    else L.sort(function (a, b) { return (W[a.live.k] - W[b.live.k]) || (b.sh - a.sh); });
    return L;
  }
  var BKSORTS = [{ k: 'live', nm: '거주 가능성 높은 순' }, { k: 'near', nm: '가까운 순' }, { k: 'sh', nm: '보유 주식 많은 순' }];
  function drawBook() {
    var L = bkRows();
    $('#bkCnt').textContent = cm(L.length);
    $('#bkSort').querySelector('span').textContent =
      (BKSORTS.filter(function (s) { return s.k === BKSORT; })[0] || BKSORTS[0]).nm;
    $('#bkList').innerHTML = L.length ? L.map(cardHtml).join('')
      : '<div class="bkempty"><i class="ph ph-bookmark-simple"></i>'
        + (BKTAB === 'save' ? '저장한 주주가 없습니다.<br>목록에서 북마크를 눌러 추가해 주세요.' : '추천할 주주가 없습니다.')
        + '</div>';
    bindCards($('#bkList'));
  }
  function openBook() { drawBook(); show('#scrBook'); $('#tabbar').hidden = false; }
  $('#bkBack2').addEventListener('click', function () { goTab('list'); });
  $('#bkMark').addEventListener('click', function () { BKTAB = 'save'; paintBkTabs(); drawBook(); });
  $('#bkMap').addEventListener('click', function () { goTab('list'); if (!MAPMODE) $('#btnMap').click(); });
  function paintBkTabs() {
    $$('#bkTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.bt === BKTAB); });
  }
  $$('#bkTabs button').forEach(function (b) {
    b.addEventListener('click', function () { BKTAB = b.dataset.bt; paintBkTabs(); drawBook(); });
  });
  $('#bkSort').addEventListener('click', function () {
    sheet({
      title: '정렬', body: '<div style="padding:4px 0 8px">' + BKSORTS.map(function (s) {
        return '<button class="opt" type="button" data-bsrt="' + s.k + '"><span class="cb rd' + (BKSORT === s.k ? ' on' : '') + '"></span><span class="sp">' + s.nm + '</span></button>';
      }).join('') + '</div>',
      after: function (bx) {
        bx.querySelectorAll('[data-bsrt]').forEach(function (b) {
          b.addEventListener('click', function () { BKSORT = b.dataset.bsrt; closeSheet(); drawBook(); });
        });
      }
    });
  });

  function liveBg(x) {
    var m = { high: 'green', mid: 'gray', low: 'red' };
    return '<span class="bg ' + m[x.live.k] + '">' + x.live.nm + '</span>';
  }
  function cardHtml(x) {
    var s = ST[x.st], bk = BOOK.indexOf(x.i) >= 0;
    return '<div class="card" role="button" tabindex="0" data-open="' + x.i + '">'
      + '<div class="c-top">'
      + '<div class="l1"><span class="nm">' + esc(x.name) + '</span>'
      + '<span class="bkm' + (bk ? ' on' : '') + '" data-book="' + x.i + '" role="button" aria-label="관심 주주">'
      + '<i class="' + (bk ? 'ph-fill' : 'ph') + ' ph-bookmark-simple"></i></span>'
      + '<span class="sp"></span><span class="stb ' + s.cls + '">' + s.nm + '</span></div>'
      + '<div class="sh">' + cm(x.sh) + '주</div>'
      + '<div class="tags"><span class="tg">' + esc(x.org) + '</span>'
      + '<span class="tg">' + x.age + '세 ' + x.sex + '</span></div>'
      + '</div>'
      + '<div class="c-ad">'
      + '<div class="zp"><span class="z">' + x.zip + '</span>'
      + '<span class="cp" data-copy="' + esc(x.zip + ' ' + x.addr) + '" role="button" aria-label="주소 복사"><i class="ph ph-copy"></i></span>'
      + '<span class="sp"></span>'
      + '<span class="lv ' + x.live.k + '">' + x.live.nm
      + (x.more ? ' · 대표주소 외 ' + x.more + '개' : '') + '</span></div>'
      + '<div class="tx">' + esc(x.addr) + '</div></div>'
      + '</div>';
  }
  function bindCards(root) {
    root.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        var cp = e.target.closest('[data-copy]');
        if (cp) { e.stopPropagation(); copy(cp.dataset.copy); return; }
        var bm = e.target.closest('[data-book]');
        if (bm) {
          e.stopPropagation();
          var id = +bm.dataset.book, k = BOOK.indexOf(id);
          if (k >= 0) { BOOK.splice(k, 1); toast('관심 주주에서 해제했습니다'); }
          else { BOOK.push(id); toast('관심 주주로 등록했습니다'); }
          saveBook();
          bm.classList.toggle('on', BOOK.indexOf(id) >= 0);
          bm.querySelector('i').className = (BOOK.indexOf(id) >= 0 ? 'ph-fill' : 'ph') + ' ph-bookmark-simple';
          return;
        }
        openDetail(b.dataset.open);
      });
    });
  }
  function copy(t) {
    try { navigator.clipboard.writeText(t); } catch (e) {}
    toast('주소를 복사했습니다');
  }
  function drawList() {
    drawChips();
    var L = filtered();
    $('#lsCnt').textContent = cm(L.length);
    $('#btnSort').querySelector('span').textContent = (SORTS.filter(function (s) { return s.k === F.sort; })[0] || SORTS[0]).nm;
    $('#btnBook').querySelector('i').className = F.bookOnly ? 'ph-fill ph-bookmark-simple' : 'ph ph-bookmark-simple';
    var c = $('#cards');
    c.innerHTML = L.length ? L.slice(0, 60).map(cardHtml).join('')
      : '<div class="empty"><i class="ph ph-magnifying-glass"></i>조건에 맞는 주주가 없습니다</div>';
    bindCards(c);
    show(TABS.list);
  }

  /* 목록 ↔ 지도 — 같은 수집 탭 안에서 본문만 바꾼다 */
  var MAPMODE = false;
  $('#btnMap').addEventListener('click', function () { setMapMode(!MAPMODE); });
  var SRCHOPEN = false;
  function setMapMode(on) {
    MAPMODE = on;
    $('#listBd').hidden = on;
    $('#mapwrap').hidden = !on;
    $('#btnMap').querySelector('i').className = on ? 'ph ph-list-bullets' : 'ph ph-map-trifold';
    $('#btnMap').setAttribute('aria-label', on ? '목록 보기' : '지도 보기');
    /* 지도에서는 검색창 대신 칩 줄 오른쪽 돋보기 아이콘으로 */
    if (!on) SRCHOPEN = false;
    paintSearch();
    if (on) openMap(); else { nearClose(); drawList(); }
  }
  function paintSearch() {
    var btn = $('#chipSearch');
    btn.hidden = !MAPMODE;
    btn.classList.toggle('on', SRCHOPEN);
    btn.querySelector('i').className = SRCHOPEN ? 'ph ph-x' : 'ph ph-magnifying-glass';
    $('#srchWrap').hidden = MAPMODE && !SRCHOPEN;
  }
  $('#chipSearch').addEventListener('click', function () {
    SRCHOPEN = !SRCHOPEN;
    if (!SRCHOPEN && F.q) { $('#q').value = ''; F.q = ''; $('#qClr').hidden = true; refresh(); }
    paintSearch();
    if (SRCHOPEN) setTimeout(function () { $('#q').focus(); }, 30);
    setTimeout(resize, 60);           /* 검색창이 접히고 펴지면 지도 크기가 바뀐다 */
  });

  /* ══ 지도 ════════════════════════════════════ */
  /* 기본 위치는 시연 구역인 여의도 */
  var MAP = null, LAYER = null, ME = { lat: 37.5232, lng: 126.9262 }, MEMK = null;

  /* 배경 타일 — 키 없이 쓰는 공개 타일을 순서대로 시도하고, 모두 막히면 단색 배경으로 넘어간다.
     타일이 안 떠도 클러스터·핀은 그대로 보이므로 시연이 끊기지 않는다. */
  var TILE_SRC = [
    { u: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', a: '&copy; OpenStreetMap' },
    { u: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', a: '&copy; OpenStreetMap, HOT' },
    { u: 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png', a: '&copy; OpenStreetMap, Wikimedia' }
  ];
  var tileIdx = 0, tileLay = null;
  function tiles() {
    if (tileLay) { MAP.removeLayer(tileLay); tileLay = null; }
    if (tileIdx >= TILE_SRC.length) { document.getElementById('map').classList.add('flat'); return; }
    var src = TILE_SRC[tileIdx], bad = 0, ok = false;
    tileLay = L.tileLayer(src.u, { maxZoom: 19, attribution: src.a, subdomains: 'abc' })
      .on('tileload', function () { ok = true; })
      .on('tileerror', function () { if (!ok && ++bad >= 3) { tileIdx++; tiles(); } })
      .addTo(MAP);
    /* 응답이 아예 없을 때도 다음 후보로 넘어간다 */
    setTimeout(function () { if (!ok && tileIdx === TILE_SRC.indexOf(src)) { tileIdx++; tiles(); } }, 6000);
  }
  function dist(x) {
    var dy = (x.lat - ME.lat) * 111, dx = (x.lng - ME.lng) * 88;
    return Math.sqrt(dy * dy + dx * dx);
  }

  /* ── 지도 엔진 ─────────────────────────────────
     기본은 네이버 지도(Web Dynamic Map). 키가 없거나 인증이 막히면
     같은 마커·클러스터 로직 그대로 OSM 지도로 내려간다. */
  var ENGINE = null;               /* 'naver' | 'osm' */
  var MKS = [];                    /* 지금 떠 있는 마커들 */

  function naverKey() {
    var q = new URLSearchParams(location.search).get('ncpKeyId');
    if (q) { try { localStorage.setItem('cx.app.navkey', q); } catch (e) {} return q; }
    try { return localStorage.getItem('cx.app.navkey') || APP.NAVER_KEY || ''; }
    catch (e) { return APP.NAVER_KEY || ''; }
  }

  /* 네이버 지도 스크립트를 한 번만 불러온다 */
  var nvState = 0;                 /* 0 아직 · 1 불러오는 중 · 2 성공 · 3 실패 */
  var nvWait = [];
  function loadNaver(cb) {
    if (nvState === 2) return cb(true);
    if (nvState === 3) return cb(false);
    nvWait.push(cb);
    if (nvState === 1) return;
    var key = naverKey();
    if (!key) { nvState = 3; return flushNv(false); }
    nvState = 1;
    /* 키가 잘못됐을 때 네이버가 불러 주는 콜백.
       이 콜백은 지도를 만든 뒤에 오기도 하므로, 이미 떠 있으면 기본 지도로 갈아 끼운다. */
    window.navermap_authFailure = function () {
      nvState = 3;
      if (MAP) downgrade(); else flushNv(false);
    };
    var s = document.createElement('script');
    s.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(key);
    s.onload = function () {
      /* 인증 실패는 onload 뒤에 비동기로 오므로 잠시 기다렸다가 판정한다 */
      setTimeout(function () {
        if (nvState === 3) return;
        nvState = window.naver && naver.maps ? 2 : 3;
        flushNv(nvState === 2);
      }, 400);
    };
    s.onerror = function () { nvState = 3; flushNv(false); };
    document.head.appendChild(s);
    setTimeout(function () { if (nvState === 1) { nvState = 3; flushNv(false); } }, 8000);
  }
  function flushNv(ok) { var w = nvWait; nvWait = []; w.forEach(function (f) { f(ok); }); }

  function openMap() {
    if (MAP) { setTimeout(function () { resize(); paintMarkers(); }, 60); return; }
    loadNaver(function (ok) {
      ENGINE = ok ? 'naver' : 'osm';
      ok ? initNaver() : initOsm();
      setMe();
      /* 컨테이너 크기가 잡힌 뒤에 맞춰야 담당 구역 전체가 제대로 들어온다 */
      setTimeout(function () { resize(); fitAll(); paintMarkers(); }, 80);
      if (!ok) mapNote();
    });
  }
  function mapNote() {
    var el = document.getElementById('mapNote');
    if (el) return;
    el = document.createElement('div');
    el.id = 'mapNote'; el.className = 'mapnote';
    el.innerHTML = '<i class="ph ph-info"></i>네이버 지도 키가 없어 기본 지도로 표시합니다';
    $('.mapwrap').appendChild(el);
    setTimeout(function () { el.classList.add('off'); }, 4000);
  }

  function initNaver() {
    MAP = new naver.maps.Map('map', {
      center: new naver.maps.LatLng(ME.lat, ME.lng), zoom: 11,
      zoomControl: false, mapDataControl: false, scaleControl: false, logoControlOptions: { position: 3 }
    });
    naver.maps.Event.addListener(MAP, 'idle', onIdle);
  }
  function initOsm() {
    MAP = L.map('map', { zoomControl: false, attributionControl: true }).setView([ME.lat, ME.lng], 11);
    tiles();
    MAP.on('moveend zoomend', onIdle);
  }
  function onIdle() { paintMarkers(); checkHere(); }

  /* 네이버 인증이 늦게 거절되면 지도를 통째로 기본 지도로 바꿔 끼운다 */
  function downgrade() {
    ENGINE = 'osm'; MAP = null; MKS = []; MEMK = null; tileIdx = 0; tileLay = null;
    var el = document.getElementById('map');
    /* 네이버 API 가 컨테이너에 남긴 인라인 스타일까지 걷어내야 높이가 살아난다 */
    el.innerHTML = ''; el.className = ''; el.removeAttribute('style');
    delete el._leaflet_id;
    initOsm(); setMe();
    setTimeout(function () { resize(); fitAll(); paintMarkers(); }, 80);
    mapNote();
  }

  /* 엔진 차이를 여기서만 흡수한다 — 인증이 거절되면 naver 전역이 사라지므로 함께 본다 */
  function isNv() { return ENGINE === 'naver' && window.naver && naver.maps; }
  function resize() {
    if (!MAP) return;
    try { isNv() ? naver.maps.Event.trigger(MAP, 'resize') : MAP.invalidateSize(); } catch (e) {}
  }
  function zoomOf() { return MAP.getZoom(); }
  function setView(lat, lng, z) {
    if (isNv()) { MAP.setCenter(new naver.maps.LatLng(lat, lng)); if (z) MAP.setZoom(z, true); }
    else MAP.setView([lat, lng], z || MAP.getZoom());
  }
  function inView(x) {
    if (isNv()) return MAP.getBounds().hasLatLng(new naver.maps.LatLng(x.lat, x.lng));
    return MAP.getBounds().contains([x.lat, x.lng]);
  }
  function fitAll() {
    var P = APP.list(); if (!P.length) return;
    var la = P.map(function (x) { return x.lat; }), ln = P.map(function (x) { return x.lng; });
    var s = Math.min.apply(null, la), n = Math.max.apply(null, la);
    var w = Math.min.apply(null, ln), e = Math.max.apply(null, ln);
    var py = (n - s) * 0.12, px = (e - w) * 0.12;
    if (isNv()) {
      MAP.fitBounds(new naver.maps.LatLngBounds(
        new naver.maps.LatLng(s - py, w - px), new naver.maps.LatLng(n + py, e + px)));
    } else {
      MAP.fitBounds([[s - py, w - px], [n + py, e + px]]);
    }
  }
  /* html 아이콘 마커 하나 */
  function mark(lat, lng, html, size, onClick) {
    var m;
    if (isNv()) {
      m = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng), map: MAP,
        icon: { content: html, size: new naver.maps.Size(size, size),
          anchor: new naver.maps.Point(size / 2, size / 2) }
      });
      if (onClick) naver.maps.Event.addListener(m, 'click', onClick);
    } else {
      m = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: html })
      }).addTo(MAP);
      if (onClick) m.on('click', onClick);
    }
    return m;
  }
  function unmark(m) { if (!m) return; isNv() ? m.setMap(null) : MAP.removeLayer(m); }

  function setMe() {
    unmark(MEMK);
    MEMK = mark(ME.lat, ME.lng,
      '<div style="width:22px;height:22px;border-radius:1000px;background:#0071F3;border:3px solid #fff;'
      + 'box-shadow:0 0 0 6px rgba(0,113,243,.2),0 2px 8px rgba(0,0,0,.3)"></div>', 22, null);
  }

  $('#mapIn').addEventListener('click', function () { if (MAP) MAP.setZoom(zoomOf() + 1, true); });
  $('#mapOut').addEventListener('click', function () { if (MAP) MAP.setZoom(zoomOf() - 1, true); });
  $('#mapMe').addEventListener('click', function () {
    if (!MAP) return;
    if (!navigator.geolocation) { setView(ME.lat, ME.lng, 14); return; }
    toast('현재 위치를 확인하고 있습니다');
    navigator.geolocation.getCurrentPosition(function (p) {
      ME = { lat: p.coords.latitude, lng: p.coords.longitude };
      setMe(); setView(ME.lat, ME.lng, 14);
    }, function () { setMe(); setView(ME.lat, ME.lng, 14); toast('위치 권한이 없어 기본 위치로 이동합니다'); },
      { timeout: 6000 });
  });

  /* 화면 안의 주주를 격자로 묶어 클러스터로 보여 준다 */
  function paintMarkers() {
    if (!MAP) return;
    MKS.forEach(unmark); MKS = [];
    var L0 = filtered(), z, vis;
    try { z = zoomOf(); vis = L0.filter(inView); } catch (e) { return; }
    if (z >= 14) {
      /* 개별 핀 — 주주 아이콘 아래 이름 (Figma 5411:27558) */
      vis.slice(0, 150).forEach(function (x) {
        MKS.push(mark(x.lat, x.lng,
          '<div class="upin ' + x.st + '"><div class="ic"></div><div class="dot"></div>'
          + '<div class="nm">' + esc(x.name) + '</div></div>', 36,
          function () { openDetail(x.i); }));
      });
      return;
    }
    var cell = z >= 12 ? 0.08 : z >= 10 ? 0.25 : 0.8, G = {};
    vis.forEach(function (x) {
      var k = Math.round(x.lat / cell) + ',' + Math.round(x.lng / cell);
      (G[k] = G[k] || []).push(x);
    });
    Object.keys(G).forEach(function (k) {
      var g = G[k], n = g.length;
      /* 혼자 있는 주주는 줌 단계와 상관없이 바로 핀으로 보여 준다 */
      if (n === 1) {
        var x1 = g[0];
        MKS.push(mark(x1.lat, x1.lng,
          '<div class="upin ' + x1.st + '"><div class="ic"></div><div class="dot"></div>'
          + '<div class="nm">' + esc(x1.name) + '</div></div>', 36,
          function () { openDetail(x1.i); }));
        return;
      }
      var lat = g.reduce(function (a, x) { return a + x.lat; }, 0) / n;
      var lng = g.reduce(function (a, x) { return a + x.lng; }, 0) / n;
      var d = n >= 100 ? 62 : n >= 30 ? 54 : n >= 10 ? 46 : 40;
      var lbl = n > 300 ? '300+' : n;
      MKS.push(mark(lat, lng,
        '<div class="cls" style="width:' + d + 'px;height:' + d + 'px;font-size:' + (n >= 100 ? 15 : 14) + 'px">' + lbl + '</div>',
        d, function () {
          /* 클러스터를 누르면 그 중심으로 부드럽게 옮기면서 풀어 준다 */
          panTo(lat, lng, Math.min(15, z + 3));
        }));
    });
  }
  /* 부드럽게 이동 */
  function panTo(lat, lng, z) {
    if (isNv()) {
      MAP.morph(new naver.maps.LatLng(lat, lng), z, { duration: 450, easing: 'easeOutCubic' });
    } else {
      MAP.flyTo([lat, lng], z, { duration: 0.5 });
    }
  }

  /* ── 추천 주주 바텀 시트 ───────────────────── */
  /* 추천 주주 — 지도 중심에서 가까운 순 30건 */
  var REC_N = 30;
  function recommended() {
    var c = center();
    return filtered().slice().sort(function (a, b) { return distTo(a, c) - distTo(b, c); }).slice(0, REC_N);
  }
  function center() {
    if (!MAP) return { lat: ME.lat, lng: ME.lng };
    var c = MAP.getCenter();
    return isNv() ? { lat: c.lat(), lng: c.lng() } : { lat: c.lat, lng: c.lng };
  }
  function distTo(x, c) {
    var dy = (x.lat - c.lat) * 111, dx = (x.lng - c.lng) * 88;
    return Math.sqrt(dy * dy + dx * dx);
  }
  function fillSheet(list, tt) {
    $('#nearTt').textContent = tt;
    var c = $('#nearCards');
    c.innerHTML = list.length ? list.map(cardHtml).join('')
      : '<div class="empty"><i class="ph ph-map-pin"></i>이 근처에는 대상 주주가 없습니다</div>';
    bindCards(c);
  }
  function nearOpen() {
    var L0 = recommended();
    fillSheet(L0, '추천 주주 ' + L0.length + '명');
    $('#nearSheet').classList.add('on');
    $('#mapwrap').classList.add('sheeton');
    HERE.base = center();                 /* 이 자리를 기준으로 삼는다 */
    $('#mapHere').hidden = true;
  }
  function nearClose() {
    var s = $('#nearSheet');
    s.classList.remove('on', 'full');
    $('#mapwrap').classList.remove('sheeton');
    $('#mapHere').hidden = true;          /* 시트를 닫으면 조건과 무관하게 사라진다 */
  }
  $('#nearX').addEventListener('click', nearClose);
  $('#mapNear').addEventListener('click', nearOpen);

  /* 시트 손잡이 드래그 — 위로 끌면 최대 확장, 아래로 끌면 닫힘 */
  (function () {
    var s = $('#nearSheet'), y0 = 0, h0 = 0, moved = 0, on = false;
    function wrapH() { return $('#mapwrap').getBoundingClientRect().height || 1; }
    function down(e) {
      if (!s.classList.contains('on')) return;
      on = true; moved = 0; y0 = e.clientY; h0 = s.getBoundingClientRect().height;
      s.classList.add('drag');
      /* 포인터를 잡는 쪽과 이벤트를 듣는 쪽이 달라 드래그가 끊기던 문제 — 창에서 받는다 */
      e.preventDefault();
    }
    function move(e) {
      if (!on) return;
      if (e.cancelable) e.preventDefault();
      moved = y0 - e.clientY;
      var h = Math.max(80, Math.min(wrapH(), h0 + moved));
      s.style.height = h + 'px';
    }
    function up() {
      if (!on) return;
      on = false; s.classList.remove('drag'); s.style.height = '';
      if (moved < -90) { nearClose(); return; }
      s.classList.toggle('full', moved > 60 || (s.classList.contains('full') && moved > -60));
    }
    ['#nearGrab', '.sheetup .sh-h'].forEach(function (sel) {
      var el = document.querySelector(sel); if (!el) return;
      el.addEventListener('pointerdown', down);
    });
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  })();

  /* ── 현재 지도에서 다시 찾기 ───────────────── */
  var HERE = { base: null };
  function checkHere() {
    var btn = $('#mapHere'); if (!btn) return;
    var open = $('#nearSheet').classList.contains('on');
    if (!open || !HERE.base) { btn.hidden = true; return; }
    /* 시트를 연 자리에서 충분히 벗어났을 때만 */
    btn.hidden = distTo({ lat: HERE.base.lat, lng: HERE.base.lng }, center()) < 1.2;
  }
  $('#mapHere').addEventListener('click', function () {
    var L0 = recommended();
    fillSheet(L0, '이 지역 추천 주주 ' + L0.length + '명');
    HERE.base = center();
    this.hidden = true;
    $('#nearSheet').querySelector('.sh-b').scrollTop = 0;
  });

  /* ══ 주주 상세정보 ═══════════════════════════ */
  var CUR = null;
  function openDetail(i) {
    var x = APP.find(i); if (!x) return;
    CUR = x;
    backTo = curTab;
    /* 지도에서 들어왔으면 돌아올 때도 지도로 */
    nearClose();
    drawDetail();
    show('#scrDetail'); $('#tabbar').hidden = true;
    $('#dtBd').scrollTop = 0;
  }
  $('#dtBack').addEventListener('click', function () { goTab(backTo || 'list'); });

  function drawDetail() {
    var x = CUR, st = ST[x.st], bk = BOOK.indexOf(x.i) >= 0;
    /* cx-roster 의 rt 는 이미 퍼센트 값이다 */
    var pct = (x.rt != null ? Number(x.rt).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : '-');
    var a0 = x.addrs[0];

    $('#dtBd').innerHTML =
      '<div class="dt-hd">'
      + '<div class="l1"><span class="nm">' + esc(x.name) + '</span>'
      + '<span class="bkm' + (bk ? ' on' : '') + '" id="dtBook" role="button" aria-label="관심 주주">'
      + '<i class="' + (bk ? 'ph-fill' : 'ph') + ' ph-bookmark-simple"></i></span>'
      + '<span class="stb ' + st.cls + '">' + st.nm + '</span></div>'

      + '<div style="margin-top:14px">'
      + dkv('성별', esc(x.sex))
      + dkv('생년월일', x.born)
      + dkv('보유주식', cm(x.sh) + '주 <span class="sm">(' + pct + '%)</span>')
      + dkv('연락처', x.tel
          ? '<span class="telval"><a href="tel:' + x.tel.replace(/[^0-9]/g, '') + '">' + esc(x.tel) + '</a>'
            + '<button class="ed" type="button" id="dtTel">변경</button></span>'
          : '<button class="telbtn" type="button" id="dtTel">연락처 등록</button>')
      + dkv('주소',
          '<div class="adbox"><div class="z"><span>' + a0.zip + '</span>'
          + '<span class="cp" id="dtCopy" role="button" aria-label="주소 복사"><i class="ph ph-copy"></i></span>'
          + '<span class="sp"></span>'
          + (x.addrs.length > 1 ? '<span class="more" id="dtMore" role="button">전체 주소 ' + x.addrs.length + '건 ›</span>' : '')
          + '</div><div class="tx">' + esc(a0.full) + '</div></div>')
      + (x.st === 'replan' ? visitRow(x) : '')
      + '</div></div>'

      + '<div class="dsec"><div class="h"><b>메모</b>'
      + '<button class="mbtn" type="button" id="dtMemo"><i class="ph ph-pencil-simple"></i>메모하기</button></div>'
      + memoList(x) + '</div>';

    $('#dtBook').addEventListener('click', function () {
      var k = BOOK.indexOf(x.i);
      if (k >= 0) { BOOK.splice(k, 1); toast('관심 주주에서 해제했습니다'); }
      else { BOOK.push(x.i); toast('관심 주주로 등록했습니다'); }
      saveBook(); drawDetail();
    });
    $('#dtTel').addEventListener('click', openTel);
    $('#dtCopy').addEventListener('click', function () { copyAddr(a0); });
    var more = $('#dtMore'); if (more) more.addEventListener('click', openAddrs);
    var vb = $('#dtVisit'); if (vb) vb.addEventListener('click', openVisit);
    $('#dtMemo').addEventListener('click', function () { editMemo(null); });
    $('#dtBd').querySelectorAll('[data-mdel]').forEach(function (b) {
      b.addEventListener('click', function () { delMemo(+b.dataset.mdel); });
    });
    $('#dtBd').querySelectorAll('[data-medit]').forEach(function (b) {
      b.addEventListener('click', function () { editMemo(+b.dataset.medit); });
    });
    /* 위임이 끝난 건은 더 할 일이 없어 하단 버튼을 숨긴다 */
    var done = x.st === 'done';
    $('#dtStart').textContent = done ? '위임장 확인' : '위임 시작';
    var ft = $('#scrDetail').querySelector('.dt-ft');
    if (ft) ft.hidden = done;
  }
  function dkv(k, v) { return '<div class="dt-kv"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }

  /* ── 재방문 일정 (Figma 5148:26160) ────────────────────────
     재방문예정 주주에게만 보이고, 등록한 시간에 맞춰 알림을 보낸다는 안내를 단다. */
  function visitRow(x) {
    return '<div class="vsline">'
      + '<div class="dt-kv" style="align-items:center"><div class="k">재방문 일정</div><div class="v">'
      + (x.visit
          ? '<span class="telval"><b style="font-weight:800">' + esc(vsLabel(x.visit)) + '</b>'
            + '<button class="ed" type="button" id="dtVisit">변경</button></span>'
          : '<button class="telbtn" type="button" id="dtVisit">일정 등록</button>')
      + '</div></div>'
      + '<div class="vsnote">* 재방문 시간에 맞춰 알림을 보내드려요.</div></div>';
  }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function vsLabel(v) {
    var d = new Date(v.replace(' ', 'T') + ':00');
    if (isNaN(d)) return v;
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + WD[d.getDay()] + ') '
      + (d.getHours() < 12 ? '오전 ' : '오후 ') + ((d.getHours() % 12) || 12) + '시'
      + (d.getMinutes() ? ' ' + d.getMinutes() + '분' : '');
  }
  function vsDates() {
    var out = [], base = new Date('2026-09-30T00:00:00');
    for (var i = 0; i < 21; i++) {
      var d = new Date(base.getTime() + i * 86400000);
      function p(v) { return (v < 10 ? '0' : '') + v; }
      out.push({ v: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()),
        t: (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')'
          + (i === 0 ? ' · 오늘' : i === 1 ? ' · 내일' : '') });
    }
    return out;
  }
  function vsTimes() {
    var out = [];
    for (var h = 9; h <= 20; h++) for (var m = 0; m < 60; m += 30) {
      var v = (h < 10 ? '0' : '') + h + ':' + (m ? '30' : '00');
      out.push({ v: v, t: (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + '시' + (m ? ' 30분' : '') });
    }
    return out;
  }
  function openVisit() {
    var cur = (CUR.visit || '').split(' ');
    var date = cur[0] || '', time = cur[1] || '';
    var DS = vsDates(), TS = vsTimes();
    function lbl(L, v, ph) { var f = L.filter(function (o) { return o.v === v; })[0]; return f ? f.t : ph; }
    function body() {
      return '<div class="vsform">'
        + '<div class="fld2"><label>날짜</label>'
        + '<button class="fsel' + (date ? '' : ' ph') + '" type="button" id="vsD">' + esc(lbl(DS, date, '날짜를 선택해 주세요')) + '</button></div>'
        + '<div class="fld2"><label>시간</label>'
        + '<button class="fsel' + (time ? '' : ' ph') + '" type="button" id="vsT">' + esc(lbl(TS, time, '시간을 선택해 주세요')) + '</button></div>'
        + '<div class="vsnote" style="margin-top:14px">* 재방문 시간에 맞춰 알림을 보내드려요.</div></div>';
    }
    sheet({
      title: '재방문 일정 등록',
      body: body(),
      foot: (CUR.visit ? '<button class="btn gh" type="button" id="vsDel">삭제</button>' : '')
        + '<button class="btn" type="button" id="vsOk" disabled>등록하기</button>',
      after: function (bx) {
        function paint() {
          bx.querySelector('.bb').innerHTML = body();
          bx.querySelector('#vsD').addEventListener('click', function () {
            pickSheet('날짜 선택', DS.map(function (o) { return o.t; }), lbl(DS, date, ''), function (v) {
              var f = DS.filter(function (o) { return o.t === v; })[0];
              date = f ? f.v : ''; setTimeout(function () { openVisit2(date, time); }, 0);
            });
          });
          bx.querySelector('#vsT').addEventListener('click', function () {
            pickSheet('시간 선택', TS.map(function (o) { return o.t; }), lbl(TS, time, ''), function (v) {
              var f = TS.filter(function (o) { return o.t === v; })[0];
              time = f ? f.v : ''; setTimeout(function () { openVisit2(date, time); }, 0);
            });
          });
          bx.querySelector('#vsOk').disabled = !(date && time);
        }
        paint();
        bx.querySelector('#vsOk').addEventListener('click', function () {
          APP.setVisit(CUR.i, date + ' ' + time);
          closeSheet(); drawDetail(); toast('재방문 일정을 등록했습니다', true);
        });
        var del = bx.querySelector('#vsDel');
        if (del) del.addEventListener('click', function () {
          APP.setVisit(CUR.i, ''); closeSheet(); drawDetail(); toast('재방문 일정을 삭제했습니다');
        });
      }
    });
  }
  /* 날짜·시간을 고르고 돌아올 때 값을 유지한 채 다시 연다 */
  function openVisit2(d, t) {
    var keep = CUR.visit; CUR.visit = (d && t) ? (d + ' ' + t) : (d ? d + ' ' : ' ' + t);
    openVisit(); CUR.visit = keep;
  }

  /* ── 메모 — 여러 건을 날짜와 함께 쌓는다 ───────────────────── */
  function memos(x) {
    if (!x.memo) return [];
    try { var v = JSON.parse(x.memo); return v instanceof Array ? v : [{ at: '', tx: x.memo }]; }
    catch (e) { return [{ at: '', tx: x.memo }]; }
  }
  function saveMemos(x, list) { APP.setMemo(x.i, list.length ? JSON.stringify(list) : ''); }
  function memoList(x) {
    var L = memos(x);
    if (!L.length) return '<div class="memo-empty"><i class="ph ph-note-blank"></i>메모가 없습니다</div>';
    return '<div class="memos">' + L.map(function (m, i) {
      var d = (m.at || '').split(' ');
      return '<div class="memo-c"><div class="t">'
        + '<b>' + esc((d[0] || '').replace(/-/g, '.')) + '</b><span>' + esc(d[1] || '') + '</span>'
        + '<span class="sp"></span>'
        + '<span class="del" data-medit="' + i + '" role="button" aria-label="수정"><i class="ph ph-pencil-simple"></i></span>'
        + '<span class="del" data-mdel="' + i + '" role="button" aria-label="삭제"><i class="ph ph-trash"></i></span>'
        + '</div><div class="x">' + esc(m.tx) + '</div></div>';
    }).join('') + '</div>';
  }
  function nowStamp() {
    var d = new Date();
    function p(v) { return (v < 10 ? '0' : '') + v; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function delMemo(i) {
    var L = memos(CUR); L.splice(i, 1); saveMemos(CUR, L); drawDetail();
    toast('메모를 삭제했습니다');
  }

  /* ── 주소 복사 — 지도 앱으로 바로 열 수 있게 ──────────────── */
  function copyAddr(a) {
    try { navigator.clipboard.writeText(a.zip + ' ' + a.full); } catch (e) {}
    var q = encodeURIComponent(a.full);
    sheet({
      title: '주소를 복사했습니다',
      body: '<div style="color:#171717;font-size:14px;font-weight:600;line-height:1.55">' + esc(a.full) + '</div>'
        + '<div style="margin-top:6px;font-size:12px;color:#8A8F99">우편번호 ' + a.zip + '</div>'
        + '<div class="maplinks" style="margin-top:16px">'
        + '<a href="https://map.naver.com/p/search/' + q + '" target="_blank" rel="noopener">'
        + '<img src="assets/map-naver.png" alt="">네이버 지도</a>'
        + '<a href="https://map.kakao.com/?q=' + q + '" target="_blank" rel="noopener">'
        + '<img src="assets/map-kakao.png" alt="">카카오맵</a></div>',
      foot: '<button class="btn gh" type="button" data-ovx>닫기</button>'
    });
  }
  function kv(k, v) { return '<div class="kv"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }

  /* ── 방문상태 히스토리 (Figma 5148:25648) ────────────────── */
  var HKEY = 'cx.app.hist';
  function histAll() {
    try { return JSON.parse(localStorage.getItem(HKEY) || '{}'); } catch (e) { return {}; }
  }
  function histSave(all) { try { localStorage.setItem(HKEY, JSON.stringify(all)); } catch (e) {} }
  /* 저장된 게 없으면 배정 이후 기록을 순번에서 만들어 둔다 */
  var SEED_RSN = { plan: ['첫 방문 예정 등록'], replan: ['부재중', '보완 서류 필요', '재방문 요청'],
    no: ['타인 거주', '연락 두절', '수집 거부'], done: ['위임장 수령 완료'], fix: ['서명 누락'] };
  function seedHist(x) {
    function r(k) { var v = Math.sin((x.i + 1) * 9301 + k * 49297) * 233280; return v - Math.floor(v); }
    var n = 1 + Math.floor(r(71) * 3), out = [];
    for (var i = 0; i < n; i++) {
      var st = ['replan', 'plan', 'replan'][i % 3];
      var L = SEED_RSN[st], d = 16 + Math.floor(r(72 + i) * 12);
      function p2(v) { return (v < 10 ? '0' : '') + v; }
      out.push({ at: '2026-09-' + p2(d) + ' ' + p2(9 + Math.floor(r(75 + i) * 10)) + ':' + p2(Math.floor(r(78 + i) * 60)),
        st: st, why: L[Math.floor(r(80 + i) * L.length)] });
    }
    if (x.at) out.push({ at: x.at, st: x.st, why: '' });
    out.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return out;
  }
  function histOf(x) {
    var all = histAll();
    if (!all[x.i]) { all[x.i] = seedHist(x); histSave(all); }
    return all[x.i];
  }
  function histAdd(x, st, why) {
    var all = histAll();
    if (!all[x.i]) all[x.i] = seedHist(x);
    all[x.i].unshift({ at: nowStamp(), st: st, why: why || '' });
    histSave(all);
  }
  function openHist() {
    var L = histOf(CUR);
    $('#hsList').innerHTML = L.length ? L.map(function (h) {
      var st = ST[h.st] || ST.plan;
      return '<div class="hsday">' + esc(h.at.replace(/-/g, '.')) + '</div>'
        + '<div class="hscard"><div class="t"><b>방문상태 변경</b>'
        + '<span class="stb ' + st.cls + '">' + st.nm + '</span></div>'
        + (h.why ? '<div class="x">' + esc(h.why) + '</div>' : '') + '</div>';
    }).join('') : '<div class="empty" style="padding:60px 0"><i class="ph ph-clock-counter-clockwise"></i>기록이 없습니다</div>';
    show('#scrHist'); $('#tabbar').hidden = true;
    $('#hsList').parentNode.scrollTop = 0;
  }
  $('#dtHist').addEventListener('click', openHist);
  $('#hsBack').addEventListener('click', function () { show('#scrDetail'); $('#tabbar').hidden = true; });

  function editMemo(idx) {
    var L = memos(CUR), cur = (idx == null) ? '' : L[idx].tx;
    sheet({
      title: idx == null ? '메모하기' : '메모 수정',
      body: '<textarea class="ta" id="mmTa" placeholder="방문 시 참고할 내용을 적어 두세요">' + esc(cur) + '</textarea>',
      foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="mmOk">저장</button>',
      after: function (bx) {
        bx.querySelector('#mmTa').focus();
        bx.querySelector('#mmOk').addEventListener('click', function () {
          var t = bx.querySelector('#mmTa').value.trim();
          if (!t) { closeSheet(); return; }
          if (idx == null) L.unshift({ at: nowStamp(), tx: t });
          else { L[idx].tx = t; L[idx].at = nowStamp(); }
          saveMemos(CUR, L);
          closeSheet(); drawDetail(); toast('메모가 저장되었습니다', true);
        });
      }
    });
  }

  /* ── 연락처 등록 — 전체 화면 (Figma 5359:13549) ──────────── */
  function openTel() {
    var i = $('#telIn');
    i.value = CUR.tel || '';
    $('#telClr').hidden = !i.value;
    $('#telCb').classList.add('on');
    telChk();
    show('#scrTel'); $('#tabbar').hidden = true;
  }
  function telFmt(v) {
    v = v.replace(/[^0-9]/g, '').slice(0, 11);
    if (v.length < 4) return v;
    if (v.length < 8) return v.slice(0, 3) + '-' + v.slice(3);
    return v.slice(0, 3) + '-' + v.slice(3, 7) + '-' + v.slice(7);
  }
  function telChk() {
    var v = $('#telIn').value.replace(/[^0-9]/g, '');
    $('#telOk').disabled = !(v.length >= 10 && $('#telCb').classList.contains('on'));
  }
  $('#telIn').addEventListener('input', function () {
    this.value = telFmt(this.value);
    $('#telClr').hidden = !this.value;
    telChk();
  });
  $('#telClr').addEventListener('click', function () {
    $('#telIn').value = ''; this.hidden = true; telChk();
  });
  /* 화면에 그린 iOS 키패드 — 기기 키보드 대신 이걸로 입력한다 */
  $('#kpad').addEventListener('click', function (e) {
    var b = e.target.closest('[data-k]'); if (!b) return;
    var el = $('#telIn'), v = el.value.replace(/[^0-9]/g, '');
    v = (b.dataset.k === 'bs') ? v.slice(0, -1) : (v + b.dataset.k).slice(0, 11);
    el.value = telFmt(v);
    $('#telClr').hidden = !el.value;
    telChk();
  });
  $('#telAgree').addEventListener('click', function (e) {
    if (e.target.closest('[data-help]')) return;
    $('#telCb').classList.toggle('on'); telChk();
  });
  $('#telX').addEventListener('click', function () { show('#scrDetail'); $('#tabbar').hidden = true; });
  $('#telOk').addEventListener('click', function () {
    APP.setTel(CUR.i, $('#telIn').value.trim());
    show('#scrDetail'); $('#tabbar').hidden = true;
    drawDetail(); toast('연락처를 등록했습니다', true);
  });

  /* ── 전체 주소 — 대표 주소 설정 (Figma 5471:22059) ───────── */
  var ADSEL = 0, ADSORT = 'live';
  function openAddrs() {
    ADSEL = 0; drawAddrs();
    show('#scrAddr'); $('#tabbar').hidden = true;
  }
  function adOrder() {
    var L = CUR.addrs.map(function (a, i) { return { a: a, i: i }; });
    var rank = { high: 0, mid: 1, low: 2 };
    if (ADSORT === 'live') L.sort(function (p, q) { return rank[p.a.live.k] - rank[q.a.live.k]; });
    else L.sort(function (p, q) { return distTo(p.a, ME) - distTo(q.a, ME); });
    return L;
  }
  function drawAddrs() {
    var L = adOrder();
    $('#adCnt').textContent = L.length;
    $('#adSort').querySelector('span').textContent = ADSORT === 'live' ? '거주 가능성 높은 순' : '가까운 순';
    $('#adList').innerHTML = L.map(function (o) {
      var a = o.a;
      return '<div class="adrow' + (o.i === ADSEL ? ' on' : '') + '" role="button" tabindex="0" data-ad="' + o.i + '">'
        + '<span class="cb rd' + (o.i === ADSEL ? ' on' : '') + '"></span>'
        + '<div class="c"><div class="z"><b>' + a.zip + '</b>'
        + '<span class="cp" data-adcp="' + o.i + '" role="button"><i class="ph ph-copy"></i></span>'
        + '<span class="sp"></span><span class="lv ' + a.live.k + '">' + a.live.nm + '</span></div>'
        + '<div class="tx">' + esc(a.full) + '</div>'
        + (a.other ? '<span class="tag">타인거주 확인</span>' : '')
        + '</div></div>';
    }).join('');
    $('#adList').querySelectorAll('[data-ad]').forEach(function (r) {
      r.addEventListener('click', function (e) {
        var cp = e.target.closest('[data-adcp]');
        if (cp) { e.stopPropagation(); copyAddr(CUR.addrs[+cp.dataset.adcp]); return; }
        ADSEL = +r.dataset.ad; drawAddrs();
      });
    });
  }
  $('#adSort').addEventListener('click', function () {
    pickSheet('정렬', ['거주 가능성 높은 순', '가까운 순'],
      ADSORT === 'live' ? '거주 가능성 높은 순' : '가까운 순',
      function (v) { if (v) ADSORT = (v === '가까운 순') ? 'near' : 'live'; drawAddrs(); });
  });
  $('#adX').addEventListener('click', function () { show('#scrDetail'); $('#tabbar').hidden = true; });
  $('#adOk').addEventListener('click', function () {
    APP.setPrimaryAddr(CUR.i, ADSEL);
    show('#scrDetail'); $('#tabbar').hidden = true;
    drawDetail(); refresh(); toast('대표 주소를 변경했습니다', true);
  });

  /* 방문 상태 변경 */
  /* 방문 상태 변경 */
  /* ── 방문 상태 변경 ─────────────────────────────────────────
     방문예정은 바로 반영, 수집불가·재방문예정은 사유를 묻는다.
     재방문예정은 사유를 묻기 전에 현관문 사진을 먼저 찍는다. (Figma 5148:26311 · 5196:19418) */
  var NOQ = {
    q1: { q: '수집 불가한 이유가 무엇인가요?',
      opts: ['위임 거절', '개인정보 수집 거부', '반복 부재'] },
    q2: { q: '우편물이나 배송물 등에서 주주의 이름을 확인할 수 있나요?', opts: ['네', '아니요'],
      only: ['반복 부재'] }                       /* 반복 부재일 때만 묻는다 */
  };
  var REQ = {
    q1: { q: '재방문해야 하는 이유가 무엇인가요?',
      opts: ['부재중(미응답)', '부재중(가족대면)', '타인 거주중', '보완 서류 필요'] },
    q2: { q: '우편물이나 배송물 등에서 주주의 이름을 확인할 수 있나요?', opts: ['네', '아니요'],
      only: ['부재중(미응답)', '부재중(가족대면)'] }   /* 부재중일 때만 묻는다 */
  };

  $('#dtState').addEventListener('click', openState);
  function openState() {
    sheet({
      title: '방문 상태 변경',
      body: '<div class="stlist">' + ['plan', 'replan', 'no'].map(function (k) {
        return '<button class="strow' + (CUR.st === k ? ' on' : '') + '" type="button" data-sst="' + k + '">'
          + ST[k].nm + '</button>';
      }).join('') + '</div>',
      after: function (bx) {
        bx.querySelectorAll('[data-sst]').forEach(function (b) {
          b.addEventListener('click', function () {
            var k = b.dataset.sst;
            closeSheet();
            if (k === 'plan') { applyState('plan', ''); return; }
            if (k === 'no') { setTimeout(function () { askReason('no'); }, 120); return; }
            setTimeout(openDoor, 120);              /* 재방문예정 — 현관문 촬영부터 */
          });
        });
      }
    });
  }
  function applyState(st, why) {
    APP.setState(CUR.i, st);
    histAdd(CUR, st, why);
    drawDetail(); refresh();
    toast(CUR.name + ' — ' + ST[st].nm + '으로 변경했습니다', true);
  }

  /* 사유 선택 시트 — 두 번째 질문은 조건에 맞을 때만 나온다 */
  function askReason(st, back) {
    var SPEC = st === 'no' ? NOQ : REQ;
    var a1 = '', a2 = '';
    function show2() { return SPEC.q2.only.indexOf(a1) >= 0; }
    function grp(key, spec, cur) {
      return '<div class="qgrp"><div class="q">' + esc(spec.q) + '</div>'
        + '<div class="qopts' + (spec.opts.length <= 2 ? '' : '') + '">'
        + spec.opts.map(function (o) {
            return '<button class="qopt' + (cur === o ? ' on' : '') + '" type="button" data-q="' + key + '" data-v="' + esc(o) + '">'
              + '<span class="rdo"></span>' + esc(o) + '</button>';
          }).join('') + '</div></div>';
    }
    function body() {
      return '<div class="qpanel">' + grp('q1', SPEC.q1, a1)
        + (show2() ? grp('q2', SPEC.q2, a2) : '') + '</div>';
    }
    sheet({
      title: st === 'no' ? '수집불가 사유를 선택해 주세요' : '재방문 사유를 선택해 주세요',
      back: back, body: body(),
      foot: '<button class="btn ink" type="button" id="rsOk2" disabled>선택 완료</button>',
      after: function (bx) {
        function paint() {
          bx.querySelector('.bb').innerHTML = body();
          bind();
          bx.querySelector('#rsOk2').disabled = !(a1 && (!show2() || a2));
        }
        function bind() {
          bx.querySelectorAll('[data-q]').forEach(function (b) {
            b.addEventListener('click', function () {
              if (b.dataset.q === 'q1') { if (a1 !== b.dataset.v) a2 = ''; a1 = b.dataset.v; }
              else a2 = b.dataset.v;
              paint();
            });
          });
        }
        bind();
        bx.querySelector('#rsOk2').addEventListener('click', function () {
          var why = a1 + (show2() && a2 ? ' · 이름 확인 ' + a2 : '');
          closeSheet();
          applyState(st, why);
        });
      }
    });
  }

  /* 현관문 사진 촬영 — 재방문예정 앞 단계 */
  var DOOR = { img: null };
  function openDoor() {
    DOOR.img = null; drawDoor();
    show('#scrDoor'); $('#tabbar').hidden = true;
  }
  $('#doorBack').addEventListener('click', function () {
    camStop(); show('#scrDetail'); $('#tabbar').hidden = true;
  });
  function drawDoor() {
    $('#doorBd').innerHTML = '<div class="pxh">현관문을 촬영해 주세요</div>'
      + '<div class="pxd">방문한 세대의 현관문이 보이도록 찍어 주세요. 사진은 방문 증빙으로 쓰입니다.</div>'
      + '<div class="camwrap door" id="dcW">'
      + (DOOR.img ? '<img src="' + DOOR.img + '" alt="촬영한 현관문">'
          : '<video id="dcV" playsinline muted autoplay></video>'
            + '<div class="guide"><div class="fr"></div></div>'
            + '<div class="hint">현관문이 테두리 안에 들어오게 맞춰 주세요</div>')
      + '</div>'
      + (DOOR.img
          ? '<div class="camdone"><i class="ph-fill ph-check-circle"></i>현관문 사진을 확인했습니다</div>'
            + '<div class="cambar"><button class="alt" type="button" id="dcRe">다시 촬영</button></div>'
          : '<div class="cambar"><button class="shutter" type="button" id="dcShot" aria-label="촬영"></button>'
            + '<button class="alt" type="button" id="dcPick">앨범에서 선택</button></div>'
            + '<input type="file" id="dcFile" accept="image/*" capture="environment" hidden>');

    var nx = $('#doorNext');
    nx.disabled = !DOOR.img;
    nx.onclick = function () {
      camStop();
      toast('사진 전송 성공', true);
      show('#scrDetail'); $('#tabbar').hidden = true;
      setTimeout(function () { askReason('replan', openDoor); }, 260);
    };
    if (DOOR.img) { $('#dcRe').addEventListener('click', function () { DOOR.img = null; drawDoor(); }); return; }

    var v = $('#dcV');
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          .then(function (st) { CAM.stream = st; v.srcObject = st; })
          .catch(fail)
      : fail();
    function fail() {
      $('#dcW').innerHTML = '<div class="off"><i class="ph ph-camera-slash"></i>'
        + '카메라를 사용할 수 없습니다.<br>앨범에서 사진을 선택해 주세요.</div>';
      var sh = $('#dcShot'); if (sh) sh.style.display = 'none';
    }
    $('#dcShot').addEventListener('click', function () {
      if (!CAM.stream) { $('#dcFile').click(); return; }
      var w = v.videoWidth, h = v.videoHeight; if (!w) return;
      DOOR.img = shrink(v, w, h); camStop(); drawDoor();
    });
    $('#dcPick').addEventListener('click', function () { $('#dcFile').click(); });
    $('#dcFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () { DOOR.img = shrink(im, im.width, im.height); camStop(); drawDoor(); };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    });
  }
  /* 사진은 1024px 폭 JPEG 로 줄인다 — 현관문 사진은 남기지 않고 전송만 한다 */
  function shrink(src, w, h) {
    var c = document.createElement('canvas'), k = Math.min(1, 1024 / w);
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  /* ══ 위임 진행 — 약관 → 행사방향 → 전자서명 → 신분증 ═══════ */
  var PX = null;
  var AGREE = [
    { k: 'a1', req: true,  t: '의결권 위임 및 대리행사 동의' },
    { k: 'a2', req: true,  t: '개인정보 수집 · 이용 동의' },
    { k: 'a3', req: true,  t: '고유식별정보 처리 동의' }
  ];

  $('#dtStart').addEventListener('click', function () {
    if (CUR.st === 'done') {
      var px = APP.proxyOf(CUR.i);
      sheet({
        title: '위임장',
        body: '<div style="color:#171717;font-size:14px;line-height:1.7"><b>' + esc(CUR.name) + '</b> 님의 위임장은 검증까지 끝났습니다.<br>'
          + '행사 주식 ' + cm(CUR.sh) + '주 · 처리 ' + esc(CUR.at || '-') + '</div>'
          + (px && px.sign
              ? '<div style="margin-top:14px;font-size:12px;color:#8A8F99;font-weight:700">전자서명</div>'
                + '<img src="' + px.sign + '" alt="전자서명" style="width:100%;margin-top:6px;border:1px solid #E5E5E5;border-radius:12px;background:#fff">'
              : '')
          + (px && px.idImg
              ? '<div style="margin-top:14px;font-size:12px;color:#8A8F99;font-weight:700">신분증</div>'
                + '<img src="' + px.idImg + '" alt="신분증" style="width:100%;margin-top:6px;border-radius:12px">'
              : ''),
        foot: '<button class="btn" type="button" data-ovx>확인</button>'
      });
      return;
    }
    PX = { step: 0, agree: {}, votes: {}, sign: null, idImg: null };
    AGREE.forEach(function (a) { PX.agree[a.k] = false; });
    pxDraw();
    show('#scrPx'); $('#tabbar').hidden = true;
  });
  $('#pxX').addEventListener('click', pxQuit);
  $('#pxBack').addEventListener('click', function () {
    if (PX.step === 0) { pxQuit(); return; }
    camStop(); PX.step--; pxDraw();
  });
  function pxQuit() {
    if (PX && PX.step >= 1 && PX.step <= 4) {
      sheet({
        mid: true, title: '작성을 그만두시겠어요?',
        body: '지금까지 입력한 내용은 저장되지 않습니다.',
        foot: '<button class="btn gh" type="button" data-ovx>이어서 작성</button>'
          + '<button class="btn" type="button" id="pxQ2">그만두기</button>',
        after: function (bx) {
          bx.querySelector('#pxQ2').addEventListener('click', function () {
            closeSheet(); camStop(); show('#scrDetail'); $('#tabbar').hidden = true;
          });
        }
      });
      return;
    }
    camStop(); show('#scrDetail'); $('#tabbar').hidden = true;
  }

  var PX_TITLE = ['약관 동의', '전자문서 서명', '전자서명', '실명 인증', '신분증 촬영', '위임 완료'];
  function pxDraw() {
    $('#pxTitle').textContent = PX_TITLE[PX.step];
    $$('.pxsteps .b').forEach(function (b, i) { b.classList.toggle('on', i <= Math.min(3, PX.step - (PX.step > 3 ? 1 : 0))); });
    $('#pxBack').style.visibility = PX.step === 5 ? 'hidden' : '';
    $('#pxX').style.visibility = PX.step === 5 ? 'hidden' : '';
    $('#pxAlt').hidden = true;
    var f = [pxAgree, pxDoc, pxSign, pxVerify, pxCam, pxDone][PX.step];
    f();
    $('#pxBd').scrollTop = 0;
  }
  function pxNextBtn(label, on, fn) {
    var b = $('#pxNext');
    b.textContent = label; b.disabled = !on;
    b.onclick = fn;
  }

  /* 1) 약관 동의 — 내용은 아래에서 올라오는 모달에서 받는다 */
  function pxAgree() {
    $('#pxBd').innerHTML = '<div class="pxwrap">'
      + '<div class="pxh">위임에 필요한 약관에<br>동의해 주세요</div>'
      + '<div class="pxd">' + esc(CUR.name) + ' 님께 내용을 확인시켜 드린 뒤 동의를 받아 주세요.</div>'
      + '<div class="agstub" id="agOpen" role="button">'
      + '<i class="ph ph-file-text"></i><span class="t">약관 전체 보기 · 동의하기</span>'
      + '<i class="ph ph-caret-right"></i></div></div>';
    $('#agOpen').addEventListener('click', agSheet);
    var ok = AGREE.every(function (a) { return !a.req || PX.agree[a.k]; });
    pxNextBtn('다음', ok, function () { PX.step = 1; pxDraw(); });
    if (!ok) setTimeout(agSheet, 120);        /* 위임을 시작하면 바로 올라온다 */
  }
  function agSheet() {
    function body() {
      var all = AGREE.every(function (a) { return PX.agree[a.k]; });
      return '<button class="agall' + (all ? ' on' : '') + '" type="button" id="agAll">'
        + '<span class="cb' + (all ? ' on' : '') + '"></span><span class="t">전체 동의하기</span></button>'
        + '<div class="aglist">' + AGREE.map(function (a) {
            return '<div class="agrow"><span class="cb' + (PX.agree[a.k] ? ' on' : '') + '" data-ag="' + a.k + '" role="button"></span>'
              + '<span class="t" data-ag="' + a.k + '" role="button"><em>[필수]</em>' + esc(a.t) + '</span>'
              + '<span class="go" data-help="' + esc(a.t) + '" role="button"><i class="ph ph-caret-right"></i></span></div>';
          }).join('') + '</div>';
    }
    sheet({
      title: '약관 동의',
      body: '<div id="agBody">' + body() + '</div>',
      foot: '<button class="btn" type="button" id="agGo">동의하고 계속하기</button>',
      after: function (bx) {
        function bind() {
          bx.querySelector('#agAll').addEventListener('click', function () {
            var v = !AGREE.every(function (a) { return PX.agree[a.k]; });
            AGREE.forEach(function (a) { PX.agree[a.k] = v; }); redraw();
          });
          bx.querySelectorAll('[data-ag]').forEach(function (b) {
            b.addEventListener('click', function () { PX.agree[b.dataset.ag] = !PX.agree[b.dataset.ag]; redraw(); });
          });
          bx.querySelector('#agGo').disabled = !AGREE.every(function (a) { return !a.req || PX.agree[a.k]; });
        }
        function redraw() { bx.querySelector('#agBody').innerHTML = body(); bind(); }
        bind();
        bx.querySelector('#agGo').addEventListener('click', function () {
          if (this.disabled) return;
          closeSheet(); PX.step = 1; pxDraw();
        });
      }
    });
  }

  /* 2) 전자문서 서명 — 위임장을 보여 주고 서명란을 눌러 서명 화면으로 간다 */
  function pxAgenda() {
    var A = (CX.agenda || []).filter(function (a) { return !a.header; });
    return A.length ? A : [{ no: '제1호', nm: '재무제표 승인의 건' }];
  }
  function pxDoc() {
    var A = pxAgenda();
    A.forEach(function (a, i) { if (!PX.votes[i]) PX.votes[i] = '찬성'; });
    var M = (window.CX && CX.meeting) || {};
    var camp = (APP.CAMPAIGNS || []).filter(function (c) { return c.id === CUR.camp; })[0] || {};
    var org = CUR.org || M.org || '';
    var term = camp.term || M.name || '';
    var d = new Date();
    var ymd = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + d.getHours() + '시';
    var mdate = (M.dateText || (d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'));
    var sh = cm(CUR.sh);
    /* 주민번호 — 생년월일 앞 6자리만 보이고 뒤는 가린다 */
    var rrn = String(CUR.born || '').replace(/\D/g, '').slice(2) + '-' + (CUR.sex === '남성' ? '1' : '2') + '******';

    $('#pxBd').innerHTML = '<div class="pxwrap">'
      + '<div class="pxh">위임장을 확인하고<br>서명해 주세요</div>'
      + '<div class="pxd">' + esc(CUR.name) + ' 님께 내용을 보여 드린 뒤 주주명 서명란에 직접 서명받아 주세요.</div>'
      + '<div class="pdoc">'
      + '<h4>위 임 장</h4>'
      + '<p class="lead">본인은 ' + esc(mdate) + '에 개최하는 ' + esc(org) + '의 ' + esc(term) + '에서 '
      + '권유자 ㈜아이알큐더스가 지정하는 (정재원, 신원표) 중 1인을 그 대리인으로 정하고 '
      + '다음의 내용과 같이 찬반표시에 따라 의결권을 행사할 것을 위임합니다.</p>'
      + '<div class="dash">- 다 음 -</div>'
      + '<ol class="nums">'
      + '<li>소유 주식수 : <b>' + sh + '</b>주</li>'
      + '<li>의결권 있는 주식수 : <b>' + sh + '</b>주</li>'
      + '<li>위임할 주식수 : <b>' + sh + '</b>주</li>'
      + '<li>주주총회 목적사항 및 목적사항별 찬반 여부'
      + '<table class="ptbl"><thead><tr><th class="c w1">의안</th><th>주주총회 목적사항</th>'
      + '<th class="c w2">찬성</th><th class="c w2">반대</th></tr></thead><tbody>'
      + A.map(function (a, i) {
          return '<tr><td class="c">' + esc(String(a.no).replace(/[^0-9-]/g, '')) + '</td>'
            + '<td>' + esc(a.nm) + '</td>'
            + '<td class="c"><span class="mk">✓</span></td><td class="c"></td></tr>';
        }).join('')
      + '</tbody></table></li>'
      + '<li>새로 상정된 안건이나 변경·수정 안건 등에 대한 의결권의 행사 위임'
      + '<p class="sub">· 주주총회 시 새로이 상정된 안건이나 각호 의안에 대한 수정안이 상정될 경우에는 '
      + '대리인이 주주의 의사표시가 위 4번 항목에서 표시된 찬반의 취지에 합치된다고 합리적으로 판단되는 바에 따라 '
      + '의결권을 행사할 것을 위임합니다.</p>'
      + '<p class="sub">· 다만, 아래의 명시적으로 지시한 사항에 대해서는 주주가 주주총회 전까지 별도의 의사표시가 없는 한 '
      + '아래의 지시한 대로 의결권을 행사하겠습니다.</p>'
      + '<table class="ptbl"><thead><tr><th class="c w3">항 목</th><th>지시내용</th></tr></thead>'
      + '<tbody><tr><td class="c">-</td><td>&nbsp;</td></tr></tbody></table></li>'
      + '</ol>'
      + '<div class="sign">'
      + '<div class="sr"><span class="k">주주명</span><span class="v">' + esc(CUR.name) + '</span>'
      + '<span class="sbox' + (PX.sign ? ' has' : '') + '" id="docSign" role="button">'
      + (PX.sign ? '<img src="' + PX.sign + '" alt="전자서명">'
                 : '<span class="ph2"><i class="ph ph-pencil-simple-line"></i>서명 또는 날인</span>')
      + '</span></div>'
      + '<div class="sr"><span class="k">주민번호</span><span class="v">' + esc(rrn) + '</span></div>'
      + '<div class="sr"><span class="k">위임일자 및 시간</span><span class="v">' + esc(ymd) + '</span></div>'
      + '</div></div></div>';
    $('#docSign').addEventListener('click', function () { PX.step = 2; pxDraw(); });
    pxNextBtn('다음', !!PX.sign, function () { PX.step = 3; pxDraw(); });
  }

  /* 3) 실명 인증 안내 */
  function pxVerify() {
    var M = (window.CX && CX.meeting) || {};
    var camp = (APP.CAMPAIGNS || []).filter(function (c) { return c.id === CUR.camp; })[0] || {};
    $('#pxBd').innerHTML = '<div class="vfy">'
      + '<div class="colg"><img src="' + (APP.logoOf ? APP.logoOf(CUR.org) : 'assets/logo-kudoselectric.png') + '" alt="' + esc(CUR.org || '') + '"></div>'
      + '<div class="h">신분증으로 실명을 인증해 주세요</div>'
      + '<div class="d">신분증이 없다면 사업자등록증, 법인인감증명서, 명함 등 기타 서류로도 인증할 수 있습니다.</div>'
      + '<div class="bx"><div class="bt">신분증 정보는 주주총회 종료 후 안전하게 폐기됩니다</div>'
      + '<div class="r"><span class="k">사용 목적</span><span class="v">' + esc((CUR.org || M.org || '') + ' ' + (camp.term || M.name || '')) + '</span></div>'
      + '<div class="r"><span class="k">개최 일시</span><span class="v">' + esc(M.dateText || '') + '</span></div>'
      + '<div class="r"><span class="k">파기 시점</span><span class="v">주주총회 종료 후 영구 폐기</span></div>'
      + '</div></div>';
    var alt = $('#pxAlt');
    alt.hidden = false;
    alt.onclick = function () { toast('기타 서류 인증은 운영팀 확인 후 처리됩니다'); };
    pxNextBtn('신분증 인증', true, function () { PX.step = 4; pxDraw(); });
  }

  /* 4) 전자서명 — 캔버스에 직접 그린다 */
  function pxSign() {
    $('#pxBd').innerHTML = '<div class="pxwrap">'
      + '<div class="pxh">주주 본인이<br>서명해 주세요</div>'
      + '<div class="pxd">아래 칸에 ' + esc(CUR.name) + ' 님이 직접 서명합니다.</div>'
      + '<div class="signbox" id="sgBox"><canvas id="sgCv"></canvas>'
      + '<div class="line"></div><div class="ph">이 칸에 서명해 주세요</div></div>'
      + '<div class="signbar"><button type="button" id="sgClr"><i class="ph ph-eraser"></i>다시 쓰기</button></div>'
      + '</div>';

    var box = $('#sgBox'), cv = $('#sgCv'), ctx = cv.getContext('2d');
    var dpr = window.devicePixelRatio || 1, drawn = false, down = false;
    function fit() {
      var r = box.getBoundingClientRect();
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      if (PX.sign) { var im = new Image(); im.onload = function () { ctx.drawImage(im, 0, 0, r.width, r.height); }; im.src = PX.sign; }
    }
    setTimeout(fit, 0);
    function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', function (e) {
      down = true; cv.setPointerCapture(e.pointerId);
      var p = pos(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      if (!drawn) { drawn = true; box.classList.add('has'); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return;
      var p = pos(e); ctx.lineTo(p[0], p[1]); ctx.stroke();
      pxNextBtn('서명 완료', true, goNext);
    });
    function up() { down = false; }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    $('#sgClr').addEventListener('click', function () {
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawn = false; box.classList.remove('has'); PX.sign = null;
      pxNextBtn('서명 완료', false, null);
    });
    function goNext() { PX.sign = cv.toDataURL('image/png'); PX.step = 3; pxDraw(); }   /* 서명을 마치면 실명 인증으로 */
    if (PX.sign) { box.classList.add('has'); drawn = true; }
    pxNextBtn('서명 완료', !!PX.sign, goNext);
  }

  /* 4) 신분증 촬영 — 앱 안 카메라 + 가이드 프레임 */
  var CAM = { stream: null, timer: null };
  function camStop() {
    if (CAM.timer) { clearInterval(CAM.timer); CAM.timer = null; }
    if (CAM.stream) { CAM.stream.getTracks().forEach(function (t) { t.stop(); }); CAM.stream = null; }
  }

  /* 가이드 테두리 안이 카드로 가득 차고 흔들림이 멎으면 스스로 찍는다.
     테두리 쪽 밝기 변화(모서리)와 가운데 영역의 안정도를 같이 본다. */
  function autoShot(v, fire) {
    var cv = document.createElement('canvas'), W = 64, H = 40;
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d', { willReadFrequently: true });
    var prev = null, steady = 0, done = false;
    function hint(t, ok) {
      var el = $('#camW') && $('#camW').querySelector('.ahint');
      if (!el) return;
      el.textContent = t; el.classList.toggle('ok', !!ok);
    }
    CAM.timer = setInterval(function () {
      if (done || !CAM.stream || !v.videoWidth) return;
      /* 가이드 테두리와 같은 비율(1.55:1)로 가운데를 잘라 본다 */
      var vw = v.videoWidth, vh = v.videoHeight;
      var cw = Math.min(vw, vh * 1.55), ch = cw / 1.55;
      g.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, W, H);
      var d = g.getImageData(0, 0, W, H).data, lum = new Float32Array(W * H);
      for (var i = 0, n = 0; i < d.length; i += 4, n++) {
        lum[n] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      }
      /* 가운데가 충분히 밝고(카드가 들어옴) 테두리와 대비가 있어야 한다 */
      var cSum = 0, cN = 0, eSum = 0, eN = 0;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var val = lum[y * W + x];
        var edge = (x < 4 || x > W - 5 || y < 3 || y > H - 4);
        if (edge) { eSum += val; eN++; } else { cSum += val; cN++; }
      }
      var cAvg = cSum / cN, eAvg = eSum / eN, contrast = Math.abs(cAvg - eAvg);
      /* 흔들림 — 직전 프레임과의 차이 */
      var diff = 0;
      if (prev) { for (var k = 0; k < lum.length; k++) diff += Math.abs(lum[k] - prev[k]); diff /= lum.length; }
      prev = lum;
      var filled = cAvg > 0.28 && contrast > 0.045;
      var still = prev && diff < 0.022;
      if (filled && still) { steady++; } else { steady = 0; }
      if (steady >= 4) {                       /* 약 0.8초 유지되면 촬영 */
        done = true; hint('촬영합니다', true);
        var fr = $('#camW'); if (fr) fr.classList.add('flash');
        setTimeout(function () { fire(); }, 260);
        return;
      }
      hint(filled ? (still ? '인식 중…' : '잠시 멈춰 주세요') : '테두리 안에 신분증을 맞춰 주세요', filled && still);
    }, 200);
  }
  function pxCam() {
    $('#pxBd').innerHTML = '<div class="camscr' + (PX.idImg ? ' shot' : '') + '">'
      + '<div class="ct">표시된 영역에 신분증을 맞춰 주세요.</div>'
      + '<div class="camwrap" id="camW">'
      + (PX.idImg
          ? '<img src="' + PX.idImg + '" alt="촬영한 신분증">'
          : '<video id="camV" playsinline muted autoplay></video>'
            + '<div class="guide"><span class="c tl"></span><span class="c tr"></span>'
            + '<span class="c bl"></span><span class="c br"></span></div>'
            + '<div class="ahint">테두리 안에 신분증을 맞춰 주세요</div>')
      + '</div>'
      + '<div class="cguide">어두운 배경에서 촬영해 주세요.<br>빛이 반사되지 않도록 방향을 조정해 주세요.</div>'
      + (PX.idImg
          ? '<div class="cambar"><button class="alt" type="button" id="camRe">다시 촬영</button></div>'
          : '<div class="cambar"><button class="shutter" type="button" id="camShot" aria-label="촬영"></button></div>'
            + '<input type="file" id="camFile" accept="image/*" capture="environment" hidden>')
      + '</div>';

    if (PX.idImg) {
      $('#camRe').addEventListener('click', function () { PX.idImg = null; pxDraw(); });
      pxNextBtn('위임장 전송', true, pxSubmit);
      return;
    }

    var v = $('#camV');
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          .then(function (st) { CAM.stream = st; v.srcObject = st; })
          .catch(camFail)
      : camFail();

    function camFail() {
      /* 권한이 막히거나 카메라가 없으면 파일 선택으로 넘긴다 */
      $('#camW').innerHTML = '<div class="off"><i class="ph ph-camera-slash"></i>'
        + '카메라를 사용할 수 없습니다.<br>앨범에서 신분증 사진을 선택해 주세요.</div>';
      var sh = $('#camShot'); if (sh) sh.onclick = function () { $('#camFile').click(); };
    }
    function shoot() {
      var vw = v.videoWidth, vh = v.videoHeight; if (!vw) return;
      /* 화면의 가이드 테두리(1.55:1)와 같은 영역만 잘라 둔다 — 세로로 넓게 찍히지 않게 */
      var cw = Math.min(vw, vh * 1.55), ch = cw / 1.55;
      var sx = (vw - cw) / 2, sy = (vh - ch) / 2;
      var out = Math.min(1024, Math.round(cw));
      var c = document.createElement('canvas');
      c.width = out; c.height = Math.round(out / 1.55);
      c.getContext('2d').drawImage(v, sx, sy, cw, ch, 0, 0, c.width, c.height);
      PX.idImg = c.toDataURL('image/jpeg', 0.75);
      camStop(); pxDraw();
    }
    $('#camShot').addEventListener('click', function () {
      if (!CAM.stream) { $('#camFile').click(); return; }
      shoot();
    });
    autoShot(v, shoot);
    $('#camFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var cw = Math.min(im.width, im.height * 1.55), ch = cw / 1.55;
          var sx = (im.width - cw) / 2, sy = (im.height - ch) / 2;
          var out = Math.min(1024, Math.round(cw));
          var c = document.createElement('canvas');
          c.width = out; c.height = Math.round(out / 1.55);
          c.getContext('2d').drawImage(im, sx, sy, cw, ch, 0, 0, c.width, c.height);
          PX.idImg = c.toDataURL('image/jpeg', 0.75);
          camStop(); pxDraw();
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    });
    pxNextBtn('위임장 전송', false, null);
  }

  /* 다른 기기로 넘길 수 있도록 작게 줄인다 — 신분증은 240px 흑백, 서명은 300px */
  function shrink(src, w, q, gray, cb) {
    if (!src) return cb(null);
    var im = new Image();
    im.onload = function () {
      var sc = Math.min(1, w / im.width);
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * sc));
      c.height = Math.max(1, Math.round(im.height * sc));
      var g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      if (gray) {
        try {
          var d = g.getImageData(0, 0, c.width, c.height), a = d.data;
          for (var i = 0; i < a.length; i += 4) {
            var v = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0;
            a[i] = a[i + 1] = a[i + 2] = v;
          }
          g.putImageData(d, 0, 0);
        } catch (e) {}
      }
      cb(c.toDataURL('image/jpeg', q));
    };
    im.onerror = function () { cb(null); };
    im.src = src;
  }

  /* 전송 · 완료 */
  function pxSubmit() {
    camStop();
    APP.setState(CUR.i, 'done');
    APP.setProxy(CUR.i, { votes: PX.votes, sign: PX.sign, idImg: PX.idImg, at: CUR.at });
    /* 중계(다른 기기)로도 넘어가도록 가벼운 사본으로 바꿔 둔다 */
    shrink(PX.idImg, 560, 0.6, false, function (small) {
      shrink(PX.sign, 420, 0.6, false, function (sg) {
        APP.setProxy(CUR.i, { votes: PX.votes, sign: sg || PX.sign, idImg: small || PX.idImg, at: CUR.at });
      });
    });
    histAdd(CUR, 'done', '위임장 수령 · 전송 완료');
    PX.step = 5; pxDraw();
  }
  function pxDone() {
    var A = pxAgenda();
    var fo = A.filter(function (a, i) { return PX.votes[i] === '찬성'; }).length;
    $('#pxBd').innerHTML = '<div class="pxdone"><div class="ic"><i class="ph-fill ph-check-circle"></i></div>'
      + '<h3>위임장 전송을 마쳤습니다</h3>'
      + '<p>' + esc(CUR.name) + ' 님의 위임장이 CONEXUS 로 전송됐습니다.<br>'
      + '검증이 끝나면 사전 의결권 현황에 반영됩니다.</p></div>'
      + '<div class="pxsum">'
      + '<div class="r"><span class="k">주주</span><span class="v">' + esc(CUR.name) + '</span></div>'
      + '<div class="r"><span class="k">행사 주식</span><span class="v">' + cm(CUR.sh) + '주</span></div>'
      + '<div class="r"><span class="k">의안</span><span class="v">' + A.length + '건 중 찬성 ' + fo + '건</span></div>'
      + '<div class="r"><span class="k">처리 일시</span><span class="v">' + esc(CUR.at || '-') + '</span></div>'
      + '</div>';
    pxNextBtn('확인', true, function () {
      show('#scrDetail'); $('#tabbar').hidden = true;
      drawDetail(); refresh();
      toast(CUR.name + ' 님 위임 완료 — CONEXUS 로 전송했습니다', true);
    });
  }

  /* ══ 수집현황 ════════════════════════════════ */
  /* 카드 아래를 가로지르는 큰 호 — 진행중은 파랑 + 끝에 손잡이, 종료는 진회색 */
  function arc(pct, live) {
    /* 카드 폭을 가로지르는 얕은 원호 — 양 끝 y=96, 가운데 y=20 */
    var W = 402, H = 104, x0 = 8, x1 = W - 8, ye = 96, ya = 20;
    var c = (x1 - x0), sg = ye - ya;
    var R = (c * c / 4 + sg * sg) / (2 * sg);                 /* 현과 활꼴 높이로 반지름 */
    var cx = W / 2, cy = ye + (R - sg);                        /* 중심은 아래쪽 멀리 */
    var f0 = Math.atan2(ye - cy, x0 - cx), f1 = Math.atan2(ye - cy, x1 - cx);
    function pt(f) { var a = f0 + (f1 - f0) * f; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; }
    var d = 'M' + x0 + ' ' + ye + ' A' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 0 1 ' + x1 + ' ' + ye;
    var len = R * (f1 - f0);
    var f = Math.max(0, Math.min(1, pct / 100));
    var k = pt(f), col = live ? '#0071F3' : '#4B5058';
    var knob = live && f > 0.02 && f < 0.995;
    /* 진행중 카드는 0 에서 현재 값까지 차오르게 그린다 — animArcs() 가 시작시킨다 */
    return '<div class="arc"' + (live ? ' data-anim="1"' : '') + '>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '">'
      + '<path d="' + d + '" fill="none" stroke="#EDEFF2" stroke-width="14" stroke-linecap="round"/>'
      + (f > 0 ? '<path class="pg" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="14"'
          + ' stroke-linecap="round" data-f="' + f + '"'
          + ' stroke-dasharray="' + len.toFixed(1) + '"'
          + ' stroke-dashoffset="' + (live ? len.toFixed(1) : (len * (1 - f)).toFixed(1)) + '"/>' : '')
      + (knob ? '<circle class="kb" cx="' + k[0].toFixed(1) + '" cy="' + k[1].toFixed(1) + '" r="8"'
          + ' fill="#0071F3" stroke="#CFE3FF" stroke-width="6" opacity="0"/>' : '')
      + '</svg><div class="pct"' + (live ? ' data-cnt="' + pct + '"' : '') + '>' + pct + '% 달성</div></div>';
  }
  /* 원호가 차오르고 손잡이가 따라가며, 퍼센트 숫자도 같이 올라간다 */
  function animArcs() {
    $$('.arc[data-anim]').forEach(function (a) {
      var pg = a.querySelector('.pg'); if (!pg) return;
      var kb = a.querySelector('.kb'), lab = a.querySelector('.pct');
      var len = pg.getTotalLength(), f = +pg.dataset.f, tgt = +lab.dataset.cnt;
      var DUR = 1100, t0 = 0;
      pg.style.strokeDashoffset = len;
      lab.textContent = '0% 달성';
      function ease(t) { return 1 - Math.pow(1 - t, 3); }      /* easeOutCubic */
      function step(ts) {
        if (!t0) t0 = ts;
        var t = Math.min(1, (ts - t0) / DUR), e = ease(t), cur = f * e;
        pg.style.strokeDashoffset = len * (1 - cur);
        lab.textContent = Math.round(tgt * e) + '% 달성';
        if (kb) {
          var p = pg.getPointAtLength(len * cur);
          kb.setAttribute('cx', p.x); kb.setAttribute('cy', p.y);
          kb.setAttribute('opacity', t > 0.06 ? 1 : 0);
        }
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  function dot(d) { return (d || '').replace(/-/g, '.'); }
  function dday(due) {
    return Math.ceil((new Date(due + 'T00:00:00') - new Date('2026-09-30T00:00:00')) / 86400000);
  }
  function drawStat() {
    $('#statBd').innerHTML = APP.CAMPAIGNS.map(function (c) {
      var t = APP.stat(c.id), dd = dday(c.due), live = c.state === 'live';
      var badge = live
        ? '<span class="dd">' + (dd > 0 ? 'D-' + dd : 'D-DAY') + '</span>'
        : '<span class="dd end">종료</span>';
      return '<div class="cmp2' + (live ? '' : ' end') + '">'
        + '<div class="l1"><span class="co">' + esc(c.org) + '</span>' + badge + '</div>'
        + '<div class="tm">' + esc(c.term) + '</div>'
        + '<div class="box">'
        + '<div class="r"><span class="k">주주</span>'
        + '<span class="got">확보 ' + cm(t.sh) + '명</span><span class="goal">목표 ' + cm(t.goalSh) + '명</span></div>'
        + '<div class="r"><span class="k">주식 수</span>'
        + '<span class="got">확보 ' + cm(t.vt) + '주</span><span class="goal">목표 ' + cm(t.goalVt) + '주</span></div>'
        + '<div class="r term"><span class="k">수집 기간</span>'
        + '<span class="pr">' + dot(c.from) + ' ~ ' + dot(c.due) + '</span>'
        + (live ? '<span class="left">' + (dd > 0 ? dd + '일 남음' : '오늘 마감') + '</span>' : '') + '</div>'
        + '</div>'
        + arc(t.pct, live)
        + (live ? '' : '<div class="due2">마감일 ' + c.due.replace(/-/g, '.') + '</div>')
        + '</div>';
    }).join('')
      + '<div style="padding:4px 2px 24px;font-size:12px;color:#A3A3A3;line-height:1.6">'
      + '위임 완료로 바꾼 건은 CONEXUS 사전 의결권 현황의 실시간 주주 확보 현황과 권유대행 KPI 에 그대로 반영됩니다.</div>';
    animArcs();
  }

  /* ══ 소식 ════════════════════════════════════ */
  var NEWS = {
    noti: [
      { st: '진행중', c: 'blue', t: '큐더스전자 제10기 정기주주총회 권유 기간', x: '9월 30일까지 위임장 수령·검증을 마쳐야 사전 의결권에 반영됩니다. 검증 반려 건은 보완요청으로 표시됩니다.', d: '2026.09.14' },
      { st: '진행중', c: 'blue', t: '위임장 전자 서명 절차가 바뀌었습니다', x: '신분증 확인 후 의안별 행사 방향을 먼저 입력하고 서명을 받습니다. 순서가 바뀌면 검증에서 반려됩니다.', d: '2026.09.08' },
      { st: '예정', c: 'orange', t: '아이알큐더스 제2기 정기주주총회 명부 배정 예정', x: '10월 12일에 새 캠페인 명부가 배정됩니다. 담당 구역은 배정일에 안내됩니다.', d: '2026.09.02' },
      { st: '종료', c: 'gray', t: '추석 연휴 현장 방문 자제 안내', x: '9월 25일부터 27일까지는 방문 권유를 자제하고 유선 안내로 대체해 주세요.', d: '2026.08.28' }
    ],
    promo: [
      { st: '진행중', c: 'blue', t: '9월 위임 건수 챌린지', x: '기간 안에 위임 완료 20건을 넘기면 30,000 포인트를 드립니다. 현재 달성 현황은 수집현황에서 볼 수 있습니다.', d: '2026.09.20' },
      { st: '진행중', c: 'blue', t: '만보기 리워드 2배', x: '현장 방문이 많은 달이라 9월 한 달간 걸음 리워드를 두 배로 드립니다.', d: '2026.09.01' },
      { st: '종료', c: 'gray', t: '신규 파트너 추천 이벤트', x: '추천으로 합류한 파트너가 첫 위임을 완료하면 양쪽 모두에게 50,000 포인트를 드렸습니다.', d: '2026.07.15' }
    ]
  };
  var newsSeg = 'noti';
  $$('#newsSeg button').forEach(function (b) {
    b.addEventListener('click', function () {
      newsSeg = b.dataset.seg;
      $$('#newsSeg button').forEach(function (o) { o.classList.toggle('on', o === b); });
      drawNews();
    });
  });
  function drawNews() {
    $('#newsBd').innerHTML = NEWS[newsSeg].map(function (n, i) {
      return '<button class="nw" type="button" data-nw="' + i + '"><div class="c">'
        + '<span class="bg ' + n.c + '">' + n.st + '</span>'
        + '<div class="t">' + esc(n.t) + '</div><div class="x">' + esc(n.x) + '</div>'
        + '<div class="d">' + n.d + '</div></div><i class="ph ph-caret-right"></i></button>';
    }).join('');
    $('#newsBd').querySelectorAll('[data-nw]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = NEWS[newsSeg][+b.dataset.nw];
        sheet({ title: n.t, body: '<span class="bg ' + n.c + '">' + n.st + '</span><div style="margin-top:10px">' + esc(n.x) + '</div>'
          + '<div style="margin-top:14px;color:#A3A3A3;font-size:12px">' + n.d + '</div>',
          foot: '<button class="btn" type="button" data-ovx>확인</button>' });
      });
    });
  }

  /* ══ 설정 ════════════════════════════════════ */
  var NOTI = (function () {
    try { return JSON.parse(localStorage.getItem('cx.app.noti') || 'null'); } catch (e) { return null; }
  })() || { must: true, camp: true, news: true, promo: false };
  function drawSet() {
    var a = APP.auth.get() || { id: 'partner' };
    var done = APP.list().filter(function (x) { return x.st === 'done'; }).length;
    $('#setBd').innerHTML =
      '<div class="grp" style="margin-top:0">'
      + '<button class="li" type="button" id="setProfile"><i class="ph ph-user"></i>'
      + '<span class="t">내 프로필</span><i class="ph ph-caret-right"></i></button>'
      + '<button class="li" type="button" id="setSettle"><i class="ph ph-receipt"></i>'
      + '<span class="t">정산 내역</span><span class="r hi">100,000원 지급예정</span><i class="ph ph-caret-right"></i></button>'
      + '<div id="setNoti"></div>'
      + '</div>'

      + '<div class="grp"><div class="gh">업무 지원</div>'
      + li('ph-graduation-cap', '교육 센터', '수강 대기 2개', '', '교육 센터')
      + li('ph-gift', '프로모션 · 리워드', '320 포인트', '', '프로모션 · 리워드')
      + li('ph-footprints', '만보기', '9,344 걸음', '', '만보기')
      + '</div>'

      + '<div class="grp"><div class="gh">파트너센터</div>'
      + '<button class="li" type="button" id="setNotice"><i class="ph ph-megaphone"></i>'
      + '<span class="t">공지사항</span><i class="ph ph-caret-right"></i></button>'
      + '<button class="li" type="button" id="setFaq"><i class="ph ph-question"></i>'
      + '<span class="t">자주 묻는 질문</span><i class="ph ph-caret-right"></i></button>'
      + '</div>'

      + '<div class="grp"><div class="gh">약관 및 정책</div>'
      + li('ph-file-text', '서비스 약관보기', '4건', '', '서비스 약관보기')
      + '<div class="li"><i class="ph ph-info"></i><span class="t">버전 정보</span><span class="r">v.2.0.1</span></div>'
      + '</div>'

      + '<div class="grp"><button class="li" type="button" id="setReset"><i class="ph ph-arrow-counter-clockwise"></i>'
      + '<span class="t">시연 데이터 초기화</span><i class="ph ph-caret-right"></i></button>'
      + '<button class="li" type="button" id="setOut"><i class="ph ph-sign-out"></i>'
      + '<span class="t">로그아웃</span><i class="ph ph-caret-right"></i></button></div>'
      + '<div class="ver">CONEXUS 의결권 위임 플랫폼 · 시연용</div>';

    $('#setNoti').innerHTML = '<button class="li" type="button" id="setNotiBtn"><i class="ph ph-bell"></i>'
      + '<span class="t">알림 설정</span><span class="r">' + notiOn() + '개 켜짐</span><i class="ph ph-caret-right"></i></button>';
    $('#setNotiBtn').addEventListener('click', function () { ntDraw(); show('#scrNoti'); });
    $('#setProfile').addEventListener('click', openProfile);
    $('#setSettle').addEventListener('click', openSettle);
    $('#setNotice').addEventListener('click', function () { ncDraw(); show('#scrNotice'); });
    $('#setFaq').addEventListener('click', function () { fqDraw(); show('#scrFaq'); });
    $('#setReset').addEventListener('click', function () {
      sheet({
        mid: true, title: '시연 데이터 초기화',
        body: '앱에서 바꾼 방문 상태 · 메모 · 연락처 · 관심 주주와 '
          + '위임장(전자서명 · 신분증 사진)을 모두 지우고 처음 상태로 되돌립니다. '
          + 'CONEXUS 사전 의결권 현황에 넘긴 수집 결과도 함께 지워집니다.',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="rsOk">초기화</button>',
        after: function (bx) {
          bx.querySelector('#rsOk').addEventListener('click', function () {
            ['cx.collect', 'cx.app.book', 'cx.app.noti', 'cx.app.px', 'cx.app.hist'].forEach(function (k) {
              try { localStorage.removeItem(k); } catch (e) {}
            });
            location.reload();
          });
        }
      });
    });
    $('#setOut').addEventListener('click', function () {
      sheet({
        mid: true, title: '로그아웃', body: '로그아웃하면 다시 로그인해야 합니다.',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="soOk">로그아웃</button>',
        after: function (bx) {
          bx.querySelector('#soOk').addEventListener('click', function () {
            APP.auth.out(); closeSheet(); show('#scrLogin'); $('#tabbar').hidden = true; $('#lgPw').value = '';
          });
        }
      });
    });
  }
  /* ── 내 프로필 (Figma 5148:25712) ─────────────────────────── */
  var PROF = { nm: '도지연', since: '2026.03.02', tel: '010-2367-6429',
    mail: 'doji@irkudos.co.kr', org: '아이알큐더스', tier: '우수파트너 · 상위 7%' };
  function openProfile() {
    var done = APP.list().filter(function (x) { return x.st === 'done'; }).length;
    $('#pfBd').innerHTML =
      '<div class="pf-top">'
      + '<div class="pf-av"><i class="ph ph-user"></i></div>'
      + '<div class="pf-nm">' + esc(PROF.nm) + '</div>'
      + '<div class="pf-since">활동 시작일 ' + PROF.since + '</div>'
      + '<div class="pf-tier">' + esc(PROF.tier) + '</div></div>'

      + '<div class="pf-stats">'
      + '<div class="s"><div class="k">누적 수집</div><div class="v">' + cm(213 + done) + '</div></div>'
      + '<div class="s"><div class="k">평균 완료율</div><div class="v">90%</div></div>'
      + '<div class="s"><div class="k">보완 요청</div><div class="v">100%</div></div></div>'

      + '<div class="pf-lb">기본 정보</div>'
      + '<div class="pf-card">'
      + '<button class="pf-row" type="button" data-help="연락처 변경"><div class="c">'
      + '<div class="k">연락처</div><div class="v">' + esc(PROF.tel) + '</div></div>'
      + '<span class="go">변경하기<i class="ph ph-caret-right"></i></span></button>'
      + '<button class="pf-row" type="button" data-help="이메일 변경"><div class="c">'
      + '<div class="k">이메일</div><div class="v">' + esc(PROF.mail) + '</div></div>'
      + '<span class="go">변경하기<i class="ph ph-caret-right"></i></span></button></div>'

      + '<div class="pf-lb">소속 정보</div>'
      + '<div class="pf-org"><b>' + esc(PROF.org) + '</b>'
      + '<div>소속 정보 변경은 고객센터로 요청해 주세요.</div></div>'

      + '<button class="pf-quit" type="button" data-help="회원 탈퇴">회원 탈퇴</button>';
    show('#scrProfile'); $('#tabbar').hidden = true;
    $('#pfBd').scrollTop = 0;
  }
  $('#pfBack').addEventListener('click', function () { goTab('set'); });
  $('#pfOut').addEventListener('click', function () { $('#setOut') && $('#setOut').click(); });

  function li(ic, t, r, cls, help) {
    return '<button class="li" type="button" data-help="' + esc(help) + '"><i class="ph ' + ic + '"></i>'
      + '<span class="t">' + t + '</span>' + (r ? '<span class="r ' + cls + '">' + r + '</span>' : '')
      + '<i class="ph ph-caret-right"></i></button>';
  }
  function notiOn() { var n = 0; for (var k in NOTI) if (NOTI[k]) n++; return n; }
  function openNoti() {
    var ITEMS = [
      { k: 'must', nm: '필수 알림', s: '명부 배정 · 검증 반려 등', lock: true },
      { k: 'camp', nm: '캠페인 알림', s: '마감 임박 · 목표 달성' },
      { k: 'news', nm: '소식 알림', s: '공지사항 · 안내' },
      { k: 'promo', nm: '프로모션 알림', s: '리워드 · 이벤트' }
    ];
    sheet({
      title: '알림 설정',
      body: '<div style="padding:2px 0 8px">' + ITEMS.map(function (it) {
        return '<div class="li" style="padding:14px 0"><span class="t"><b style="color:#171717;font-weight:600">' + it.nm + '</b>'
          + '<div style="font-size:12px;color:#737373;margin-top:2px">' + it.s + (it.lock ? ' · 해제할 수 없습니다' : '') + '</div></span>'
          + '<span class="sw' + (NOTI[it.k] ? ' on' : '') + (it.lock ? ' lock' : '') + '" data-nt="' + it.k + '"'
          + (it.lock ? ' data-lock="1"' : '') + '></span></div>';
      }).join('') + '</div>',
      foot: '<button class="btn" type="button" data-ovx>확인</button>',
      after: function (bx) {
        bx.querySelectorAll('[data-nt]').forEach(function (s) {
          s.addEventListener('click', function () {
            if (s.dataset.lock) { toast('필수 알림은 해제할 수 없습니다'); return; }
            NOTI[s.dataset.nt] = !NOTI[s.dataset.nt];
            s.classList.toggle('on', NOTI[s.dataset.nt]);
            try { localStorage.setItem('cx.app.noti', JSON.stringify(NOTI)); } catch (e) {}
            drawSet();
          });
        });
      }
    });
  }


  /* ══ 정산 내역 ═════════════════════════════════
     달을 넘겨 가며 본다. 항목은 수수료(+) · 리워드(+) · 차감(−) 세 종류다. */
  var STL_CO = ['카카오뱅크', '네이버', '큐더스전자', 'SK하이닉스'];
  var STL = (function () {
    var out = {}, base = [
      { t: '위임장 수집 수수료', v: 9000 },
      { t: '만보 달성 리워드', v: 100, co: '' },
      { t: '위임장 수집 수수료', v: 9000 },
      { t: '위임장 보완 요청 차감', v: -8000 },
      { t: '위임장 수집 수수료', v: 9000 },
      { t: '위임장 수집 수수료', v: 9000 },
      { t: '교육 이수 리워드', v: 500, co: '' },
      { t: '위임장 수집 수수료', v: 9000 },
      { t: '중복 접수 차감', v: -9000 },
      { t: '위임장 수집 수수료', v: 9000 }
    ];
    [9, 8, 7].forEach(function (m, mi) {
      out[m] = base.slice(0, 10 - mi * 2).map(function (b, i) {
        return { co: b.co === '' ? '' : STL_CO[(i + mi) % STL_CO.length], t: b.t, v: b.v,
                 d: '2026.0' + m + '.' + ('0' + (28 - i * 2)).slice(-2) + ' 15:00' };
      });
    });
    return out;
  })();
  var stlM = 9;
  function stlDraw() {
    var rows = STL[stlM] || [];
    var inSum = rows.filter(function (r) { return r.v > 0; }).reduce(function (a, r) { return a + r.v; }, 0);
    var outSum = rows.filter(function (r) { return r.v < 0; }).reduce(function (a, r) { return a + r.v; }, 0);
    var tot = inSum + outSum;
    var paid = stlM < 9;
    $('#stlBd').innerHTML =
      '<div class="stl-mo"><button type="button" id="stlPrev" aria-label="이전 달"><i class="ph ph-caret-left"></i></button>'
      + '<span class="m">' + stlM + '월</span>'
      + '<button type="button" id="stlNext" aria-label="다음 달"' + (stlM >= 9 ? ' disabled' : '') + '><i class="ph ph-caret-right"></i></button></div>'
      + '<div class="stl-sum"><div class="r1"><span class="st">' + (paid ? '지급 완료' : '지급 예정') + '</span>'
      + '<span class="dt">2026.' + ('0' + stlM).slice(-2) + '.' + (paid ? '10' : '10') + '</span></div>'
      + '<div class="amt">' + cm(tot) + '원</div>'
      + '<div class="sub"><span class="in">수입 +' + cm(inSum) + '</span><span class="out">차감 ' + cm(outSum) + '</span></div></div>'
      + (rows.length
          ? '<div class="stl-list">' + rows.map(function (r) {
              return '<div class="stl-row"><div class="c">'
                + (r.co ? '<div class="co">' + esc(r.co) + '</div>' : '')
                + '<div class="t">' + esc(r.t) + '</div><div class="d">' + esc(r.d) + '</div></div>'
                + '<div class="v' + (r.v < 0 ? ' mn' : '') + '">' + (r.v > 0 ? '+' : '') + cm(r.v) + '원</div></div>';
            }).join('') + '</div>'
          : '<div class="stl-empty">정산 내역이 없습니다.</div>');
    $('#stlPrev').addEventListener('click', function () { if (stlM > 7) { stlM--; stlDraw(); } });
    $('#stlNext').addEventListener('click', function () { if (stlM < 9) { stlM++; stlDraw(); } });
  }
  function openSettle() { stlDraw(); show('#scrSettle'); }
  $('#stlBack').addEventListener('click', function () { goTab('set'); });
  $('#stlCfg').addEventListener('click', function () { payDraw(); show('#scrPay'); });

  /* ── 정산금 지급 정보 ── */
  var BANK = (function () {
    try { return JSON.parse(localStorage.getItem('cx.app.bank') || 'null'); } catch (e) { return null; }
  })() || { bank: '국민은행', no: '0287692830980****', nm: '도지연' };
  function payDraw() {
    $('#payBd').innerHTML =
      '<div class="pay-h">정산 일정</div>'
      + '<div class="pay-bx"><div class="f"><div class="k">지급일</div><div class="v">매월 10일</div></div>'
      + '<div class="f"><div class="k">이번 달 지급예상 금액</div><div class="v">100,000원</div></div></div>'
      + '<div class="pay-h" style="margin-top:12px">계좌 정보</div>'
      + '<div class="pay-bx"><div class="f"><div class="k">은행</div><div class="v">' + esc(BANK.bank) + '</div></div>'
      + '<div class="f"><div class="k">계좌번호</div><div class="v">' + esc(BANK.no) + '</div></div>'
      + '<div class="f"><div class="k">예금주</div><div class="v">' + esc(BANK.nm) + '</div></div></div>'
      + '<div class="pay-btn"><button type="button" id="payEdit">계좌정보 수정</button></div>';
    $('#payEdit').addEventListener('click', function () { bankDraw(); show('#scrBank'); });
  }
  $('#payBack').addEventListener('click', function () { show('#scrSettle'); });

  /* ── 계좌정보 수정 ── */
  var BANKS = ['국민은행', '신한은행', '하나은행', '우리은행', '농협은행', '기업은행', '카카오뱅크', '토스뱅크', '케이뱅크', '새마을금고'];
  function bankDraw() {
    $('#bkBd').innerHTML =
      '<div class="bk-warn"><i class="ph-fill ph-warning"></i><span>계좌정보 수정은 <b>당월 정산일 기준 3일 전</b>까지 완료해야 해당 월 정산에 반영됩니다.</span></div>'
      + '<div class="bk-f"><div class="lb">은행<em>*</em></div>'
      + '<select id="bkBank"><option value="">계좌의 은행을 선택해 주세요.</option>'
      + BANKS.map(function (b) { return '<option' + (b === BANK.bank ? ' selected' : '') + '>' + b + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="bk-f"><div class="lb">계좌번호<em>*</em></div>'
      + '<input id="bkNo" inputmode="numeric" placeholder="계좌번호를 입력해 주세요."></div>'
      + '<div class="bk-f"><div class="lb">예금주<em>*</em></div>'
      + '<input id="bkNm" placeholder="예금주를 입력해 주세요."></div>';
    function sync() {
      $('#bkOk').disabled = !($('#bkBank').value && $('#bkNo').value.trim() && $('#bkNm').value.trim());
    }
    ['#bkBank', '#bkNo', '#bkNm'].forEach(function (id) {
      $(id).addEventListener('input', sync); $(id).addEventListener('change', sync);
    });
    sync();
  }
  $('#bkBack').addEventListener('click', function () { show('#scrPay'); });
  $('#bkOk').addEventListener('click', function () {
    if (this.disabled) return;
    BANK = { bank: $('#bkBank').value, no: $('#bkNo').value.trim(), nm: $('#bkNm').value.trim() };
    try { localStorage.setItem('cx.app.bank', JSON.stringify(BANK)); } catch (e) {}
    payDraw(); show('#scrPay'); toast('계좌정보를 변경했습니다');
  });

  /* ══ 알림 설정 ═════════════════════════════════ */
  var NTG = [
    { g: '업무', items: [
      { k: 'must', t: '위임 보완 요청 (필수)', s: '서류 미비 또는 위임장 보완이 필요할 때 알려드려요\n※ 미차단 시 정산금에서 제외될 수 있어요', lock: true },
      { k: 'revisit', t: '재방문 일정', s: '재방문예정 시간이 다가오면 알려드려요' },
      { k: 'assign', t: '새로운 배정', s: '새로운 주주가 배정되면 알려드려요' },
      { k: 'deadline', t: '수집 마감', s: '마감 1시간 전에 미완료 건을 알려드려요' },
      { k: 'done', t: '완료 처리', s: '수집 완료 처리가 확인되면 알려드려요' }
    ] },
    { g: '정산', items: [
      { k: 'payDone', t: '정산 완료', s: '수수료가 계좌로 입금되면 알려드려요' },
      { k: 'payPlan', t: '정산 예정', s: '정산일 3일 전에 미리 알려드려요' }
    ] },
    { g: '안내 및 혜택', items: [
      { k: 'news', t: '공지사항', s: '중요 공지 및 업데이트 소식을 알려드려요' },
      { k: 'promo', t: '혜택·이벤트', s: '추가 수익을 얻을 수 있는 혜택을 알려드려요' },
      { k: 'edu', t: '교육 자료', s: '새 교육 자료가 등록되면 알려드려요' }
    ] }
  ];
  function ntDraw() {
    NTG.forEach(function (g) { g.items.forEach(function (it) { if (NOTI[it.k] == null) NOTI[it.k] = it.k !== 'assign'; }); });
    NOTI.must = true;
    $('#ntBd').innerHTML = NTG.map(function (g) {
      return '<div class="nt-g"><div class="gh">' + g.g + '</div>'
        + g.items.map(function (it) {
            return '<div class="nt-row"><div class="c"><div class="t">' + esc(it.t) + '</div>'
              + '<div class="s">' + esc(it.s).replace(/\n/g, '<br>') + '</div></div>'
              + '<span class="sw' + (NOTI[it.k] ? ' on' : '') + (it.lock ? ' lock' : '') + '" data-nt="' + it.k + '"'
              + (it.lock ? ' data-lock="1"' : '') + '></span></div>';
          }).join('') + '</div>';
    }).join('');
    $('#ntBd').querySelectorAll('[data-nt]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        if (sw.dataset.lock) { toast('필수 알림은 해제할 수 없습니다'); return; }
        NOTI[sw.dataset.nt] = !NOTI[sw.dataset.nt];
        sw.classList.toggle('on', NOTI[sw.dataset.nt]);
        try { localStorage.setItem('cx.app.noti', JSON.stringify(NOTI)); } catch (e) {}
      });
    });
  }
  $('#ntBack').addEventListener('click', function () { goTab('set'); });

  /* ══ 공지사항 ══════════════════════════════════ */
  var NOTICE = [
    { imp: true, t: '5월 카카오뱅크 위임장 수집 마감일 안내', d: '2026.05.02',
      b: '안녕하세요, 파트너 여러분.\n카카오뱅크 위임장 수집 프로젝트의 마감 일정 및 서류 보완(재확인) 기한을 안내해 드립니다.\n안전하고 정확한 수집 완료를 위해 아래 일정을 반드시 준수해 주시기 바랍니다.\n\n1. 위임장 수집 기간\n  · 2026.05.01(금) ~ 2026.05.25(월) 18:00 까지\n  ※ 5월 25일 18:00 이후에 제출된 위임장은 실적으로 인정되지 않습니다.\n\n2. 재확인(보완) 요청 처리 기한\n  · 수집 기간 동안 운영팀에서 검수 후 발송되는 [재확인] 건은 2026.05.25(월) 18:00까지 최종 수정 및 재제출이 완료되어야 합니다.\n  · 기한 내에 보완되지 않은 서류는 무효 처리될 수 있으니, [재확인] 알림을 받으시면 즉시 현장 확인 및 수정을 부탁드립니다.\n\n파트너 여러분의 안전한 활동과 성실한 수집에 늘 감사드립니다.' },
    { t: '앱 업데이트 안내 (v.2.0.1)', d: '2026.05.02',
      b: '지도 화면의 추천 주주 보기와 정산 내역 화면이 추가되었습니다. 앱을 최신 버전으로 업데이트해 주세요.' },
    { t: '4월 정산 완료 안내', d: '2026.05.02', b: '4월 정산이 완료되어 등록하신 계좌로 입금되었습니다. 상세 내역은 설정 > 정산 내역에서 확인하실 수 있습니다.' },
    { t: '3월 정산 완료 안내', d: '2026.04.02', b: '3월 정산이 완료되어 등록하신 계좌로 입금되었습니다.' },
    { t: '2월 정산 완료 안내', d: '2026.03.02', b: '2월 정산이 완료되어 등록하신 계좌로 입금되었습니다.' }
  ];
  function ncDraw() {
    $('#ncBd').innerHTML = NOTICE.map(function (n, i) {
      return '<div class="nc-it" data-nc="' + i + '"><button class="nc-hd" type="button"><div class="c">'
        + '<div class="t">' + (n.imp ? '<span class="bg2">중요</span>' : '') + esc(n.t) + '</div>'
        + '<div class="d">' + n.d + '</div></div><i class="ph ph-caret-down"></i></button>'
        + '<div class="nc-bd">' + esc(n.b) + '</div></div>';
    }).join('');
    $('#ncBd').querySelectorAll('[data-nc]').forEach(function (it) {
      it.querySelector('.nc-hd').addEventListener('click', function () { it.classList.toggle('on'); });
    });
  }
  $('#ncBack').addEventListener('click', function () { goTab('set'); });

  /* ══ 자주 묻는 질문 ════════════════════════════ */
  var FAQ = [
    { c: '수집 수수료', q: '수집 수수료는 언제 지급되나요?', a: '매월 1일부터 말일까지 완료된 위임장을 기준으로 집계하여, 다음 달 10일에 등록하신 계좌로 입금됩니다.' },
    { c: '리워드', q: '리워드는 어떤 기준으로 적립되나요?', a: '만보기 달성, 교육 이수, 캠페인 챌린지 달성 시 적립되며 정산 내역에서 항목별로 확인하실 수 있습니다.' },
    { c: '차감', q: '차감 내역은 어디서 확인할 수 있나요?', a: '설정 > 정산 내역에서 해당 월을 선택하면 차감 건이 빨간색으로 표시됩니다.' },
    { c: '배정', q: '배정 기준은 어떻게 되나요?', a: '담당 구역과 활동 이력, 최근 수집 성과를 종합해 배정되며 배정일에 알림으로 안내드립니다.' },
    { c: '서비스이용', q: '카테고리가 많아서 원하는 내역 찾기가 어려워요. 정산 내역 화면 스와이프가 불편해요.', a: '정산 내역 상단의 월 이동 버튼으로 달을 바꿔 보실 수 있습니다. 카테고리 필터는 다음 업데이트에서 제공될 예정입니다.' },
    { c: '세금', q: '원천징수는 어떻게 처리되나요?', a: '사업소득 3.3%가 원천징수된 금액이 입금되며, 연말에 지급명세서를 발급해 드립니다.' },
    { c: '정산', q: '정산 계좌는 언제까지 바꿀 수 있나요?', a: '정산일(매월 10일) 기준 3일 전까지 변경하셔야 해당 월 정산에 반영됩니다.' }
  ];
  var FQC = '', FQQ = '';
  function fqDraw() {
    var cats = [];
    FAQ.forEach(function (f) { if (cats.indexOf(f.c) < 0) cats.push(f.c); });
    var list = FAQ.filter(function (f) {
      if (FQC && f.c !== FQC) return false;
      if (FQQ && (f.q + f.a).toLowerCase().indexOf(FQQ.toLowerCase()) < 0) return false;
      return true;
    });
    $('#fqBd').innerHTML =
      '<div class="fq-s"><i class="ph ph-magnifying-glass"></i>'
      + '<input id="fqQ" type="search" placeholder="궁금한 내용을 검색해 보세요." value="' + esc(FQQ) + '"></div>'
      + '<div class="fq-c">' + cats.map(function (c) {
          return '<button type="button" data-fc="' + esc(c) + '"' + (FQC === c ? ' class="on"' : '') + '>' + esc(c) + '</button>';
        }).join('') + '</div>'
      + (list.length
          ? '<div class="fq-list">' + list.map(function (f, i) {
              return '<div class="nc-it" data-fq="' + i + '"><button class="nc-hd" type="button"><div class="c">'
                + '<div class="t">' + esc(f.q) + '</div></div><i class="ph ph-caret-down"></i></button>'
                + '<div class="nc-bd">' + esc(f.a) + '</div></div>';
            }).join('') + '</div>'
          : '<div class="stl-empty">검색 결과가 없습니다.</div>');
    $('#fqBd').querySelectorAll('[data-fq]').forEach(function (it) {
      it.querySelector('.nc-hd').addEventListener('click', function () { it.classList.toggle('on'); });
    });
    $('#fqBd').querySelectorAll('[data-fc]').forEach(function (b) {
      b.addEventListener('click', function () { FQC = (FQC === b.dataset.fc) ? '' : b.dataset.fc; fqDraw(); });
    });
    dragScroll($('#fqBd').querySelector('.fq-c'));
    var q = $('#fqQ');
    q.addEventListener('input', function () { FQQ = this.value; var p = this.selectionStart; fqDraw(); var n = $('#fqQ'); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} });
  }
  $('#fqBack').addEventListener('click', function () { goTab('set'); });

  /* 가로로 넘치는 줄 — 마우스로 끌어서 볼 수 있게. 끈 뒤의 클릭은 삼킨다. */
  function dragScroll(el) {
    if (!el || el.__drag) return; el.__drag = 1;
    var down = false, moved = 0, x0 = 0, l0 = 0;
    el.addEventListener('pointerdown', function (e) {
      if (el.scrollWidth <= el.clientWidth) return;
      down = true; moved = 0; x0 = e.clientX; l0 = el.scrollLeft;
    });
    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - x0;
      if (Math.abs(d) > 3) moved = Math.max(moved, Math.abs(d));
      el.scrollLeft = l0 - d;
    });
    function up() { down = false; setTimeout(function () { moved = 0; }, 0); }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('click', function (e) {
      if (moved > 6) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  /* 필터 칩 줄 — 넘칠 때 마우스로 끌어서 볼 수 있게. 끈 뒤의 클릭은 삼킨다. */
  (function () {
    var el = $('#chips'), down = false, moved = 0, x0 = 0, l0 = 0;
    el.addEventListener('pointerdown', function (e) {
      if (el.scrollWidth <= el.clientWidth) return;
      down = true; moved = 0; x0 = e.clientX; l0 = el.scrollLeft;
    });
    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - x0;
      if (Math.abs(d) > 3) moved = Math.max(moved, Math.abs(d));
      el.scrollLeft = l0 - d;
    });
    function up() { down = false; setTimeout(function () { moved = 0; }, 0); }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('click', function (e) {
      if (moved > 6) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  })();

  /* 위임 결과가 바뀌면 현황·목록을 다시 그린다 */
  window.addEventListener('cx-collect', function () {
    if (curTab === 'stat') drawStat();
  });
})();
