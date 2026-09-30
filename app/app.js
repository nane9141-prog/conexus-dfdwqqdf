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
      $$('#tabbar button').forEach(function (b) {
        b.classList.toggle('on', TABS[b.dataset.tab] === sel);
        var i = b.querySelector('i');
        i.className = (TABS[b.dataset.tab] === sel ? 'ph-fill ph-' : 'ph ph-') + i.className.replace(/^.*ph-/, '');
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
    bx.innerHTML = '<div class="bh"><b>' + esc(o.title) + '</b>'
      + (o.x === false ? '' : '<button class="x" type="button" data-ovx><i class="ph ph-x"></i></button>') + '</div>'
      + '<div class="bb">' + (o.body || '') + '</div>'
      + (o.foot ? '<div class="bf">' + o.foot + '</div>' : '');
    ov.classList.add('on');
    bx.querySelectorAll('[data-ovx]').forEach(function (b) { b.addEventListener('click', closeSheet); });
    if (o.after) o.after(bx);
  }
  function closeSheet() { $('#ov').classList.remove('on'); }
  $('#ov').addEventListener('click', function (e) { if (e.target === $('#ov')) closeSheet(); });
  function todo(nm) { sheet({ mid: true, title: nm, body: '시연용 화면입니다. 이 기능은 이번 시연 범위에 없습니다.', foot: '<button class="btn" type="button" data-ovx>확인</button>' }); }
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
  var F = { st: [], bookOnly: false, q: '', sort: 'date' };
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
        body: '<button class="fsel" id="fCo" type="button" style="text-align:left">'
          + (DRAFT.co.length ? esc(DRAFT.co.join(', ')) : '기업을 선택해 주세요') + '</button>' },
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
      { k: 'sex', t: '성별 및 연령대', d: '주주의 성별과 연령대를 설정해 주세요.',
        sum: DRAFT.sex.concat([DRAFT.ageFrom, DRAFT.ageTo].filter(Boolean).join('~')).filter(Boolean).join(', '),
        body: chipRow('sex', '전체', ['남성', '여성'], true) + ageSlider() },
      { k: 'bld', t: '건물 유형', d: '단독주택 또는 아파트 등 거주 중인 건물 형태를 선택해 주세요.',
        sum: DRAFT.bld.join(', '),
        body: chipRow('bld', '전체', ['집합건물', '단독건물'], true) }
    ];
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

  function drawFilter() {
    var el = $('#flAcc');
    el.innerHTML = FSECS().map(function (s) {
      return '<div class="sec' + (OPEN[s.k] ? ' open' : '') + '" data-sec="' + s.k + '">'
        + '<div class="hd" role="button" tabindex="0"><div class="c">'
        + '<div class="t">' + s.t + '</div>'
        + '<div class="s' + (s.sum ? ' on' : '') + '">' + esc(s.sum || s.d) + '</div></div>'
        + '<span class="cv"><i class="ph ph-caret-down"></i></span></div>'
        + '<div class="bdy">' + s.body + '</div></div>';
    }).join('');

    el.querySelectorAll('.hd').forEach(function (h) {
      h.addEventListener('click', function () {
        var k = h.closest('.sec').dataset.sec;
        OPEN[k] = !OPEN[k]; drawFilter();
      });
    });
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
      var L = APP.COMPANIES.filter(function (n) { return !q || n.indexOf(q) >= 0; });
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
        bx.querySelector('#coAll').addEventListener('click', function () { pick = APP.COMPANIES.slice(); paint(bx); });
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
    if (F.sort === 'sh') L.sort(function (a, b) { return b.sh - a.sh; });
    else if (F.sort === 'nm') L.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
    else if (F.sort === 'near') L.sort(function (a, b) { return dist(a) - dist(b); });
    return L;
  }

  var SORTS = [{ k: 'date', nm: '권유일 입력 순' }, { k: 'sh', nm: '보유 주식 많은 순' }, { k: 'nm', nm: '이름 순' }, { k: 'near', nm: '내 위치에서 가까운 순' }];
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
  $('#btnBook').addEventListener('click', function () {
    F.bookOnly = !F.bookOnly; refresh();
    toast(F.bookOnly ? '관심 주주만 보고 있습니다' : '전체 주주를 보고 있습니다');
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
      s.classList.add('drag'); s.setPointerCapture && s.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!on) return;
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
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
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
      + '</div></div>'

      + '<div class="dsec"><div class="h"><b>메모</b>'
      + '<button class="mbtn" type="button" id="dtMemo"><i class="ph ph-pencil-simple"></i>메모하기</button></div>'
      + memoList(x) + '</div>'

      + '<div class="dsec" style="margin-bottom:12px"><div class="h"><b>권유 이력</b></div>'
      + '<div class="hist">' + histHtml(x) + '</div></div>';

    $('#dtBook').addEventListener('click', function () {
      var k = BOOK.indexOf(x.i);
      if (k >= 0) { BOOK.splice(k, 1); toast('관심 주주에서 해제했습니다'); }
      else { BOOK.push(x.i); toast('관심 주주로 등록했습니다'); }
      saveBook(); drawDetail();
    });
    $('#dtTel').addEventListener('click', openTel);
    $('#dtCopy').addEventListener('click', function () { copyAddr(a0); });
    var more = $('#dtMore'); if (more) more.addEventListener('click', openAddrs);
    $('#dtMemo').addEventListener('click', function () { editMemo(null); });
    $('#dtBd').querySelectorAll('[data-mdel]').forEach(function (b) {
      b.addEventListener('click', function () { delMemo(+b.dataset.mdel); });
    });
    $('#dtBd').querySelectorAll('[data-medit]').forEach(function (b) {
      b.addEventListener('click', function () { editMemo(+b.dataset.medit); });
    });
    $('#dtStart').textContent = x.st === 'done' ? '위임장 확인' : '위임 시작';
  }
  function dkv(k, v) { return '<div class="dt-kv"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }

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

  function histHtml(x) {
    var H = [];
    if (x.at) H.push({ t: ST[x.st].nm + ' 처리', s: x.at + ' · 현장 파트너' });
    H.push({ t: '주주명부 배정', s: '2026-09-14 09:00 · ' + x.org + ' 캠페인' });
    if (x.st === 'done') H.push({ t: '위임장 수령 · 검증 완료', s: (x.at || '2026-09-26 15:20') + ' · 전자 서명' });
    if (x.st === 'fix') H.push({ t: '보완 요청 — 서명 누락', s: '2026-09-25 11:05 · 검증팀' });
    if (x.st === 'no') H.push({ t: '수집 불가 — 부재 3회', s: '2026-09-24 19:40 · 현장 파트너' });
    return H.map(function (h) {
      return '<div class="h"><div class="rail"><div class="d"></div><div class="l"></div></div>'
        + '<div class="c"><div class="t">' + esc(h.t) + '</div><div class="s">' + esc(h.s) + '</div></div></div>';
    }).join('');
  }
  $('#dtHist').addEventListener('click', function () {
    sheet({ title: '권유 이력', body: '<div class="hist" style="padding:4px 0 8px">' + histHtml(CUR) + '</div>' });
  });

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
  $('#dtState').addEventListener('click', function () {
    sheet({
      title: '방문 상태 변경',
      body: '<div class="stlist">' + ['plan', 'replan', 'no'].map(function (k) {
        return '<button class="strow' + (CUR.st === k ? ' on' : '') + '" type="button" data-sst="' + k + '">'
          + ST[k].nm + '</button>';
      }).join('') + '</div>',
      after: function (bx) {
        bx.querySelectorAll('[data-sst]').forEach(function (b) {
          b.addEventListener('click', function () {
            APP.setState(CUR.i, b.dataset.sst); closeSheet(); drawDetail();
            toast(CUR.name + ' — ' + ST[CUR.st].nm + '으로 변경했습니다');
          });
        });
      }
    });
  });

  /* ══ 위임 진행 — 약관 → 행사방향 → 전자서명 → 신분증 ═══════ */
  var PX = null;
  var AGREE = [
    { k: 'a1', req: true,  t: '의결권 위임 및 대리행사 동의' },
    { k: 'a2', req: true,  t: '개인정보 수집 · 이용 동의' },
    { k: 'a3', req: true,  t: '고유식별정보 처리 동의' },
    { k: 'a4', req: false, t: '주주총회 안내 수신 동의' }
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
    if (PX && PX.step >= 1 && PX.step <= 3) {
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

  var PX_TITLE = ['약관 동의', '의결권 행사 방향', '전자서명', '신분증 촬영', '위임 완료'];
  function pxDraw() {
    $('#pxTitle').textContent = PX_TITLE[PX.step];
    $$('.pxsteps .b').forEach(function (b, i) { b.classList.toggle('on', i <= Math.min(3, PX.step)); });
    $('#pxBack').style.visibility = PX.step === 4 ? 'hidden' : '';
    $('#pxX').style.visibility = PX.step === 4 ? 'hidden' : '';
    var f = [pxAgree, pxVotes, pxSign, pxCam, pxDone][PX.step];
    f();
    $('#pxBd').scrollTop = 0;
  }
  function pxNextBtn(label, on, fn) {
    var b = $('#pxNext');
    b.textContent = label; b.disabled = !on;
    b.onclick = fn;
  }

  /* 1) 약관 동의 */
  function pxAgree() {
    var all = AGREE.every(function (a) { return PX.agree[a.k]; });
    $('#pxBd').innerHTML = '<div class="pxwrap">'
      + '<div class="pxh">위임에 필요한 약관에<br>동의해 주세요</div>'
      + '<div class="pxd">' + esc(CUR.name) + ' 님께 내용을 확인시켜 드린 뒤 동의를 받아 주세요.</div>'
      + '<button class="agall' + (all ? ' on' : '') + '" type="button" id="agAll">'
      + '<span class="cb' + (all ? ' on' : '') + '"></span><span class="t">전체 동의하기</span></button>'
      + '<div class="aglist">' + AGREE.map(function (a) {
          return '<div class="agrow"><span class="cb' + (PX.agree[a.k] ? ' on' : '') + '" data-ag="' + a.k + '" role="button"></span>'
            + '<span class="t" data-ag="' + a.k + '" role="button">'
            + (a.req ? '<em>[필수]</em>' : '<span class="opt">[선택]</span>') + esc(a.t) + '</span>'
            + '<span class="go" data-help="' + esc(a.t) + '" role="button"><i class="ph ph-caret-right"></i></span></div>';
        }).join('') + '</div></div>';
    $('#agAll').addEventListener('click', function () {
      var v = !all; AGREE.forEach(function (a) { PX.agree[a.k] = v; }); pxAgree();
    });
    $('#pxBd').querySelectorAll('[data-ag]').forEach(function (b) {
      b.addEventListener('click', function () { PX.agree[b.dataset.ag] = !PX.agree[b.dataset.ag]; pxAgree(); });
    });
    var ok = AGREE.every(function (a) { return !a.req || PX.agree[a.k]; });
    pxNextBtn('다음', ok, function () { PX.step = 1; pxDraw(); });
  }

  /* 2) 의안별 행사 방향 */
  function pxAgenda() {
    var A = (CX.agenda || []).filter(function (a) { return !a.header; });
    return A.length ? A : [{ no: '제1호', nm: '재무제표 승인의 건' }];
  }
  function pxVotes() {
    var A = pxAgenda();
    A.forEach(function (a, i) { if (!PX.votes[i]) PX.votes[i] = '찬성'; });
    $('#pxBd').innerHTML = '<div class="pxwrap">'
      + '<div class="pxh">의안별 행사 방향을<br>정해 주세요</div>'
      + '<div class="pxd">주주가 직접 고른 방향으로 표시해 주세요. 기본값은 회사 권고안(찬성)입니다.</div>'
      + '<div style="margin-top:14px">' + A.map(function (a, i) {
          return '<div class="agitem"><div class="nm">' + esc(a.no) + ' · ' + esc(a.nm) + '</div>'
            + '<div class="ch" data-ag="' + i + '">'
            + ['찬성', '반대', '기권'].map(function (c) {
                return '<button type="button" data-c="' + c + '"' + (PX.votes[i] === c ? ' class="on"' : '') + '>' + c + '</button>';
              }).join('') + '</div></div>';
        }).join('') + '</div></div>';
    $('#pxBd').querySelectorAll('[data-ag]').forEach(function (r) {
      r.querySelectorAll('[data-c]').forEach(function (b) {
        b.addEventListener('click', function () {
          PX.votes[+r.dataset.ag] = b.dataset.c;
          r.querySelectorAll('[data-c]').forEach(function (o) { o.classList.remove('on'); });
          b.classList.add('on');
        });
      });
    });
    pxNextBtn('다음', true, function () { PX.step = 2; pxDraw(); });
  }

  /* 3) 전자서명 — 캔버스에 직접 그린다 */
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
      pxNextBtn('다음', true, goNext);
    });
    function up() { down = false; }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    $('#sgClr').addEventListener('click', function () {
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawn = false; box.classList.remove('has'); PX.sign = null;
      pxNextBtn('다음', false, null);
    });
    function goNext() { PX.sign = cv.toDataURL('image/png'); PX.step = 3; pxDraw(); }
    if (PX.sign) { box.classList.add('has'); drawn = true; }
    pxNextBtn('다음', !!PX.sign, goNext);
  }

  /* 4) 신분증 촬영 — 앱 안 카메라 + 가이드 프레임 */
  var CAM = { stream: null };
  function camStop() {
    if (CAM.stream) { CAM.stream.getTracks().forEach(function (t) { t.stop(); }); CAM.stream = null; }
  }
  function pxCam() {
    $('#pxBd').innerHTML = '<div class="pxwrap">'
      + '<div class="pxh">신분증을 촬영해 주세요</div>'
      + '<div class="pxd">주민등록증 · 운전면허증 중 하나를 테두리 안에 맞춰 주세요.</div>'
      + '<div class="camwrap" id="camW">'
      + (PX.idImg
          ? '<img src="' + PX.idImg + '" alt="촬영한 신분증">'
          : '<video id="camV" playsinline muted autoplay></video>'
            + '<div class="guide"><div class="fr"></div></div>'
            + '<div class="hint">테두리 안에 신분증을 맞춰 주세요</div>')
      + '</div>'
      + (PX.idImg
          ? '<div class="camdone"><i class="ph-fill ph-check-circle"></i>신분증을 확인했습니다</div>'
            + '<div class="cambar"><button class="alt" type="button" id="camRe">다시 촬영</button></div>'
          : '<div class="cambar"><button class="shutter" type="button" id="camShot" aria-label="촬영"></button>'
            + '<button class="alt" type="button" id="camPick">앨범에서 선택</button></div>'
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
      var sh = $('#camShot'); if (sh) sh.style.display = 'none';
    }
    $('#camShot').addEventListener('click', function () {
      if (!CAM.stream) { $('#camFile').click(); return; }
      var w = v.videoWidth, h = v.videoHeight; if (!w) return;
      var c = document.createElement('canvas');
      var scale = Math.min(1, 1024 / w);
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      PX.idImg = c.toDataURL('image/jpeg', 0.7);      /* 1024px · 품질 0.7 로 줄여 저장 */
      camStop(); pxDraw();
    });
    $('#camPick').addEventListener('click', function () { $('#camFile').click(); });
    $('#camFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var c = document.createElement('canvas');
          var scale = Math.min(1, 1024 / im.width);
          c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          PX.idImg = c.toDataURL('image/jpeg', 0.7);
          camStop(); pxDraw();
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    });
    pxNextBtn('위임장 전송', false, null);
  }

  /* 전송 · 완료 */
  function pxSubmit() {
    camStop();
    APP.setState(CUR.i, 'done');
    APP.setProxy(CUR.i, { votes: PX.votes, sign: PX.sign, idImg: PX.idImg, at: CUR.at });
    PX.step = 4; pxDraw();
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
    return '<div class="arc"><svg viewBox="0 0 ' + W + ' ' + H + '">'
      + '<path d="' + d + '" fill="none" stroke="#EDEFF2" stroke-width="14" stroke-linecap="round"/>'
      + (f > 0 ? '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="14" stroke-linecap="round"'
          + ' stroke-dasharray="' + (len * f).toFixed(1) + ' ' + (len * 2).toFixed(1) + '"/>' : '')
      + (live && f > 0.02 && f < 0.99
          ? '<circle cx="' + k[0].toFixed(1) + '" cy="' + k[1].toFixed(1) + '" r="8" fill="#0071F3"'
            + ' stroke="#CFE3FF" stroke-width="6"/>' : '')
      + '</svg><div class="pct">' + pct + '% 달성</div></div>';
  }
  function dday(due) {
    return Math.ceil((new Date(due + 'T00:00:00') - new Date('2026-09-30T00:00:00')) / 86400000);
  }
  function drawStat() {
    $('#statBd').innerHTML = APP.CAMPAIGNS.map(function (c) {
      var t = APP.stat(c.id), dd = dday(c.due), live = c.state === 'live';
      var badge = live
        ? '<span class="dd">' + (dd > 0 ? 'D-' + dd : dd === 0 ? 'D-DAY' : '마감 임박') + '</span>'
        : '<span class="dd end">종료</span>';
      return '<div class="cmp2' + (live ? '' : ' end') + '">'
        + '<div class="l1"><span class="co">' + esc(c.org) + '</span>' + badge + '</div>'
        + '<div class="tm">' + esc(c.term) + '</div>'
        + '<div class="box">'
        + '<div class="r"><span class="k">주주</span>'
        + '<span class="got">확보 ' + cm(t.sh) + '명</span><span class="goal">목표 ' + cm(t.goalSh) + '명</span></div>'
        + '<div class="r"><span class="k">주식 수</span>'
        + '<span class="got">확보 ' + cm(t.vt) + '주</span><span class="goal">목표 ' + cm(t.goalVt) + '주</span></div>'
        + '</div>'
        + arc(t.pct, live)
        + (live ? '' : '<div class="due2">마감일 ' + c.due.replace(/-/g, '.') + '</div>')
        + '</div>';
    }).join('')
      + '<div style="padding:4px 2px 24px;font-size:12px;color:#A3A3A3;line-height:1.6">'
      + '위임 완료로 바꾼 건은 CONEXUS 사전 의결권 현황의 실시간 주주 확보 현황과 권유대행 KPI 에 그대로 반영됩니다.</div>';
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
      + li('ph-receipt', '정산 내역', '10,000,000원 지급예정', 'hi', '정산 내역')
      + '<div id="setNoti"></div>'
      + '</div>'

      + '<div class="grp"><div class="gh">업무 지원</div>'
      + li('ph-graduation-cap', '교육 센터', '수강 대기 2개', '', '교육 센터')
      + li('ph-gift', '프로모션 · 리워드', '320 포인트', '', '프로모션 · 리워드')
      + li('ph-footprints', '만보기', '9,344 걸음', '', '만보기')
      + '</div>'

      + '<div class="grp"><div class="gh">파트너센터</div>'
      + li('ph-megaphone', '공지사항', '', '', '공지사항')
      + li('ph-question', '자주 묻는 질문', '', '', '자주 묻는 질문')
      + '</div>'

      + '<div class="grp"><div class="gh">약관 및 정책</div>'
      + li('ph-file-text', '서비스 약관보기', '4건', '', '서비스 약관보기')
      + '<div class="li"><i class="ph ph-info"></i><span class="t">버전 정보</span><span class="r">v.2.0.1</span></div>'
      + '</div>'

      + '<div class="grp"><div class="gh">지도</div>'
      + '<button class="li" type="button" id="setKey"><i class="ph ph-map-pin-line"></i>'
      + '<span class="t">네이버 지도 Client ID</span>'
      + '<span class="r' + (naverKey() ? ' hi' : '') + '">' + (naverKey() ? '연결됨' : '미등록') + '</span>'
      + '<i class="ph ph-caret-right"></i></button></div>'

      + '<div class="grp"><button class="li" type="button" id="setReset"><i class="ph ph-arrow-counter-clockwise"></i>'
      + '<span class="t">시연 데이터 초기화</span><i class="ph ph-caret-right"></i></button>'
      + '<button class="li" type="button" id="setOut"><i class="ph ph-sign-out"></i>'
      + '<span class="t">로그아웃</span><i class="ph ph-caret-right"></i></button></div>'
      + '<div class="ver">CONEXUS 의결권 위임 플랫폼 · 시연용</div>';

    $('#setNoti').innerHTML = '<button class="li" type="button" id="setNotiBtn"><i class="ph ph-bell"></i>'
      + '<span class="t">알림 설정</span><span class="r">' + notiOn() + '개 켜짐</span><i class="ph ph-caret-right"></i></button>';
    $('#setNotiBtn').addEventListener('click', openNoti);
    $('#setProfile').addEventListener('click', openProfile);
    $('#setKey').addEventListener('click', function () {
      sheet({
        title: '네이버 지도 Client ID',
        body: '<input id="nkIn" placeholder="네이버 클라우드 콘솔에서 발급받은 Client ID" '
          + 'style="width:100%;height:48px;padding:0 14px;border:1px solid #E5E5E5;border-radius:12px;outline:none" '
          + 'value="' + esc(naverKey()) + '">'
          + '<div style="margin-top:12px;font-size:12px;line-height:1.6">'
          + 'Maps 애플리케이션에 <b style="color:#171717">Dynamic Map</b> 을 켜고, Web 서비스 URL 에 '
          + '<b style="color:#171717">' + esc(location.origin) + '</b> 을 등록해야 합니다. '
          + '비워 두면 키가 필요 없는 기본 지도로 표시됩니다.</div>',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="nkOk">저장</button>',
        after: function (bx) {
          bx.querySelector('#nkOk').addEventListener('click', function () {
            var v = bx.querySelector('#nkIn').value.trim();
            try { v ? localStorage.setItem('cx.app.navkey', v) : localStorage.removeItem('cx.app.navkey'); } catch (e) {}
            location.reload();
          });
        }
      });
    });
    $('#setReset').addEventListener('click', function () {
      sheet({
        mid: true, title: '시연 데이터 초기화',
        body: '앱에서 바꾼 방문 상태 · 메모 · 연락처 · 관심 주주를 모두 지우고 처음 상태로 되돌립니다. '
          + 'CONEXUS 사전 의결권 현황에 넘긴 수집 결과도 함께 지워집니다.',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="rsOk">초기화</button>',
        after: function (bx) {
          bx.querySelector('#rsOk').addEventListener('click', function () {
            /* 지도 키는 설정값이라 초기화 대상이 아니다 */
            ['cx.collect', 'cx.app.book', 'cx.app.noti'].forEach(function (k) {
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
  function notiOn() { return ['must', 'camp', 'news', 'promo'].filter(function (k) { return NOTI[k]; }).length; }
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
