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
  var ORG = ['미래에셋자산운용', '삼성자산운용', '한국투자신탁운용', 'KB자산운용', '신한자산운용',
             'NH-아문디자산운용', '키움투자자산운용', '한화자산운용', '교보악사자산운용', '하나UBS자산운용'];
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
  var COLS = [['상태', 110, 'c', 'c'], ['기관(법인)명', 0], ['주주 번호', 150],
              ['보유 주식수', 110, 'n'], ['담당자', 92], ['이메일', 160],
              ['등록경로', 104], ['요청일', 132], ['처리일', 132], ['', 44, 'c']];
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

  var SEARCH_KEY = [['투표권자'],['주주명'],['주주 번호'],['실질계좌번호']];
  var tab = 'mgr', chip = 'all', page = 1, size = 25, LASTP = 1;
  function DOCF(t, d) {
    return '<div class="pxa-doc"><label>' + t + '</label>' +
      '<button class="pxa-drop" type="button" data-aup="' + t + '">' +
        '<i class="ph ph-file-arrow-up"></i>파일 첨부 (pdf, jpg, png)</button>' +
      '<div class="pxa-file" hidden><span class="ic"><i class="ph ph-file"></i></span>' +
        '<span class="nm"></span><span class="sz"></span>' +
        '<button class="x" type="button" data-adel><i class="ph ph-x"></i></button></div>' +
      '<div class="hint">' + d + '</div></div>';
  }
  var LB = { mgr: '담당자', proxy: '대리인' };

  root.innerHTML = '<div class="lc">' +
    '<div class="lc-hd"><h2>담당자 · 대리인 지정 관리</h2>' +
      '<p>의결권을 행사할 국내 기관 담당자 및 국내·해외 개인·법인 주주의 대리인을 직접 지정하거나, 접수된 요청을 승인할 수 있습니다.</p></div>' +
    '<div class="lc-bar" style="gap:12px">' +
      '<span class="lc-seg" id="pxSeg"><button type="button" class="on" data-t="mgr">담당자 지정</button>' +
        '<button type="button" data-t="proxy">대리인 지정</button></span>' +
      '<div class="lc-chips" id="pxChips"></div>' +
      '<button class="btn dark" type="button" id="pxAdd">담당자 지정</button><span data-cx-tools></span></div>' +
    '<div class="lc-wrap"><div class="lc-scroll"><table class="lctbl" id="pxTbl" style="min-width:1214px"><colgroup>' +
      COLS.map(function (c) { return c[1] ? '<col style="width:' + c[1] + 'px">' : '<col>'; }).join('') + '</colgroup>' +
      '<thead><tr>' + COLS.map(function (c) {
        return '<th' + (c[2] ? ' class="' + c[2] + '"' : '') + (c[3] ? ' data-al="' + c[3] + '"' : '') +
          (c[2] === 'n' ? ' data-al="r"' : '') + '>' + c[0] + '</th>';
      }).join('') + '</tr></thead><tbody id="pxBody"></tbody></table></div>' +
      '<div class="lc-foot"><span class="cnt" id="pxCount"></span>' +
        '<span class="lc-pg">페이지당 <select id="pxSize"><option>25</option><option>50</option><option>100</option></select>' +
        '<span class="lc-pages" id="pxPager"></span></span></div>' +
    '</div>' +
    '<div class="pxd-ov" id="pxDlg"><div class="pxd">' +
      '<button class="pxd-x" type="button" data-dx aria-label="닫기"><i class="ph ph-x"></i></button>' +
      '<div class="pxd-hd"><div class="pxd-t"></div><div class="pxd-d"></div></div>' +
      '<div class="pxd-bd"><div class="pxd-lb"></div><textarea id="pxDlgTa" rows="3"></textarea>' +
        '<div class="pxd-note"></div></div>' +
      '<div class="pxd-ft"><button class="btn" type="button" data-dno>취소</button>' +
        '<button class="btn dark" type="button" data-dok disabled>확인</button></div></div></div>' +

    '<div class="pxa-ov" id="pxAddDlg"><div class="pxa" id="pxaIn"></div></div>' +

    '<div class="sheet-ov lc-sheet" id="pxSheet"><div class="sheet">' +
      '<button class="sheet-x" type="button" data-sx aria-label="닫기"><i class="ph ph-x" style="font-size:16px"></i></button>' +
      '<div class="sheet-hd"><div class="sheet-t" id="pxShT">담당자 지정 상세</div></div>' +
      '<div class="sheet-body" id="pxShBody"></div>' +
      '<div class="lc-shft"><div class="sheet-ft" id="pxShFt"></div>' +
        '<div class="lc-mod" id="pxShMod"></div></div></div></div>' +

    '<div class="pxd-ov" id="pxOkDlg"><div class="pxd" style="width:480px">' +
      '<button class="pxd-x" type="button" data-kx aria-label="닫기"><i class="ph ph-x"></i></button>' +
      '<div class="pxd-hd"><div class="pxd-t" id="pxOkT"></div><div class="pxd-d">아래 항목을 확인 후 승인해 주세요.</div></div>' +
      '<div class="pxd-bd"><div class="pxk-box" id="pxOkBox"></div>' +
        '<div class="pxk-alert"><i class="ph ph-warning-circle"></i><span id="pxOkNote"></span></div></div>' +
      '<div class="pxd-ft"><button class="pxk-ck" type="button" id="pxOkCk"><span class="bx"></span>' +
        '<span class="lb">증빙 서류를 모두 검토했으며, 이상 없음을 확인합니다.</span></button>' +
        '<button class="btn" type="button" data-kno>취소</button>' +
        '<button class="btn dark" type="button" data-kok disabled>승인</button></div></div></div>' +

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
  /* ═══ 지정 등록 모달 ═══════════════════════════════════
     담당자 : Figma 16880:169454 · 17138:61851
     대리인 : Figma 17138:64540 · 67150 · 64693 · 66595          */
  var add = document.getElementById('pxAddDlg'), shell = document.getElementById('pxaIn');
  var KEYS = ['투표권자', '주주명', '주주 번호', '계좌번호'];
  var COUNTRY = ['United States', 'South Korea', 'Japan', 'United Kingdom', 'Singapore', 'Hong Kong'];
  var AD = { kind: 'indi', loc: 'home', files: {}, picks: [] };

  /* 조합별 증빙 서류 */
  var ADOC = {
    'indi/home': [
      ['대리권 증명서', '주주 본인의 서명 또는 도장을 날인한 대리권 증명서(위임장)를 첨부해 주세요.'],
      ['주주 본인 신분증 사본', '위임장 확인을 위한 주주 본인의 신분증(주민등록증, 운전면허증 등) 사본을 첨부해 주세요. 주민등록번호 뒷자리는 가림(마스킹) 처리해 주세요.'],
      ['대리인 신분증 사본', '주총장에 참석하시는 대리인의 신분증 사본을 첨부해 주세요. 주민등록번호 뒷자리는 가림(마스킹) 처리해 주세요.']
    ],
    'indi/abroad': [
      ['보유주식 증빙 서류', '주주명부 기준일 현재 주식 보유 내역을 확인할 수 있는 잔고증명서를 첨부해 주세요.'],
      ['본인 확인 서류(선택)', '주주번호에 여권번호를 입력하신 경우, 본인 확인을 위해 유효한 여권 사본을 첨부해 주세요.']
    ],
    'corp/home': [
      ['대리권 증명서', '법인 인감을 날인한 대리권 증명서(위임장)를 첨부해 주세요', 1],
      ['법인인감증명서', '대리권 증명서에 날인한 인감과 같아야 하며, 3개월 이내 발급분만 가능합니다.'],
      ['담당자 재직증명서', '담당자의 재직증명서를 첨부해 주세요']
    ],
    'corp/abroad': [
      ['대리권 증명 서류', '대상 주주총회와 위임 범위가 명시된 위임장을 첨부해 주세요', 1],
      ['보유주식 증빙 서류', '주주명부 기준일 현재 주식 보유 내역을 확인할 수 있는 잔고증명서를 첨부해 주세요'],
      ['서명권자 증빙 서류', '대표 서명 권한을 증명하는 서류(이사직임증명서, 이사회 결의서 등)를 첨부해 주세요']
    ]
  };
  /* 담당자 지정은 한 가지 서류 묶음만 쓴다 */
  var MDOC = ADOC['corp/abroad'];

  function fdHtml(id, label, ph, opt) {
    opt = opt || {};
    return '<div class="pxa-f"><label>' + label + '</label>' +
      (opt.intl
        ? '<div class="pxa-row"><select data-af class="w120"><option value="" selected disabled>국가 선택</option>' +
            COUNTRY.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>' +
          '<input data-af type="tel" inputmode="numeric" maxlength="12" placeholder="휴대폰번호 (숫자만 입력)"></div>'
        : '<input data-af' + (opt.opt ? ' data-opt' : '') + ' type="' + (opt.type || 'text') + '"' +
          (opt.num ? ' inputmode="numeric"' : '') + (opt.max ? ' maxlength="' + opt.max + '"' : '') +
          ' placeholder="' + ph + '">') +
      '</div>';
  }
  function docHtml(list) {
    return list.map(function (d, i) {
      return '<div class="pxa-doc"><label>' + d[0] + '</label>' +
        '<button class="pxa-drop" type="button" data-aup="' + i + '">' +
          '<i class="ph ph-file-arrow-up"></i>파일 첨부 (pdf, jpg, png)</button>' +
        '<div class="pxa-file" hidden><span class="ic"><i class="ph ph-file"></i></span>' +
          '<span class="nm"></span><span class="sz"></span>' +
          '<button class="x" type="button" data-adel="' + i + '"><i class="ph ph-x"></i></button></div>' +
        '<div class="hint">' + d[1] + '</div></div>';
    }).join('');
  }
  function leftHtml() {
    var isP = (tab === 'proxy'), L = LB[tab], h = '';
    if (isP) {
      h += '<div class="pxa-sec">대리인 유형</div>' +
        '<div class="pxa-f"><label>유형</label><div class="pxa-seg" data-aseg="kind">' +
          '<button type="button" class="' + (AD.kind === 'indi' ? 'on' : '') + '" data-v="indi">개인</button>' +
          '<button type="button" class="' + (AD.kind === 'corp' ? 'on' : '') + '" data-v="corp">법인</button></div></div>' +
        '<div class="pxa-f"><label>지역</label><div class="pxa-seg" data-aseg="loc">' +
          '<button type="button" class="' + (AD.loc === 'home' ? 'on' : '') + '" data-v="home">국내</button>' +
          '<button type="button" class="' + (AD.loc === 'abroad' ? 'on' : '') + '" data-v="abroad">해외</button></div></div>' +
        '<div class="pxa-sec" style="margin-top:24px">대리인 정보</div>';
    } else {
      h += '<div class="pxa-sec">담당자 정보</div>';
    }

    if (!isP || AD.kind === 'indi') {
      h += fdHtml('nm', '이름', '이름 입력');
      if (!isP || AD.loc === 'home') h += fdHtml('bd', '생년월일', '생년월일 8자리 (숫자만 입력)', { num: 1, max: 8 });
      h += fdHtml('ph', '휴대폰번호', '휴대폰번호 (숫자만 입력)', (isP && AD.loc === 'abroad') ? { intl: 1 } : { num: 1, max: 12 });
      h += fdHtml('em', '이메일', '이메일 입력', { type: 'email' });
    } else {
      h += fdHtml('nm', '법인(기관)명', AD.loc === 'home' ? '기업명 입력' : '법인(기관)명 입력');
      if (AD.loc === 'home') h += fdHtml('bz', '사업자등록번호', '사업자등록번호 입력');
      h += '<div class="pxa-sec" style="margin-top:24px">법인 담당자 정보</div>';
      h += fdHtml('mg', '담당자명', '담당자명 입력');
      h += fdHtml('dp', '부서 (선택)', '부서명 입력', { opt: 1 });
      h += fdHtml('ps', '직급 (선택)', '직급명 입력', { opt: 1 });
      h += fdHtml('ph', '휴대폰번호', '휴대폰번호 (숫자만 입력)', AD.loc === 'abroad' ? { intl: 1 } : { num: 1, max: 12 });
      h += fdHtml('em', '이메일', '이메일 입력', { type: 'email' });
    }

    var docs = isP ? ADOC[AD.kind + '/' + AD.loc] : MDOC;
    var hasForm = docs.some(function (d) { return d[2]; });
    h += '<div class="pxa-sec row" style="margin-top:24px">증빙 서류' +
      (hasForm || !isP ? '<button class="btn" type="button" data-form><i class="ph ph-download-simple"></i>대리권 증빙 양식</button>' : '') +
      '</div>' + docHtml(docs);
    return h;
  }
  function rightHtml() {
    var isP = (tab === 'proxy');
    return '<div class="pxa-sec">' + (isP ? '위임인 선택' : '기관(법인) 선택') + '</div>' +
      '<div class="pxa-sch"><select id="pxaKey">' + KEYS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select>' +
      '<span class="pxa-in"><i class="ph ph-magnifying-glass"></i><input id="pxaQ" type="text" autocomplete="off" placeholder="투표권자 검색">' +
        '<div class="pxa-dd" id="pxaDD" hidden></div></span>' +
      (isP ? '<button class="btn" type="button" id="pxaSame" disabled>보유 주식수와 동일위임</button>' : '') + '</div>' +
      '<div class="pxa-tblwrap"><table class="pxa-tbl"><thead><tr>' +
        '<th>투표권자</th><th>주주명</th><th>주주 번호</th><th class="n">보유 주식수</th>' +
        (isP ? '<th class="n">위임 주식수</th>' : '') + '<th class="c" style="width:44px"></th>' +
      '</tr></thead><tbody id="pxaRows"></tbody></table></div>';
  }
  function addOpen() {
    var isP = (tab === 'proxy'), L = LB[tab];
    AD.files = {}; AD.picks = [];
    shell.innerHTML =
      '<button class="pxd-x" type="button" data-ax aria-label="닫기"><i class="ph ph-x"></i></button>' +
      '<div class="pxa-hd"><div class="pxa-t">' + L + ' 지정</div><div class="pxa-d">' +
        (isP ? '주주를 대신해 대리인을 직접 지정 후 등록합니다. 관리자 등록 시 대리인 지정이 바로 승인완료로 처리됩니다.'
             : '의결권을 행사할 국내 기관(법인) 주주의 담당자를 직접 지정합니다.') + '</div></div>' +
      '<div class="pxa-bd"><div class="pxa-l" id="pxaL">' + leftHtml() + '</div>' +
        '<div class="pxa-r">' + rightHtml() + '</div></div>' +
      '<div class="pxa-ft"><span class="pxa-note">' +
        (isP ? '관리자 등록 시 대리인 지정이 바로 승인완료로 처리됩니다.'
             : '관리자 등록 시 바로 승인완료 처리되며, 참석자 코드가 담당자 이메일로 전송됩니다.') + '</span>' +
        '<button class="btn" type="button" data-ano>취소</button>' +
        '<button class="btn dark" type="button" data-aok disabled>' + L + ' 지정 등록</button></div>';
    paintPick(); addCheck();
    add.classList.add('show');
  }
  document.getElementById('pxAdd').addEventListener('click', addOpen);

  /* 검색 — 명부에서 찾는다 */
  function hits(q) {
    if (!q.trim()) return [];
    return CX.roster.filter(function (r) {
      return (r.nm + ' ' + (r.id || '') + ' ' + (r.ac || '')).indexOf(q.trim()) >= 0;
    }).sort(function (a, b) { return b.sh - a.sh; }).slice(0, 20);
  }
  /* 표 — 고른 주주만 쌓인다 */
  function paintPick() {
    var host = add.querySelector('#pxaRows'); if (!host) return;
    var isP = (tab === 'proxy'), span = isP ? 6 : 5;
    if (!AD.picks.length) {
      host.innerHTML = '<tr><td colspan="' + span + '"><div class="pxa-empty">' +
        (isP ? '검색 후 추가할 위임인을 선택해 주세요.' : '검색 후 기관(법인)을 선택해 주세요') + '</div></td></tr>';
      return;
    }
    host.innerHTML = AD.picks.map(function (r, i) {
      return '<tr><td>' + esc(r.nm) + '</td><td>' + esc(r.nm) + '</td><td>' + esc(r.id || '-') + '</td>' +
        '<td class="n">' + cm(r.sh) + '</td>' +
        (isP ? '<td class="n"><input class="qin" data-q="' + i + '" type="text" inputmode="numeric" value="' +
          (r.q != null ? cm(r.q) : '') + '" placeholder="위임 주식수"></td>' : '') +
        '<td class="c"><button class="pxa-rm" type="button" data-rm="' + i + '" aria-label="삭제"><i class="ph ph-x"></i></button></td></tr>' +
        (isP && r.bad ? '<tr class="errrow"><td colspan="' + span + '">위임 주식수는 보유 주식수 이내로 입력해 주세요</td></tr>' : '');
    }).join('');
  }

  /* 검색 결과 드롭다운 (Figma 16880:201519) */
  var SEL = {};   /* 다중 선택 임시 */
  function ddPaint() {
    var dd = add.querySelector('#pxaDD'); if (!dd) return;
    var q = add.querySelector('#pxaQ').value;
    if (!q.trim()) { dd.hidden = true; dd.innerHTML = ''; return; }
    var L = hits(q);
    dd.__list = L;
    if (!L.length) { dd.hidden = false; dd.innerHTML = '<div class="pxa-ddempty">검색 결과가 없습니다</div>'; return; }
    var multi = (tab === 'proxy');
    dd.innerHTML = L.map(function (r, i) {
      var lock = (i % 7 === 3) || AD.picks.some(function (x) { return x.id === r.id && x.nm === r.nm; });
      var meta = esc(r.id || '-') + '・' + cm(r.sh) + '주' + (lock ? '・' + LB[tab] + ' 지정됨' : '');
      return '<button class="pxa-ddi' + (lock ? ' lock' : '') + (SEL[i] ? ' on' : '') + '" type="button" data-dd="' + i + '">' +
        '<span class="t1">' + esc(r.nm) + '</span>' +
        '<span class="t2">' + esc(r.nm) + '</span>' +
        '<span class="t3' + (lock ? ' bl' : '') + '">' + meta + '</span>' +
        '<i class="ck ph ph-check"></i></button>';
    }).join('') +
      (multi ? '<div class="pxa-ddft"><button class="btn dark" type="button" id="pxaAddSel" ' +
        (Object.keys(SEL).length ? '' : 'disabled') + '>위임 주주 선택' +
        (Object.keys(SEL).length ? ' (' + Object.keys(SEL).length + ')' : '') + '</button></div>' : '');
    dd.hidden = false;
  }
  function ddClose() { var dd = add.querySelector('#pxaDD'); if (dd) { dd.hidden = true; } SEL = {}; }

  add.addEventListener('input', function (e) {
    if (e.target.type === 'tel') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (e.target.id === 'pxaQ') { SEL = {}; ddPaint(); return; }
    if (e.target.classList.contains('qin')) {
      var r = AD.picks[+e.target.dataset.q];
      var v = e.target.value.replace(/\D/g, '');
      r.q = v ? +v : null; r.bad = (r.q != null && r.q > r.sh);
      e.target.value = v ? cm(v) : '';
      var err = e.target.closest('tr').nextElementSibling;
      if (r.bad && !(err && err.classList.contains('errrow'))) paintPick();
      else if (!r.bad && err && err.classList.contains('errrow')) paintPick();
    }
    addCheck();
  });
  add.addEventListener('focusin', function (e) { if (e.target.id === 'pxaQ') ddPaint(); });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.pxa-in')) ddClose();
  });
  add.addEventListener('change', function (e) {
    if (e.target.id === 'pxaKey') {
      var q = add.querySelector('#pxaQ'); q.placeholder = e.target.value + ' 검색';
    }
    addCheck();
  });
  add.addEventListener('click', function (e) {
    if (e.target === add || e.target.closest('[data-ax]') || e.target.closest('[data-ano]')) { add.classList.remove('show'); return; }

    var seg = e.target.closest('[data-aseg] [data-v]');
    if (seg) {
      AD[seg.parentNode.dataset.aseg] = seg.dataset.v;
      AD.files = {};
      document.getElementById('pxaL').innerHTML = leftHtml();
      addCheck(); return;
    }
    /* 검색 결과에서 고르기 */
    var di = e.target.closest('[data-dd]');
    if (di) {
      e.stopPropagation();
      if (di.classList.contains('lock')) { EM.toast('이미 ' + LB[tab] + '이 지정된 주주입니다.'); return; }
      var dd = add.querySelector('#pxaDD'), r = dd.__list[+di.dataset.dd];
      if (tab === 'proxy') {                     /* 여러 명 고를 수 있다 */
        if (SEL[di.dataset.dd]) delete SEL[di.dataset.dd]; else SEL[di.dataset.dd] = r;
        ddPaint(); return;
      }
      AD.picks = [{ nm: r.nm, id: r.id, sh: r.sh, q: null }];   /* 담당자는 한 곳만 */
      add.querySelector('#pxaQ').value = ''; ddClose(); paintPick(); addCheck(); return;
    }
    if (e.target.closest('#pxaAddSel')) {
      e.stopPropagation();
      Object.keys(SEL).forEach(function (k) {
        var r = SEL[k];
        if (!AD.picks.some(function (x) { return x.id === r.id && x.nm === r.nm; }))
          AD.picks.push({ nm: r.nm, id: r.id, sh: r.sh, q: null });
      });
      add.querySelector('#pxaQ').value = ''; ddClose(); paintPick(); addCheck(); return;
    }
    var rm = e.target.closest('[data-rm]');
    if (rm) { AD.picks.splice(+rm.dataset.rm, 1); paintPick(); addCheck(); return; }
    if (e.target.closest('#pxaSame')) {
      AD.picks.forEach(function (r) { r.q = r.sh; r.bad = false; });
      paintPick(); addCheck(); return;
    }
    if (e.target.closest('[data-form]')) { EM.toast('양식 다운로드는 시연 대상이 아닙니다.'); return; }
    var up = e.target.closest('[data-aup]');
    if (up) {
      var docs = (tab === 'proxy') ? ADOC[AD.kind + '/' + AD.loc] : MDOC, i = up.dataset.aup;
      AD.files[i] = 1;
      var box = up.parentNode.querySelector('.pxa-file');
      box.querySelector('.nm').textContent = docs[i][0].replace(/\(선택\)$/, '').trim() + '.pdf';
      box.querySelector('.sz').textContent = (Math.round((0.6 + Math.random() * 3) * 10) / 10) + 'MB';
      box.hidden = false; up.hidden = true; addCheck(); return;
    }
    var del = e.target.closest('[data-adel]');
    if (del) {
      delete AD.files[del.dataset.adel];
      var b = del.closest('.pxa-file'); b.hidden = true;
      b.parentNode.querySelector('.pxa-drop').hidden = false; addCheck(); return;
    }
    var ok = e.target.closest('[data-aok]');
    if (ok && !ok.disabled) {
      var f = add.querySelectorAll('#pxaL [data-af]'), v = [];
      Array.prototype.forEach.call(f, function (i) { v.push(i.value); });
      var pick = AD.picks[0];
      DATA[tab].unshift({
        k: tab + '-new-' + Date.now(), kind: tab, st: '승인완료',
        org: pick ? pick.nm : '-', no: pick ? (pick.id || '-') : '-',
        sh: pick ? (tab === 'proxy' && pick.q != null ? pick.q : pick.sh) : 0,
        nm: v[0], email: v[v.length - 1],
        via: '관리자 등록', at: EM.now().slice(0, 10), done: EM.now().slice(0, 10)
      });
      add.classList.remove('show'); render();
      EM.toast(LB[tab] + ' 지정을 등록했습니다.');
    }
  });
  function addCheck() {
    if (!add.classList.contains('show') && !shell.innerHTML) return;
    var isP = (tab === 'proxy');
    var f = add.querySelectorAll('#pxaL [data-af]'), ok = AD.picks.length > 0;
    Array.prototype.forEach.call(f, function (i) {
      if (i.hasAttribute('data-opt')) return;
      if (!String(i.value).trim()) ok = false;
    });
    var docs = isP ? ADOC[AD.kind + '/' + AD.loc] : MDOC;
    docs.forEach(function (d, i) { if (!/\(선택\)$/.test(d[0]) && !AD.files[i]) ok = false; });
    if (isP) AD.picks.forEach(function (r) { if (r.q == null || r.bad) ok = false; });
    var same = add.querySelector('#pxaSame'); if (same) same.disabled = !AD.picks.length;
    var b = add.querySelector('[data-aok]'); if (b) b.disabled = !ok;
  }

  /* ═══ 상세 시트 (Figma 16923:209256 계열 · 17138:71071 계열) ═══ */
  var sheet = document.getElementById('pxSheet'), SX = null;
  var DOCS3 = [
    ['대리권 증명 서류', '대상 주주총회와 위임 범위가 명시된 위임장을 첨부해 주세요'],
    ['보유주식 증빙 서류', '주주명부 기준일 현재 주식 보유 내역을 확인할 수 있는 잔고증명서를 첨부해 주세요'],
    ['서명권자 증빙 서류', '대표 서명 권한을 증명하는 서류(이사직임증명서, 이사회 결의서 등)를 첨부해 주세요']
  ];
  var MDOCS3 = [
    ['대리권 증빙 서류', '대상 주주총회와 위임 범위가 명시된 위임장(POA)을 첨부해 주세요.'],
    ['보유주식 증빙 서류', '주주명부 기준일 현재 보유 주식을 확인할 수 있는 잔고증명서 등을 첨부해 주세요.'],
    ['서명권자 증빙 서류', '대표 서명 권한을 증명하는 서류(이사직임증명서, 이사회 결의서 등)를 첨부해 주세요.']
  ];
  /* 처리 사유 — 상태에 맞는 이력을 만든다 */
  function logs(x) {
    var L = [], who = ' · 박지용', isP = (x.kind === 'proxy');
    if (x.st === '지정철회') L.push(['지정철회', '2026-03-11 15:20' + who,
      isP ? '위임인이 대리인 지정 철회를 요청했습니다.' : '신청 기관에서 지정철회를 요청했습니다.']);
    if (x.st === '반려') L.push(['반려', '2026-03-10 11:04' + who,
      isP ? '재제출된 위임장의 대리인 성명이 신청 정보와 달라 반려합니다.'
          : '재제출된 보유주식 증빙 서류가 실제 보유 주식 수 정보와 달라 반려합니다.']);
    if (x.st === '보완요청' || x.st === '재보완요청' || x.st === '반려' || x.st === '지정철회')
      L.push(['보완요청', '2026-03-08 09:41' + who,
        isP ? '위임장에 위임 주식수가 기재되어 있지 않습니다. 확인 후 다시 첨부해 주세요.'
            : '담당자 서명권자 증빙 서류가 첨부되지 않았습니다. 서명권자 증빙 서류를 추가로 첨부해 주세요.']);
    return L;
  }
  function kv(k, v) { return '<div class="pxs-r"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function fileRow(nm) {
    return '<div class="pxa-file"><span class="ic"><i class="ph ph-file"></i></span>' +
      '<span class="nm">' + nm + '.pdf</span><span class="sz">1.2MB</span>' +
      '<button class="x" type="button"><i class="ph ph-download-simple"></i></button></div>';
  }
  function openSheet(x) {
    SX = x;
    var isP = (x.kind === 'proxy'), L = LB[x.kind], done = (x.st === '승인완료');
    var lock = (x.st === '승인완료' || x.st === '반려' || x.st === '지정철회');
    document.getElementById('pxShT').textContent = L + ' 지정 상세';

    var h = '<div class="pxs-st"><span class="k">처리상태</span>' +
      '<span class="lc-b ' + TONE[x.st] + '"><i></i>' + x.st + '</span></div>';

    h += '<div class="pxs-sec">' + (isP ? '위임인 정보' : '신청 기관 정보') + '</div>' +
      (isP
        ? kv('위임인', esc(x.org)) + kv('주주 번호', esc(x.no)) +
          kv('휴대폰번호', '010-1234-5678') + kv('이메일', 'ir@irkuddos.co.kr') +
          kv('보유 주식수', cm(x.sh) + '주')
        : kv('기관(법인)명', esc(x.org)) + kv('주주 번호', esc(x.no)) + kv('보유 주식수', cm(x.sh) + '주'));

    h += '<div class="pxs-line"></div><div class="pxs-sec">' + L + ' 정보</div>' +
      kv('이름', esc(x.nm)) + kv('생년월일', '1985.06.19') +
      kv('휴대폰번호', '010-1234-5678') + kv('이메일', esc(x.email)) +
      (isP ? kv('위임 주식수', cm(x.sh) + '주') : '') +
      kv('참석자 코드', done ? '<span class="pxs-code">EG-20240302</span>'
        : '<span class="pxs-code">' + (isP ? '승인 시 대리인 지정 안내와 참석자 코드가 이메일로 전송됩니다.'
                                            : '승인 시 참석자 코드가 담당자 이메일로 전송됩니다.') + '</span>');

    h += '<div class="pxs-line"></div><div class="pxs-sec row">제출 서류' +
      '<button class="btn" type="button" data-sfix' + (lock ? ' disabled' : '') +
        '><i class="ph ph-paper-plane-tilt"></i>서류 보완요청</button></div>';
    (isP ? DOCS3 : MDOCS3).forEach(function (d) {
      h += '<div class="pxs-doc"><div class="t">' + d[0] + '</div>' + fileRow(d[0]) +
        '<div class="hint">' + d[1] + '</div></div>';
    });

    var LG = logs(x);
    if (LG.length) {
      h += '<div class="pxs-line"></div><div class="pxs-sec">처리 사유</div>';
      LG.forEach(function (g) {
        h += '<div class="pxs-log"><div class="hd"><span class="lc-b ' + TONE[g[0]] + '"><i></i>' + g[0] + '</span>' +
          '<span class="w">' + g[1] + '</span></div><div class="bd">' + g[2] + '</div></div>';
      });
    }
    document.getElementById('pxShBody').innerHTML = h;

    var ft = '';
    if (x.st === '승인대기' || x.st === '보완요청' || x.st === '재보완요청')
      ft = '<button class="btn danger" type="button" data-sa="deny">' + L + ' 지정 반려</button>' +
           '<button class="btn dark" type="button" data-sa="ok">' + L + ' 지정 승인</button>';
    else if (x.st === '승인완료')
      ft = '<button class="btn danger" type="button" data-sa="drop">' + L + ' 지정 철회</button>' +
           '<button class="btn" type="button" data-sa="close">닫기</button>';
    else ft = '<button class="btn" type="button" data-sa="close" style="flex:1">닫기</button>';
    document.getElementById('pxShFt').innerHTML = ft;
    document.getElementById('pxShMod').textContent = '최종 수정 ' + (x.done !== '-' ? x.done + ' 15:58' : x.at + ' 15:58') + ' · 박지용';
    sheet.classList.add('show');
  }
  body.addEventListener('click', function (e) {
    if (e.target.closest('[data-more]')) return;
    var tr = e.target.closest('tr[data-k]'); if (!tr) return;
    var x = rows().filter(function (r) { return r.k === tr.dataset.k; })[0];
    if (x) openSheet(x);
  });
  sheet.addEventListener('click', function (e) {
    if (e.target.closest('[data-sx]') || e.target === sheet) { sheet.classList.remove('show'); return; }
    if (e.target.closest('[data-sfix]')) { askDlg('fix', SX); return; }
    var a = e.target.closest('[data-sa]'); if (!a || !SX) return;
    var k = a.dataset.sa;
    if (k === 'close') { sheet.classList.remove('show'); return; }
    if (k === 'ok') { okDlg(SX); return; }
    askDlg(k === 'deny' ? 'deny' : 'drop', SX);
  });

  /* 승인 모달 */
  var okdlg = document.getElementById('pxOkDlg'), okX = null, okAgree = false;
  function okDlg(x) {
    okX = x; okAgree = false;
    var isP = (x.kind === 'proxy');
    document.getElementById('pxOkT').textContent = LB[x.kind] + ' 지정 승인';
    document.getElementById('pxOkBox').innerHTML = isP
      ? '<div class="r"><span class="k">위임장 증빙 :</span><span class="v">위임인 서명 및 날인 여부</span></div>' +
        '<div class="r"><span class="k">신청 정보 :</span><span class="v">입력 정보와 제출 서류 일치 여부</span></div>'
      : '<div class="r"><span class="k">보유 주식 증빙 :</span><span class="v">기관 투표권자명 및 주식수 일치 여부</span></div>' +
        '<div class="r"><span class="k">대리권 증빙 :</span><span class="v">위임장 서명 · 날인 및 권한 범위</span></div>' +
        '<div class="r"><span class="k">서명권자 증빙 :</span><span class="v">대표 권한 및 자격 증명</span></div>';
    document.getElementById('pxOkNote').textContent = isP
      ? '대리인 지정 안내가 메일로 전송됩니다.'
      : '담당자 이메일로 담당자 지정 안내와 참석자 코드가 전송됩니다.';
    document.getElementById('pxOkCk').classList.remove('on');
    okdlg.querySelector('[data-kok]').disabled = true;
    okdlg.classList.add('show');
  }
  okdlg.addEventListener('click', function (e) {
    if (e.target === okdlg || e.target.closest('[data-kx]') || e.target.closest('[data-kno]')) { okdlg.classList.remove('show'); return; }
    if (e.target.closest('#pxOkCk')) {
      okAgree = !okAgree;
      document.getElementById('pxOkCk').classList.toggle('on', okAgree);
      okdlg.querySelector('[data-kok]').disabled = !okAgree;
      return;
    }
    var ok = e.target.closest('[data-kok]');
    if (ok && !ok.disabled) {
      okX.st = '승인완료'; okX.done = EM.now().slice(0, 10);
      if (okX.fromPass) saveInbox(okX);
      okdlg.classList.remove('show'); sheet.classList.remove('show');
      render(); EM.toast(LB[okX.kind] + ' 지정을 승인했습니다.');
    }
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
  /* 확인 모달 (Figma 16874:98927) — 보완 요청 · 반려 · 철회 */
  var ASK = {
    fix:  { t:'서류 보완을 요청하시겠어요?', d:'신청 기관에 서류 재제출 안내가 발송됩니다.',
            lb:'보완요청 사유', ph:'보완요청 사유 입력', ok:'보완 요청', to:'보완요청' },
    deny: { t:'해당 {L} 지정 건을 반려하시겠어요?', lb:'반려 사유', ph:'반려 사유 입력',
            note:'반려 후에는 취소할 수 없습니다.', ok:'반려', to:'반려' },
    drop: { t:'해당 {L} 지정을 철회하시겠어요?', lb:'철회 사유', ph:'철회 사유 입력',
            note:'철회 후에는 취소할 수 없습니다.', ok:'철회', to:'지정철회' }
  };
  var dlg = document.getElementById('pxDlg');
  function askDlg(k, x) {
    var m = ASK[k], L = LB[x.kind];
    dlg.querySelector('.pxd-t').textContent = m.t.replace('{L}', L);
    dlg.querySelector('.pxd-d').textContent = m.d || '';
    dlg.querySelector('.pxd-d').hidden = !m.d;
    dlg.querySelector('.pxd-lb').textContent = m.lb;
    var ta = dlg.querySelector('#pxDlgTa'); ta.value = ''; ta.placeholder = m.ph;
    dlg.querySelector('.pxd-note').textContent = m.note || '';
    dlg.querySelector('.pxd-note').hidden = !m.note;
    var ok = dlg.querySelector('[data-dok]'); ok.textContent = m.ok; ok.disabled = true;
    dlg.classList.add('show');
    dlg.onsubmit = function () {
      x.st = (m.to === '보완요청' && x.st === '보완요청') ? '재보완요청' : m.to;
      x.done = EM.now().slice(0, 10);
      if (x.fromPass) saveInbox(x);
      sheet.classList.remove('show');
      render(); EM.toast(m.ok + ' 처리했습니다.');
    };
  }
  menu.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a || !cur) return;
    e.stopPropagation(); menu.hidden = true;
    askDlg(a.dataset.act, cur);
  });
  dlg.addEventListener('input', function (e) {
    if (e.target.id === 'pxDlgTa') dlg.querySelector('[data-dok]').disabled = !e.target.value.trim();
  });
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-dx]') || e.target.closest('[data-dno]')) { dlg.classList.remove('show'); return; }
    var ok = e.target.closest('[data-dok]');
    if (ok && !ok.disabled) { dlg.classList.remove('show'); if (dlg.onsubmit) dlg.onsubmit(); }
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
