/* 전자주주총회 관리 · 담당자 · 대리인 지정 관리 (Figma 17138:54405)
   주주PASS 기업홈에서 올라온 대리인 지정 요청(cx.proxy)도 함께 받는다. */
(function () {
  var root = document.getElementById('pxRoot');
  if (!root || !window.CX || !CX.roster || !window.EM) return;
  var cm = EM.cm, esc = EM.esc, ME = '강하나';

  /* ---------- 상태 ---------- */
  var ST = ['승인대기', '보완요청', '재보완요청', '승인완료', '반려', '지정철회'];
  var TONE = { '승인대기': 'gray', '보완요청': 'orange', '재보완요청': 'orange',
               '승인완료': 'blue', '반려': 'rose', '지정철회': 'rose' };

  /* ---------- 데모 데이터 ---------- */
  var ORG = ['OO인더스트리', 'OOOO자산운용', 'OO화학', 'OO금융', 'OO자산운용',
             'OO캐피탈', 'OO생명', 'OO증권', 'OO리츠', 'OO홀딩스'];
  var NM = ['김주한', '한도윤', '송지훈', '박지용', '박지훈', '김민준', '이서연', '정도윤'];
  function mk(kind, i) {
    var s = ST[[0, 0, 1, 2, 3, 3, 4, 5][i % 8]];
    var done = (s !== '승인대기');
    return {
      k: kind + '-' + i, kind: kind, st: s,
      org: ORG[i % ORG.length],
      no: (i % 3 === 0) ? '002458349298' : '45719827592135',
      sh: [250000, 250000, 9000, 9000, 9000, 9000, 9000, 9000][i % 8],
      nm: NM[i % NM.length],
      email: 'jh.kim@email.com',
      via: (i % 3 === 1) ? '관리자 등록' : '주주신청',
      at: '2027-07-' + EM.p2(20 + (i % 9)),
      done: done ? '2027-08-' + EM.p2(1 + (i % 9)) : '-'
    };
  }
  var DATA = { mgr: [], proxy: [] };
  for (var i = 0; i < 8; i++) DATA.mgr.push(mk('mgr', i));
  for (var j = 0; j < 6; j++) DATA.proxy.push(mk('proxy', j + 2));

  /* 주주PASS 에서 올라온 대리인 지정 요청 — 같은 기기의 cx.proxy 를 읽는다 */
  function inbox() {
    var v = [];
    try { v = JSON.parse(localStorage.getItem('cx.proxy') || '[]'); } catch (e) { v = []; }
    if (!v.length) return [];
    return v.map(function (r, n) {
      return {
        k: 'in-' + n, kind: 'proxy', st: r.st || '승인대기', fromPass: true,
        org: r.org || r.nm || '-', no: r.no || '-', sh: +r.sh || 0,
        nm: r.nm || '-', email: r.email || '-', via: '주주신청',
        at: (r.at || '').slice(0, 10) || '-', done: r.done || '-',
        meta: r
      };
    });
  }
  function rows() { return inbox().concat(DATA[tab]).filter(function (x) { return x.kind === tab; }); }

  /* ---------- 표 ---------- */
  var COLS = [['상태', 90, 'c', 'c'], ['기관(법인)명', 0], ['주주 번호', 0],
              ['보유 주식수', 110, 'n'], ['담당자', 92], ['이메일', 150],
              ['등록경로', 104], ['요청일', 120], ['처리일', 120], ['', 44, 'c']];
  function val(x, c) {
    switch (c) {
      case '상태': return x.st; case '기관(법인)명': return x.org; case '주주 번호': return x.no;
      case '보유 주식수': return cm(x.sh); case '담당자': return x.nm; case '이메일': return x.email;
      case '등록경로': return x.via; case '요청일': return x.at; case '처리일': return x.done;
    }
    return '';
  }
  function cell(x, c) {
    if (c === '상태') return '<span class="lc-b ' + TONE[x.st] + '"><i></i>' + x.st + '</span>';
    if (c === '') return '<button class="px-more" type="button" data-more="' + x.k + '" aria-label="더보기"><i class="ph ph-dots-three"></i></button>';
    var t = val(x, c);
    return (c === '요청일' || c === '처리일' || t === '-') ? '<span class="mu">' + esc(t) + '</span>' : esc(t);
  }

  var tab = 'mgr', chip = 'all', page = 1, size = 25, LASTP = 1;
  var LB = { mgr: '담당자', proxy: '대리인' };

  root.innerHTML = '<div class="lc">' +
    '<div class="lc-hd"><h2>담당자 · 대리인 지정 관리</h2>' +
      '<p>의결권을 행사할 국내 기관 담당자 및 국내·해외 개인·법인 주주의 대리인을 직접 지정하거나, 접수된 요청을 승인할 수 있습니다.</p></div>' +
    '<div class="lc-bar" style="gap:12px">' +
      '<span class="lc-seg" id="pxSeg"><button type="button" class="on" data-t="mgr">담당자 지정</button>' +
        '<button type="button" data-t="proxy">대리인 지정</button></span>' +
      '<div class="lc-chips" id="pxChips"></div>' +
      '<button class="btn dark" type="button" id="pxAdd">담당자 지정</button><span data-cx-tools></span></div>' +
    '<div class="lc-wrap"><div class="lc-scroll"><table class="lctbl" id="pxTbl"><colgroup>' +
      COLS.map(function (c) { return c[1] ? '<col style="width:' + c[1] + 'px">' : '<col>'; }).join('') + '</colgroup>' +
      '<thead><tr>' + COLS.map(function (c) {
        return '<th' + (c[2] ? ' class="' + c[2] + '"' : '') + (c[3] ? ' data-al="' + c[3] + '"' : '') +
          (c[2] === 'n' ? ' data-al="r"' : '') + '>' + c[0] + '</th>';
      }).join('') + '</tr></thead><tbody id="pxBody"></tbody></table></div>' +
      '<div class="lc-foot"><span class="cnt" id="pxCount"></span>' +
        '<span class="lc-pg">페이지당 <select id="pxSize"><option>25</option><option>50</option><option>100</option></select>' +
        '<span class="lc-pages" id="pxPager"></span></span></div>' +
    '</div>' +
    '<div class="px-menu" id="pxMenu" hidden>' +
      '<button type="button" data-act="fix"><i class="ph ph-paper-plane-tilt"></i><span class="t"></span></button>' +
      '<button type="button" data-act="deny"><i class="ph ph-prohibit"></i><span class="t"></span></button>' +
      '<button type="button" data-act="drop"><i class="ph ph-prohibit"></i><span class="t"></span></button>' +
    '</div></div>';

  var body = document.getElementById('pxBody'), menu = document.getElementById('pxMenu');

  function chipFilter(list) {
    if (chip === 'all') return list;
    if (chip === '보완요청') return list.filter(function (x) { return x.st === '보완요청' || x.st === '재보완요청'; });
    return list.filter(function (x) { return x.st === chip; });
  }
  function paintChips() {
    var base = rows();
    var C = [['all', '전체', null], ['승인대기', '승인대기'], ['보완요청', '보완요청'],
             ['승인완료', '승인완료'], ['반려', '반려'], ['지정철회', '지정철회']];
    document.getElementById('pxChips').innerHTML = C.map(function (c) {
      var n = c[0] === 'all' ? base.length
        : c[0] === '보완요청' ? base.filter(function (x) { return x.st === '보완요청' || x.st === '재보완요청'; }).length
        : base.filter(function (x) { return x.st === c[0]; }).length;
      return '<button type="button" class="lc-chip' + (chip === c[0] ? ' on' : '') + '" data-chip="' + c[0] + '">' +
        c[1] + '<span class="c">' + n + '</span></button>';
    }).join('');
  }
  function render() {
    paintChips();
    var list = chipFilter(rows());
    var pages = Math.max(1, Math.ceil(list.length / size));
    if (page > pages) page = pages;
    var view = list.slice((page - 1) * size, page * size);
    body.innerHTML = view.length
      ? view.map(function (x) {
          return '<tr data-k="' + x.k + '">' + COLS.map(function (c) {
            return '<td' + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + cell(x, c[0]) + '</td>';
          }).join('') + '</tr>';
        }).join('')
      : '<tr><td colspan="' + COLS.length + '"><div class="lc-empty">접수된 요청이 없습니다</div></td></tr>';
    document.getElementById('pxCount').textContent = '총 ' + cm(list.length) + '건';
    LASTP = pages;
    document.getElementById('pxPager').innerHTML = EM.pagerHtml(page, pages);
    document.getElementById('pxAdd').textContent = LB[tab] + ' 지정';
    if (window.CX && CX.table) CX.table(document.getElementById('pxTbl'));
  }

  /* ---------- 이벤트 ---------- */
  document.getElementById('pxSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b) return;
    tab = b.dataset.t; chip = 'all'; page = 1;
    Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
    render();
  });
  document.getElementById('pxChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-chip]'); if (!b) return;
    chip = b.dataset.chip; page = 1; render();
  });
  document.getElementById('pxPager').addEventListener('click', function (e) {
    var b = e.target.closest('.pp'); if (!b || b.classList.contains('dis')) return;
    page = EM.pagerGo(b.dataset.pg, page, LASTP); render();
  });
  document.getElementById('pxSize').addEventListener('change', function () {
    size = parseInt(this.value, 10) || 25; page = 1; render();
  });
  document.getElementById('pxAdd').addEventListener('click', function () {
    EM.toast(LB[tab] + ' 지정은 시연 대상이 아닙니다.');
  });

  /* 행 더보기 메뉴 */
  var cur = null;
  body.addEventListener('click', function (e) {
    var b = e.target.closest('[data-more]'); if (!b) return;
    e.stopPropagation();
    cur = rows().filter(function (x) { return x.k === b.dataset.more; })[0];
    var L = LB[tab];
    menu.querySelectorAll('[data-act]')[0].querySelector('.t').textContent = '보완 요청';
    menu.querySelectorAll('[data-act]')[1].querySelector('.t').textContent = L + ' 지정 반려';
    menu.querySelectorAll('[data-act]')[2].querySelector('.t').textContent = L + ' 지정 철회';
    var r = b.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, r.right - menu.offsetWidth) + 'px';
  });
  document.addEventListener('click', function () { menu.hidden = true; });
  menu.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a || !cur) return;
    e.stopPropagation(); menu.hidden = true;
    var to = a.dataset.act === 'fix' ? '보완요청' : a.dataset.act === 'deny' ? '반려' : '지정철회';
    cur.st = (to === '보완요청' && cur.st === '보완요청') ? '재보완요청' : to;
    cur.done = EM.now().slice(0, 10);
    if (cur.fromPass) saveInbox(cur);
    render();
    EM.toast(a.querySelector('.t').textContent + ' 처리했습니다.');
  });

  /* 주주PASS 쪽 기록도 같이 고친다 */
  function saveInbox(x) {
    var v = [];
    try { v = JSON.parse(localStorage.getItem('cx.proxy') || '[]'); } catch (e) { return; }
    var n = +String(x.k).split('-')[1];
    if (v[n]) { v[n].st = x.st; v[n].done = x.done; }
    try { localStorage.setItem('cx.proxy', JSON.stringify(v)); } catch (e) {}
  }

  /* 주주가 새로 신청하면 바로 표에 올라온다 */
  window.addEventListener('storage', function (e) { if (e.key === 'cx.proxy') render(); });
  setInterval(function () {
    var n = inbox().length;
    if (n !== setInterval.last) { setInterval.last = n; render(); }
  }, 2000);

  render();
})();
