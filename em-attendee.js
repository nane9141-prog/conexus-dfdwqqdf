/* 전자주주총회 관리 · 사전 신청 관리 — 사전 등록된 참가자 조회 전용
   주주 탭: 명부 기준(통합 그룹은 펼침), 사전투표·참석 신청·출석·시청을 각각 독립 표시
   비주주 탭: 유형·연락처·소속·질의권·메모 (칩 없음) */
(function () {
  var root = document.getElementById('atRoot');
  if (!root || !window.CX || !CX.roster || !window.EM) return;
  var cm = EM.cm, esc = EM.esc;

  /* ---------- 데이터 ---------- */
  function preOf(r) {
    if (!r.pre.length) return '미행사';
    if (r.pre.length > 1) return '중복행사';
    return /^전자/.test(r.pre[0]) ? '전자투표' : '서면위임';
  }
  var seq = 501;
  function person(r, k) {
    var apply = k % 7 !== 3, attend = apply && k % 5 !== 1, foreign = r.fr === '외국인';
    var code = foreign ? 'EG-2026' + ('000' + (seq++)).slice(-4) : '';
    return {
      k: 'p' + r.i, r: r, voter: r.nm, name: r.nm, id: r.id, ac: r.ac, sh: r.sh, rt: r.rt,
      type: k % 6 === 2 ? '대리인' : '본인', pre: preOf(r),
      apply: apply ? '신청' : '미신청', attend: attend ? '출석' : '미출석', watch: attend || k % 4 === 0,
      att: attend ? r.sh : 0, code: code, revoked: !!code && k % 9 === 4,
      route: code ? (k % 3 ? '주주 신청' : '관리자 등록') : '주주 신청',
      phone: '010-' + (2000 + (r.i * 37) % 7000) + '-' + ('000' + (r.i * 53 % 10000)).slice(-4),
      email: foreign ? r.nm.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@gmail.com' : 'sh' + r.i + '@naver.com'
    };
  }
  var inGroup = {};
  var groups = (CX.rosterGroups || []).slice(0, 12).map(function (g, gi) {
    var kids = g.members.map(function (m, j) { inGroup[m.i] = 1; var p = person(m, gi * 3 + j); p.voter = g.voter; return p; });
    function agg(f) { var s = {}; kids.forEach(function (c) { s[c[f]] = 1; }); return Object.keys(s); }
    var types = agg('type'), pres = agg('pre'), att = kids.filter(function (c) { return c.attend === '출석'; }).length;
    return {
      k: 'g' + g.id, grp: true, kids: kids, voter: g.voter, name: '통합 ' + kids.length + '건', id: kids[0].id, ac: '-',   /* 주주번호는 대표(첫) 계좌 — 참석자 관리와 동일 */
      sh: kids.reduce(function (a, c) { return a + c.sh; }, 0), rt: kids.reduce(function (a, c) { return a + c.rt; }, 0),
      att: kids.reduce(function (a, c) { return a + c.att; }, 0),
      type: types.length > 1 ? '본인·대리인' : types[0], pre: pres.length > 1 ? '중복행사' : pres[0],
      apply: kids.some(function (c) { return c.apply === '신청'; }) ? '신청' : '미신청',
      attend: att === kids.length ? '출석' : att ? '일부출석' : '미출석',
      watch: kids.some(function (c) { return c.watch; }), code: '', route: kids[0].route, email: '-', phone: kids[0].phone
    };
  });
  var singles = CX.roster.filter(function (r, i) { return !inGroup[r.i] && (i % 6 === 0 || r.fr === '외국인' && i % 3 === 0); }).slice(0, 150).map(person);
  /* 동명이인 박성용 4명 — 사전 참석 신청 내역 확인용으로 항상 표에 올린다.
     주주번호가 다른 별개 주주이고, 첫 번째(사전 미행사)만 미신청·미참석이다. */
  var PSY_K = [1, 3, 3, 3];   /* person(k) 규칙: k%7===3 → 미신청, k%5===1 → 미참석
                                 1,200주(첫 번째)만 참석 신청, 나머지 셋은 미신청 */
  var psyHave = {}; singles.forEach(function (p) { psyHave[p.k] = 1; });
  var psy = CX.roster.filter(function (r) { return r.nm === '박성용' && !inGroup[r.i]; })
    .map(function (r, j) { return person(r, PSY_K[j % PSY_K.length]); })
    .filter(function (p) { return !psyHave[p.k]; });
  singles = psy.concat(singles);
  var SH = groups.concat(singles);
  var NSK = ['임직원', '언론/기자', '감사인', '변호사', '외국인', '기타'];
  var NS = [['김하늘', '삼일회계법인', '회계사', '감사인', '외부감사인 참관'], ['이준호', '법무법인 세종', '변호사', '변호사', '법률 자문 · 의사진행 검토'], ['박민지', '한국예탁결제원', '', '기타', ''], ['정우성', '연합뉴스', '기자', '언론/기자', '취재 — 총회 종료 후 기사 송고 예정'], ['최서윤', '카카오뱅크', 'IR팀 매니저', '임직원', '사내 참관'], ['한지훈', '대신경제연구소', '연구원', '기타', '의결권 자문사 참관'], ['Michael Grant', 'ISS', 'Analyst', '외국인', ''], ['윤가람', '카카오뱅크', '대리', '임직원', '현장 지원']].map(function (n, i) {
    return { k: 'n' + i, name: n[0], org: n[1], pos: n[2], kind: n[3], memo: n[4], email: ['sky.kim@samil.com', 'jh.lee@shinkim.com', 'mj.park@ksd.or.kr', 'ws.jung@yna.co.kr', 'sy.choi@kakaobank.com', 'jh.han@daishin.com', 'm.grant@issgovernance.com', 'gr.yoon@kakaobank.com'][i], phone: '010-' + (2000 + i * 731) + '-' + (4000 + i * 377), watch: i % 3 !== 2, ask: i < 2 || i === 5, code: 'EG-2026' + ('000' + (seq++)).slice(-4), revoked: i === 3 || i === 6 };
  });

  /* ---------- 컬럼 ---------- */
  var COLS = {
    sh: [['투표권자', 220], ['주주명', 0], ['주주번호', 140], ['참석 유형', 104, 'c'], ['사전투표', 96, 'c'], ['보유주식수', 120, 'n'], ['지분율', 90, 'n'], ['참석주식수', 120, 'n'], ['사전 신청', 104, 'c'], ['출석', 96, 'c'], ['로그인코드', 130], ['휴대폰번호', 140], ['등록 경로', 104, 'c']],
    ns: [['유형', 100, 'c'], ['이름', 140], ['이메일', 220], ['휴대폰번호', 140], ['소속', 0], ['직급', 120], ['시청', 96, 'c'], ['질의권', 90, 'c'], ['메모', 200], ['로그인코드', 130], ['', 44, 'c']]
  };
  var LEFT = { sh: 1, ns: 2 };
  function val(x, c) {
    switch (c) {
      case '투표권자': return x.voter; case '주주명': return x.name; case '주주번호': return x.id;
      case '참석 유형': return x.type; case '사전투표': return x.pre; case '보유주식수': return x.sh;
      case '지분율': return x.rt; case '참석주식수': return x.att; case '사전 신청': return x.apply;
      case '출석': return x.attend; case '시청': return x.watch ? '시청' : '미시청';
      case '로그인코드': return x.code || '-'; case '등록 경로': return x.route;
      case '유형': return x.kind; case '이름': return x.name; case '이메일': return x.email;
      case '휴대폰번호': return x.phone; case '소속': return x.org || '-'; case '직급': return x.pos || '-';
      case '질의권': return x.ask ? '부여' : '미부여'; case '메모': return x.memo || '-';
    }
    return '';
  }
  var NUM = { '보유주식수': 1, '지분율': 1, '참석주식수': 1 };
  function txt(x, c) { var v = val(x, c); return c === '지분율' ? v.toFixed(4) + '%' : NUM[c] ? cm(v) : String(v); }
  var MUTED = { '이메일': 'email', '휴대폰번호': 'phone', '소속': 'org', '직급': 'pos' };   /* 비주주 보조 정보 — muted */
  function cell(x, c, child) {
    if (c === '') {
      if (cur === 'ns') return '<button type="button" class="lc-more" aria-label="더보기"><i class="ph ph-dots-three"></i></button>';
      return '';
    }
    /* 통합기관 — 참석자 관리와 같은 모양: 투표권자 칸 원형 chevron, 주주명 칸 '통합 N건' 뱃지, 계좌 줄은 세로선 */
    if (c === '투표권자' && x.grp) return '<div class="voter"><button type="button" class="tw-chevron' + (open[x.k] ? '' : ' collapsed') + '" aria-label="펼치기"><svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg></button><span>' + esc(x.voter) + '</span></div>';
    if (c === '투표권자' && child) return '<span class="cv"></span>';
    /* 사전 신청: 신청 blue · 미신청 info 50% / 출석: 출석 blue · 일부출석 info · 미출석 info 50% */
    /* 비주주 시청·질의권도 같은 규칙: 시청·부여 blue · 미시청·미부여 info 50% */
    if (c === '사전 신청' || c === '출석' || c === '시청' || c === '질의권') {
      var t0 = val(x, c);   /* 상태 뱃지 — 점 없이 글자만 */
      return '<span class="lc-b ' + ({ '신청': 'blue', '출석': 'blue', '시청': 'blue', '부여': 'blue', '일부출석': 'gray' }[t0] || 'gray off') + '">' + t0 + '</span>';
    }
    if (MUTED[c] && x[MUTED[c]]) return '<span class="mu">' + esc(x[MUTED[c]]) + '</span>';
    if (c === '등록 경로') return '<span class="mu">' + esc(x.route) + '</span>';
    if (c === '로그인코드') return x.code ? '<span class="lc-code' + (x.revoked ? ' off' : '') + '">' + x.code + '</span>' : '<span class="mu">-</span>';
    if (c === '주주명' && x.grp) return '<span class="tag">' + esc(x.name) + '</span>';
    if (c === '메모') return '<span class="lc-memo mu" title="' + esc(x.memo || '') + '">' + esc(x.memo || '-') + '</span>';
    var t = txt(x, c);
    return t === '-' ? '<span class="mu">-</span>' : esc(t);
  }

  /* ---------- 화면 ---------- */
  root.innerHTML = '<div class="lc">' +
    '<div class="lc-hd"><h2>사전 신청 관리</h2><p>사전 신청자를 포함한 전체 참가자를 조회합니다.</p></div>' +
    '<div class="lc-bar">' +
      '<div class="lc-seg" id="atTabs"><button type="button" class="on" data-t="sh">주주</button><button type="button" data-t="ns">비주주</button></div>' +
      '<div class="lc-chips" id="atChips"></div>' +
      '<button type="button" class="btn" id="atDown" style="width:90px"><i class="ph ph-download-simple"></i>다운로드</button>' +
      '<span data-cx-tools></span>' +
    '</div>' +
    '<div class="lc-wrap"><div class="lc-scroll"><table class="lctbl" id="atTbl"><colgroup id="atCols"></colgroup><thead id="atHead"></thead><tbody id="atBody"></tbody></table></div>' +
      '<div class="lc-foot"><span class="cnt" id="atCount"></span><span class="lc-pg">페이지당 <select id="atSize"><option>20</option><option>50</option><option>100</option></select><span class="lc-pages" id="atPager"></span></span></div>' +
    '</div></div>';
  var pop = document.createElement('div'); pop.className = 'lc-pop'; document.body.appendChild(pop);
  var menu = document.createElement('div'); menu.className = 'lc-menu'; document.body.appendChild(menu);

  var tbl = document.getElementById('atTbl'), body = document.getElementById('atBody');
  var cur = 'sh', chip = 'all', page = 1, pageSize = 20, lastTotal = 0, sortSt = null, filtPred = null, open = {};
  var CHIPS = {
    sh: [['all', '전체'],   /* 사전 신청 관리 — 전체 · 출석 · 일부출석 · 미출석 */
      ['in', '출석', function (x) { return x.attend === '출석'; }], ['part', '일부출석', function (x) { return x.attend === '일부출석'; }], ['out', '미출석', function (x) { return x.attend === '미출석'; }]],
    ns: []
  };
  function list() { return cur === 'sh' ? SH : NS; }
  function chipFn() { var c = CHIPS[cur].filter(function (c) { return c[0] === chip; })[0]; return c && c[2]; }
  function rows() {
    var r = list(), cs = COLS[cur], f = chipFn();
    if (f) r = r.filter(f);
    if (filtPred) r = r.filter(function (x) { return filtPred(function (i) { return txt(x, cs[i][0]); }); });
    if (sortSt && sortSt.dir) {
      var c = cs[sortSt.idx][0], d = (sortSt.dir === 'desc' || sortSt.dir < 0) ? -1 : 1;
      r = r.slice().sort(function (a, b) { var va = val(a, c), vb = val(b, c); return (NUM[c] ? va - vb : String(va).localeCompare(String(vb), 'ko')) * d; });
    }
    return r;
  }
  function stick(i) {
    var cs = COLS[cur], n = LEFT[cur];
    if (i < n) { var left = 0; for (var j = 0; j < i; j++) left += cs[j][1]; return ' data-st="' + (i === n - 1 ? 'le' : 'l') + '" style="left:' + left + 'px"'; }
    if (cur === 'ns' && i === cs.length - 1) return ' data-st="r" style="right:0"';
    return '';
  }
  function cls(c, child) { var a = c[2] ? [c[2]] : []; if (c[0] === '투표권자' || c[0] === '이름') a.push('b'); if (child && c[0] === '투표권자') a.push('tcell'); return a.length ? ' class="' + a.join(' ') + '"' : ''; }
  function head() {
    var cs = COLS[cur], min = 0;
    cs.forEach(function (c) { min += c[1] || 180; });
    tbl.style.minWidth = min + 'px';
    document.getElementById('atCols').innerHTML = cs.map(function (c) { return c[1] ? '<col style="width:' + c[1] + 'px">' : '<col>'; }).join('');
    document.getElementById('atHead').innerHTML = '<tr>' + cs.map(function (c, i) { return '<th' + stick(i) + (c[2] ? ' class="' + c[2] + '"' : '')
        + (c[2] === 'c' ? ' data-al="c"' : c[2] === 'n' ? ' data-al="r"' : '')   /* 표 도구에 맞춤을 알려 준다 */
        + '>' + c[0] + '</th>'; }).join('') + '</tr>';
  }
  function tr(x, child) { var cs = COLS[cur]; return '<tr data-k="' + x.k + '"' + (child ? ' class="child"' : '') + '>' + cs.map(function (c, j) { return '<td' + stick(j) + cls(c, child) + '>' + cell(x, c[0], child) + '</td>'; }).join('') + '</tr>'; }
  function render() {
    var base = list();
    document.getElementById('atChips').innerHTML = CHIPS[cur].map(function (c) {
      return '<button type="button" class="lc-chip' + (c[0] === chip ? ' on' : '') + '" data-chip="' + c[0] + '">' + c[1] + '<span class="c">' + (c[2] ? base.filter(c[2]).length : base.length) + '</span></button>';
    }).join('');
    var r = rows(); lastTotal = r.length;
    var pages = Math.max(1, Math.ceil(r.length / pageSize)); if (page > pages) page = pages;
    var pg = r.slice((page - 1) * pageSize, page * pageSize);
    body.innerHTML = pg.length ? pg.map(function (x) { return tr(x) + (x.grp && open[x.k] ? x.kids.map(function (c) { return tr(c, 1); }).join('') : ''); }).join('')
      : '<tr><td colspan="' + COLS[cur].length + '" class="lc-empty">조건에 맞는 참가자가 없습니다.</td></tr>';
    document.getElementById('atCount').textContent = '총 ' + r.length + '명' + (cur === 'sh' ? ' · ' + cm(r.reduce(function (a, x) { return a + x.sh; }, 0)) + '주' : '');
    document.getElementById('atPager').innerHTML = EM.pagerHtml(page, pages);
  }
  function byK(k) {
    var all = list(); for (var i = 0; i < all.length; i++) { if (all[i].k === k) return all[i]; if (all[i].kids) for (var j = 0; j < all[i].kids.length; j++) if (all[i].kids[j].k === k) return all[i].kids[j]; }
    return null;
  }

  document.getElementById('atTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b || b.dataset.t === cur) return;
    cur = b.dataset.t; chip = 'all'; page = 1; sortSt = null; filtPred = null;
    [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
    if (tbl.__cx) { tbl.__cx.filters = {}; tbl.__cx.draft = {}; }
    head(); render();
  });
  document.getElementById('atChips').addEventListener('click', function (e) { var b = e.target.closest('[data-chip]'); if (!b) return; chip = b.dataset.chip; page = 1; render(); });
  document.getElementById('atSize').addEventListener('change', function () { pageSize = parseInt(this.value, 10) || 20; page = 1; render(); });
  document.getElementById('atPager').addEventListener('click', function (e) {
    var b = e.target.closest('.pp'); if (!b || b.classList.contains('dis')) return;
    page = EM.pagerGo(b.dataset.pg, page, Math.max(1, Math.ceil(lastTotal / pageSize))); render();
  });
  document.getElementById('atDown').addEventListener('click', function () { EM.toast((cur === 'sh' ? '주주' : '비주주') + ' 사전 신청 관리 ' + rows().length + '건을 엑셀로 다운로드합니다.'); });
  tbl.addEventListener('cxsort', function (e) { e.preventDefault(); sortSt = { idx: e.detail.idx, dir: e.detail.dir }; page = 1; render(); });
  tbl.cxFilter = function (pred) { filtPred = pred; page = 1; render(); };
  tbl.cxValues = function (i) { var c = COLS[cur][i][0]; return list().map(function (x) { return txt(x, c); }); };

  /* 통합 그룹 펼침 · 비주주 더보기 */
  var menuX = null;
  function hideMenu() { menu.classList.remove('on'); }
  body.addEventListener('click', function (e) {
    var row = e.target.closest('tr[data-k]'); if (!row) return;
    var x = byK(row.dataset.k);
    if (e.target.closest('.tw-chevron') && x && x.grp) { open[x.k] = !open[x.k]; render(); return; }
    var m = e.target.closest('.lc-more');
    if (m && x) {
      menuX = x;
      menu.innerHTML = '<div class="g"><button type="button" data-a="ask"><i class="ph ph-chat-circle-text"></i>' + (x.ask ? '질의권 회수' : '질의권 부여') + '</button></div><div class="sep"></div><div class="g"><button type="button" class="danger" data-a="del"><i class="ph ph-trash"></i>삭제</button></div>';
      menu.classList.add('on');
      var r = m.getBoundingClientRect();
      menu.style.left = Math.max(8, r.right - menu.offsetWidth) + 'px';
      menu.style.top = (r.bottom + 4 + menu.offsetHeight > innerHeight ? r.top - 4 - menu.offsetHeight : r.bottom + 4) + 'px';
      e.stopPropagation();
    }
  });
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return; var x = menuX; hideMenu();
    if (b.dataset.a === 'ask') { x.ask = !x.ask; render(); EM.toast(x.name + '님의 질의권을 ' + (x.ask ? '부여' : '회수') + '했습니다.'); }
    else EM.alertDlg({ ic: 'trash', t: '참석자를 삭제하시겠습니까?', d: x.name + '님의 참석 등록과 로그인코드가 삭제됩니다.', cancel: 1, ok: '삭제', danger: 1 }, function () { NS.splice(NS.indexOf(x), 1); render(); EM.toast('삭제되었습니다.'); });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.lc-menu')) hideMenu(); });
  window.addEventListener('scroll', hideMenu, true);

  /* 투표권자 호버 카드 — 주주번호 · 실질계좌번호 · 이메일 */
  body.addEventListener('mousemove', function (e) {
    /* 투표권자 칸에 올렸을 때만 */
    var td = e.target.closest('td'), row = td && td.cellIndex === 0 && e.target.closest('tr[data-k]'), x = row && cur === 'sh' ? byK(row.dataset.k) : null;
    if (!x || x.grp) { pop.classList.remove('on'); return; }
    if (pop.dataset.k !== x.k) {
      pop.dataset.k = x.k;
      pop.innerHTML = '<div class="t">' + esc(x.name) + '</div><div class="lc-kv"><span class="k">주주번호</span><span class="v">' + esc(x.id) + '</span></div><div class="lc-kv"><span class="k">실질계좌번호</span><span class="v">' + esc(x.ac) + '</span></div><div class="lc-kv"><span class="k">이메일</span><span class="v">' + esc(x.email) + '</span></div>';
    }
    pop.classList.add('on');
    var lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + 260 > innerWidth) lx = e.clientX - 276;
    if (ly + pop.offsetHeight > innerHeight) ly = e.clientY - pop.offsetHeight - 12;
    pop.style.left = lx + 'px'; pop.style.top = ly + 'px';
  });
  body.addEventListener('mouseleave', function () { pop.classList.remove('on'); pop.dataset.k = ''; });

  head(); render();
})();
