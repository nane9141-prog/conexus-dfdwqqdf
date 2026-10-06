/* 전자주주총회 관리 · 로그인코드 관리
   해외 주주·비주주의 로그인코드 발급 현황과 주주확인(명부 대조·매핑)을 함께 처리한다.
   흐름: 로그인코드 발급 → 주주가 로그인 후 주주확인 신청 → 담당자가 명부와 대조해 투표권자 연결(자동 매칭 없음).
   표는 참석자 관리와 같은 규칙 — 전체 데이터 기준 정렬(cxsort)·필터(cxFilter/cxValues), 번호 3개 페이지네이션. */
(function () {
  var root = document.getElementById('lcRoot');
  if (!root || !window.CX || !CX.roster) return;

  /* ---------- 공통 ---------- */
  function cm(n) { return Math.round(n || 0).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function p2(n) { return ('0' + n).slice(-2); }
  function dt(m, d, h, mi) { return '2026.' + p2(m) + '.' + p2(d) + ' ' + p2(h) + ':' + p2(mi); }
  function now() { var d = new Date(); return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function day(s) { return s ? s.slice(0, 10) : '-'; }
  function toast(m) { if (window.cxToast) cxToast(m); }
  var ME = '박지용', STAFF = ['박지용', '김서연', '이도현'];
  /* 표결 시작 여부 — 시작되면 매핑 변경을 막는다. 데모는 개회 전(CX.meeting.votingStarted 로 켤 수 있음) */
  var VOTING_STARTED = !!(CX.meeting && CX.meeting.votingStarted);

  var TONE = { '로그인코드 발급': 'blue', '로그인코드 회수': 'gray off', '주주확인 대기': 'purple', '주주확인 보완': 'orange', '주주확인 재보완': 'orange', '주주확인 반려': 'rose', '주주확인 완료': 'blue' };
  var OPEN = { '주주확인 대기': 1, '주주확인 보완': 1, '주주확인 재보완': 1 };   /* 담당자 검토 대상 */
  function badge(s) { return '<span class="lc-b ' + (TONE[s] || 'gray') + '"><i></i>' + s + '</span>'; }

  /* 투표권자 — 통합 그룹이면 대표 투표권자명, 아니면 주주명 */
  var GROUP_OF = {};
  (CX.rosterGroups || []).forEach(function (g) { g.members.forEach(function (m) { GROUP_OF[m.i] = g; }); });
  function voterOf(r) { return GROUP_OF[r.i] ? GROUP_OF[r.i].voter : r.nm; }

  /* ---------- 데이터 ---------- */
  var seq = 301;
  function newCode() { return 'EG-2026' + ('000' + (seq++)).slice(-4); }
  var CC = { US: '1', CA: '1', JP: '81', GB: '44', DE: '49', CN: '86', NL: '31', FR: '33', SG: '65', HK: '852', AU: '61', NO: '47', AE: '971' };
  function phone(ct, i) { return '+' + (CC[ct] || '1') + '-' + (20 + i % 70) + '-' + (1000 + (i * 37) % 9000) + '-' + (1000 + (i * 53) % 9000); }
  var TRUST = ['Citibank Korea', 'HSBC Korea', 'Standard Chartered Korea', 'Deutsche Bank Seoul'];
  var MGR = ['Sarah Chen', 'David Miller', 'Emma Wilson', 'Kenji Sato', 'Laura Schmidt', 'Tom Baker'];
  var DEPT = ['Stewardship', 'Investment Operations', 'Proxy Voting', '-'];
  var POS = ['Director', 'Vice President', 'Manager', '-'];
  var L = [], uid = 0;

  /* 이력 — 시간순으로 쌓은 뒤 최신이 위로 */
  function histOf(x) {
    var h = [];
    function at(k) { return dt(8, 21 + k * 2, 9 + (x.k * 3 + k) % 9, (x.k * 13 + k * 7) % 60); }
    if (x.route === '주주 신청') { h.push({ at: x.codeAt, t: '로그인코드 신청 접수', by: '시스템' }); h.push({ at: x.codeAt, t: '로그인코드 발급 · 이메일 발송', by: '시스템' }); }
    else h.push({ at: x.mailAt, t: '로그인코드 발급 · 이메일 발송', by: STAFF[x.k % 3] });
    if (x.cfAt) {
      h.push({ at: x.cfAt, t: '주주확인 신청 접수', by: '시스템' });
      for (var s = 1; s <= x.supp; s++) {
        h.push({ at: at(s), t: '서류 보완 요청 (' + s + '/2)', by: STAFF[(x.k + s) % 3] });
        if (s < x.supp || x.st !== '주주확인 보완') h.push({ at: at(s), t: '서류 재제출', by: '시스템' });
      }
      if (x.st === '주주확인 반려') h.push({ at: at(3), t: '주주확인 반려', by: STAFF[x.k % 3] });
      if (x.voters.length) h.push({ at: x.mapAt, t: '주주 매핑 완료 · 투표권자 ' + voterOf(x.voters[0]) + ' 연결', by: x.mapBy });
    }
    if (x.st === '로그인코드 회수') h.push({ at: dt(8, 26, 11, 5 + x.k % 50), t: '로그인코드 회수 · 로그인 차단', by: STAFF[x.k % 3] });
    return h.reverse();
  }
  function mk(o) {
    var x = { k: uid++, ns: false, voters: [], files: [], accts: [], supp: 0, reAt: '', cfAt: '', rej: '', mapAt: '', mapBy: '' };
    for (var p in o) x[p] = o[p];
    x.hist = histOf(x);
    L.push(x); return x;
  }
  /* 해외 법인 — 명부에 해외 기관이 없어 신고 정보만 존재(매핑 시 담당자가 명부에서 직접 선택) */
  var CORP = [['BlackRock Fund Advisors', 'US'], ['Vanguard Total International Stock Index Fund', 'US'], ['Norges Bank', 'NO'], ['Government of Singapore', 'SG'], ['Abu Dhabi Investment Authority', 'AE'], ['Fidelity International Discovery Fund', 'US'], ['JPMorgan Emerging Markets Equity Fund', 'US'], ['Schroder Asian Equity Yield Fund', 'GB'], ['Nomura Asia Pacific Fund', 'JP'], ['Allianz Global Investors Fund', 'DE'], ['California Public Employees Retirement System', 'US'], ['APG Asset Management', 'NL']];
  var CST = ['주주확인 대기', '주주확인 보완', '주주확인 재보완', '주주확인 반려', '로그인코드 발급', '로그인코드 회수', '주주확인 대기', '주주확인 재보완', '주주확인 보완', '로그인코드 발급', '주주확인 대기', '주주확인 반려'];
  CORP.forEach(function (c, j) {
    var st = CST[j], admin = (j % 4 === 1) || st === '로그인코드 회수', hasCf = !(st === '로그인코드 발급' || st === '로그인코드 회수');
    var slug = c[0].split(' ')[0].toLowerCase();
    var decl = 1200000 + j * 347000, multi = j % 3 !== 1;
    var ac = '0071' + ('000000000000' + (84512 + j * 7919)).slice(-12);
    var accts = multi ? [{ ac: ac + '01', ag: '0072' + ac.slice(-10), sh: Math.round(decl * .6) }, { ac: ac + '02', ag: '0072' + ac.slice(-9) + '9', sh: decl - Math.round(decl * .6) }] : [{ ac: ac + '01', ag: '0072' + ac.slice(-10), sh: decl }];
    var codeAt = admin ? '' : dt(8, 2 + j, 9 + j % 8, (j * 11) % 60);
    mk({
      corp: true, name: c[0], ct: c[1], route: admin ? '관리자 등록' : '주주 신청', st: st,
      codeAt: codeAt, mailAt: codeAt || dt(8, 3 + j, 10, (j * 17) % 60), code: newCode(),
      trust: TRUST[j % 4], mgr: MGR[j % 6], dept: DEPT[j % 4], pos: POS[j % 4],
      phone: phone(c[1], j), email: 'ir@' + slug + '.com',
      cfAt: hasCf ? dt(8, 18 + j % 3, 9 + j % 7, (j * 13) % 60) : '',
      multi: multi, idType: j % 2 ? 'IRC' : 'LEI', idNo: j % 2 ? 'IRC-' + (40310 + j * 211) : '5493001KJTII' + ('00000000' + (j * 7331)).slice(-8),
      agent: 'KSD-' + (10000 + j * 137), decl: decl, accts: hasCf ? accts : [],
      supp: st === '주주확인 보완' ? 1 : st === '주주확인 재보완' ? 1 + j % 2 : st === '주주확인 반려' ? 2 : 0,
      reAt: st === '주주확인 재보완' ? dt(8, 27, 10 + j % 6, (j * 7) % 60) : '',
      files: hasCf && j % 5 !== 4 ? [{ n: '법인등기부등본_' + slug + '.pdf', kb: 180 + j * 23 }, { n: '위임장_' + slug + '.pdf', kb: 42 + j * 5 }] : [],
      rej: st === '주주확인 반려' ? '제출한 법인 식별번호가 주주명부와 일치하지 않습니다. 보완 요청 2회가 모두 소진되어 반려 처리합니다.' : ''
    });
  });
  /* 해외 개인 — 명부의 외국인 개인 주주가 로그인코드를 신청 */
  var PST = ['주주확인 완료', '주주확인 완료', '주주확인 대기', '주주확인 완료', '로그인코드 발급', '주주확인 보완', '주주확인 완료', '주주확인 재보완', '주주확인 완료', '로그인코드 회수', '주주확인 완료', '주주확인 반려', '주주확인 완료', '주주확인 대기'];
  CX.roster.filter(function (r) { return r.fr === '외국인'; }).slice(0, 70).forEach(function (r, i) {
    var st = PST[i % 14], admin = (i % 5 === 3) || st === '로그인코드 회수', hasCf = !(st === '로그인코드 발급' || st === '로그인코드 회수');
    var multi = i % 4 === 1, codeAt = admin ? '' : dt(8, 1 + i % 17, 9 + i % 9, (i * 7) % 60);
    var a = Math.round(r.sh * .55), accts = multi ? [{ ac: r.ac, sh: a }, { ac: r.ac.slice(0, -4) + '0002', sh: r.sh - a }] : [{ ac: r.ac, sh: r.sh }];
    var done = st === '주주확인 완료';
    mk({
      corp: false, name: r.nm, ct: r.ct, route: admin ? '관리자 등록' : '주주 신청', st: st,
      codeAt: codeAt, mailAt: codeAt || dt(8, 2 + i % 17, 10, (i * 17) % 60), code: newCode(),
      phone: phone(r.ct, i), email: r.nm.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@' + ['gmail.com', 'outlook.com', 'yahoo.co.jp'][i % 3],
      cfAt: hasCf ? dt(8, 19 + i % 2, 9 + i % 8, (i * 13) % 60) : '', multi: multi, idType: i % 3 ? '여권번호' : '외국인등록번호',
      idNo: i % 3 ? 'M' + (String(r.id).replace(/\D/g, '') + '48210937').slice(0, 8) : '9' + (i % 9) + '0' + (1 + i % 9) + '15-5******',
      decl: done ? r.sh : Math.round(r.sh * (i % 5 === 2 ? .97 : 1)), accts: hasCf ? accts : [],
      supp: st === '주주확인 보완' ? 1 : st === '주주확인 재보완' ? 1 + i % 2 : st === '주주확인 반려' ? 2 : (done && i % 4 === 0 ? 1 : 0),
      reAt: st === '주주확인 재보완' ? dt(8, 27, 10 + i % 6, (i * 7) % 60) : '',
      files: hasCf && i % 7 !== 5 ? [{ n: 'passport_' + r.nm.split(' ')[0].toLowerCase() + '.pdf', kb: 210 + i % 300 }, { n: '주주확인서.pdf', kb: 38 + i % 80 }].slice(0, 1 + i % 2) : [],
      voters: done ? [r] : [], mapAt: done ? dt(8, 28, 9 + i % 8, (i * 11) % 60) : '', mapBy: done ? STAFF[i % 3] : '',
      rej: st === '주주확인 반려' ? '제출한 여권 정보와 주주명부의 성명이 일치하지 않습니다.' : ''
    });
  });
  /* 비주주 — 담당자가 직접 발급(의결권 없음) */
  var NS = [['김하늘', '삼일회계법인', '회계사', '감사인', '외부감사인 참관'], ['이준호', '법무법인 세종', '변호사', '변호사', '법률 자문 · 의사진행 검토'], ['박민지', '한국예탁결제원', '과장', '기타', ''], ['정우성', '연합뉴스', '기자', '언론/기자', '취재'], ['최서윤', '카카오뱅크', 'IR팀 매니저', '임직원', '사내 참관'], ['한지훈', '대신경제연구소', '연구원', '기타', '의결권 자문사 참관'], ['윤가람', '카카오뱅크', '경영지원팀 대리', '임직원', '현장 지원']];
  var NSM = ['sky.kim@samil.com', 'jh.lee@shinkim.com', 'mj.park@ksd.or.kr', 'ws.jung@yna.co.kr', 'sy.choi@kakaobank.com', 'jh.han@daishin.com', 'gr.yoon@kakaobank.com'];
  NS.forEach(function (n, i) {
    mk({ ns: true, name: n[0], org: n[1], pos: n[2], kind: n[3], memo: n[4], qna: i % 3 !== 2, route: '관리자 등록', st: i === 3 || i === 6 ? '로그인코드 회수' : '로그인코드 발급', codeAt: '', mailAt: dt(8, 20 + i % 6, 10 + i % 7, (i * 9) % 60), code: newCode(), phone: '010-' + (2000 + i * 731) + '-' + (4000 + i * 377), email: NSM[i] });
  });

  /* ---------- 표 ---------- */
  function shares(x) { return x.voters.length ? x.voters.reduce(function (a, r) { return a + r.sh; }, 0) : (x.cfAt ? x.decl : null); }
  var COLS = {
    sh: [['등록경로', 120, 'c'], ['상태', 129, 'c'], ['구분', 90, 'c'], ['이름', 240], ['연결된 투표권자', 0], ['주주번호', 210], ['보유주식수', 110, 'n'], ['코드 신청일', 110, 'c'], ['로그인코드', 140], ['확인 신청일', 110, 'c'], ['주주확인', 78, 'c'], ['', 44, 'c']],
    ns: [['등록경로', 120, 'c'], ['상태', 129, 'c'], ['구분', 90, 'c'], ['이름', 160], ['소속', 140], ['전화번호', 150], ['이메일', 0], ['코드 발급일', 110, 'c'], ['로그인코드', 140], ['확인 신청일', 110, 'c'], ['주주확인', 78, 'c'], ['', 44, 'c']]
  };
  var LEFT = { sh: 4, ns: 4 };   /* 왼쪽 고정 컬럼 수(이름까지) */
  function val(x, c) {
    switch (c) {
      case '상태': return x.st;
      case '등록경로': return x.route;
      case '구분': return x.ns ? x.kind : x.corp ? '기관' : '개인';
      case '유형': return x.ns ? x.kind : (x.cfAt ? (x.multi ? '복수' : '단일') : '-');
      case '이름': return x.name;
      case '연결된 투표권자': return x.voters.length ? voterOf(x.voters[0]) + (x.voters.length > 1 ? ' 외 ' + (x.voters.length - 1) + '명' : '') : '-';
      case '주주번호': return x.cfAt ? x.idNo + ' (' + x.idType + ')' : '-';
      case '보유주식수': return shares(x);
      case '코드 신청일': return day(x.codeAt);
      case '로그인코드': return x.code;
      case '확인 신청일': return day(x.cfAt);
      case '소속': return x.org || '-';
      case '직급': return x.pos || '-';
      case '이메일': return x.email;
      case '휴대폰번호': case '전화번호': return x.phone;
      case '발급일': case '코드 발급일': return day(x.mailAt);
    }
    return '';
  }
  function txt(x, c) { var v = val(x, c); return c === '보유주식수' ? (v == null ? '-' : cm(v)) : String(v); }
  var GRAY = { '등록경로': 1, '구분': 1, '유형': 1, '코드 신청일': 1, '확인 신청일': 1, '발급일': 1, '코드 발급일': 1 };
  function cell(x, c) {
    if (c === '상태') return badge(x.st);
    if (c === '로그인코드') return '<span class="lc-code' + (x.st === '로그인코드 회수' ? ' off' : '') + '">' + esc(x.code) + '</span>';
    if (c === '주주확인') {
      if (x.st === '주주확인 완료') return '<button type="button" class="lc-act fill" data-a="map">매핑변경</button>';
      return '<button type="button" class="lc-act" data-a="map"' + (OPEN[x.st] ? '' : ' disabled') + '>주주매핑</button>';
    }
    if (c === '') return '<button type="button" class="lc-more" data-more aria-label="더보기"><i class="ph ph-dots-three"></i></button>';
    var t = txt(x, c);
    /* 확인 전 신고값(주주번호·보유주식)은 회색, 매핑 후 명부값은 검정 */
    var mute = GRAY[c] || t === '-' || ((c === '주주번호' || c === '보유주식수') && !x.voters.length);
    return mute ? '<span class="mu">' + esc(t) + '</span>' : esc(t);
  }

  /* ---------- 화면 ---------- */
  root.innerHTML =
    '<div class="lc">' +
    '<div class="lc-hd"><h2>로그인코드 관리</h2><p>참석자의 주주 확인 및 입장 코드 발급 상태를 관리합니다.</p></div>' +
    '<div class="lc-bar">' +
      '<div class="lc-seg" id="lcTabs"><button type="button" class="on" data-t="sh">주주</button><button type="button" data-t="ns">비주주</button></div>' +
      '<select class="lc-sel" id="lcQf" aria-label="검색 기준"></select>' +
      '<label class="lc-search"><i class="ph ph-magnifying-glass"></i><input id="lcQ" placeholder="검색어를 입력하세요"></label>' +
      '<div class="lc-chips" id="lcChips"></div>' +
      '<button type="button" class="btn" id="lcIssue" style="width:108px">로그인코드 발급</button>' +
      '<span data-cx-tools></span>' +
    '</div>' +
    '<div class="lc-wrap"><div class="lc-scroll"><table class="lctbl" id="lcTbl"><colgroup id="lcCols"></colgroup><thead id="lcHead"></thead><tbody id="lcBody"></tbody></table></div>' +
      '<div class="lc-foot"><span class="cnt" id="lcCount"></span><span class="lc-pg">페이지당 <select id="lcSize"><option>20</option><option>50</option><option>100</option></select><span class="lc-pages" id="lcPager"></span></span></div>' +
    '</div></div>' +
    '<div class="sheet-ov lc-sheet" id="lcSheet"><div class="sheet"><button class="sheet-x" data-sx aria-label="닫기"><i class="ph ph-x" style="font-size:16px"></i></button>' +
      '<div class="sheet-hd"><div class="sheet-t">상세 정보</div></div><div class="sheet-body" id="lcShBody"></div>' +
      '<div class="lc-shft"><div class="sheet-ft" id="lcShFt"></div><div class="lc-mod" id="lcShMod"></div></div></div></div>' +
    '<div class="lc-ov" id="lcAlert"><div class="lc-al" role="alertdialog" aria-modal="true"><div class="ah"><div class="am"><i class="ph"></i></div><div style="width:100%"><div class="at"></div><div class="ad"></div></div></div><div class="af"></div></div></div>' +
    '<div class="lc-ov" id="lcAsk"><div class="lc-dl" role="dialog" aria-modal="true"><button class="lc-x" data-x aria-label="닫기"><i class="ph ph-x"></i></button><div class="dh"><div class="lc-dt"></div></div><div class="dc"><div class="lc-dd"></div><div class="lb"></div><textarea></textarea><div class="dn"></div></div><div class="df"><button class="btn" data-x>취소</button><button class="btn dark" data-ok disabled></button></div></div></div>' +
    '<div class="lc-ov" id="lcPickDlg"><div class="lc-dl w480" role="dialog" aria-modal="true"><button class="lc-x" data-x aria-label="닫기"><i class="ph ph-x"></i></button><div class="dh"><div class="lc-dt">로그인코드 발급</div></div><div class="dc"><div class="lc-dd">발급 대상을 선택해 주세요.</div><div id="lcPickForm"></div></div><div class="df"><button class="btn" data-x>취소</button><button class="btn dark" data-ok>발급정보 입력</button></div></div></div>' +
    '<div class="lc-ov" id="lcIssueDlg"><div class="lc-map lc-iss" role="dialog" aria-modal="true"><button class="lc-x" data-x aria-label="닫기"><i class="ph ph-x"></i></button>' +
      '<div class="mh"><div class="lc-dt">로그인코드 발급</div><div class="lc-dd">발급 대상을 선택해 주세요.</div></div>' +
      '<div class="mc"><div class="ml" id="lcIssL"></div><div class="mr" id="lcIssR"></div></div>' +
      '<div class="mf"><button class="btn" data-back style="width:72px">이전 단계</button><span class="lc-iss-d">참석자 등록 시, 입력하신 이메일로 접속 아이디와 비밀번호가 자동 발송됩니다.</span><button class="btn" data-x>취소</button><button class="btn dark" data-ok disabled style="width:108px">로그인코드 발급</button></div></div></div>' +
    '<div class="lc-ov" id="lcMap"><div class="lc-map" role="dialog" aria-modal="true"><button class="lc-x" data-x aria-label="닫기"><i class="ph ph-x"></i></button>' +
      '<div class="mh"><div class="lc-dt">주주 매핑</div><div class="lc-dd">주주가 제출한 정보를 주주명부와 대조해 투표권자를 연결합니다. 연결하면 주주확인이 완료되고 주총 참여 권한이 부여됩니다.</div></div>' +
      '<div class="mc"><div class="ml" id="lcMapL"></div><div class="mr"><div class="lc-sh">주주명부 목록</div>' +
        '<div class="mbar"><select class="lc-sel" id="lcMapF" aria-label="검색 기준"><option value="vt">투표권자</option><option value="nm">주주명</option><option value="id">주주번호</option><option value="ac">실질계좌번호</option></select><label class="lc-search"><i class="ph ph-magnifying-glass"></i><input id="lcMapQ" placeholder="검색어를 입력하세요"></label></div>' +
        '<div class="lc-ml" id="lcMapList"></div></div></div>' +
      '<div class="mf"><button class="btn" data-x>취소</button><button class="btn dark" id="lcMapOk" disabled>주주 매핑</button></div></div></div>' +
    '<div class="lc-ov" id="lcConfirm"><div class="lc-dl w480" role="dialog" aria-modal="true"><button class="lc-x" data-x aria-label="닫기"><i class="ph ph-x"></i></button><div class="dh"><div class="lc-dt" id="lcCfT">주주 매핑 확인</div></div><div class="dc"><div id="lcCfBody"></div><div class="lc-cfacct" id="lcCfAcct"></div><div class="lc-dd">승인하면 투표권자에게 주총 참여 권한이 부여되며, 표결 시작 전까지 매핑 변경만 가능합니다.</div></div><div class="df"><button class="btn" data-x>취소</button><button class="btn dark" data-ok id="lcCfOk">승인하기</button></div></div></div>';

  var body = document.getElementById('lcBody'), tbl = document.getElementById('lcTbl');
  var cur = 'sh', chip = 'all', page = 1, pageSize = 20, lastTotal = 0, sortSt = null, filtPred = null, shX = null;
  var QF = { sh: [['vt', '투표권자'], ['nm', '주주명'], ['id', '주주번호'], ['ac', '실질계좌번호']], ns: [['all', '전체'], ['이름', '이름'], ['소속', '소속'], ['이메일', '이메일'], ['로그인코드', '로그인코드']] };
  var CHIPS = { sh: [['all', '전체'], ['로그인코드 발급', '코드 발급'], ['로그인코드 회수', '코드 회수'], ['주주확인 대기', '확인 대기'], ['주주확인 보완', '확인 보완'], ['주주확인 재보완', '확인 재보완'], ['주주확인 반려', '확인 반려'], ['주주확인 완료', '확인 완료']]};
  CHIPS.ns = CHIPS.sh;   /* 비주주 탭도 주주 탭과 같은 상태 칩 */
  var qf = document.getElementById('lcQf'), q = document.getElementById('lcQ');

  function list() { return L.filter(function (x) { return cur === 'ns' ? x.ns : !x.ns; }); }
  function rows() {
    var r = list(), cs = COLS[cur];
    if (chip !== 'all') r = r.filter(function (x) { return x.st === chip; });
    var s = q.value.trim().toLowerCase();
    if (s) {
      /* 주주 탭은 명부 기준(신청 정보 + 연결된 투표권자 계좌), 비주주 탭은 컬럼 기준 */
      var SK = { vt: function (x) { return x.voters.map(voterOf); }, nm: function (x) { return [x.name].concat(x.voters.map(function (v) { return v.nm; })); },
        id: function (x) { return [x.idNo || ''].concat(x.voters.map(function (v) { return v.id; })); }, ac: function (x) { return x.accts.map(function (a) { return a.ac; }).concat(x.voters.map(function (v) { return v.ac; })); } };
      var F = SK[qf.value] ? null : qf.value === 'all' ? cs.map(function (c) { return c[0]; }).filter(Boolean) : [qf.value];
      r = r.filter(function (x) { return F ? F.some(function (c) { return txt(x, c).toLowerCase().indexOf(s) >= 0; }) : SK[qf.value](x).some(function (v) { return String(v).toLowerCase().indexOf(s) >= 0; }); });
    }
    if (filtPred) r = r.filter(function (x) { return filtPred(function (i) { return txt(x, cs[i][0]); }); });
    if (sortSt && sortSt.dir) {
      var c = cs[sortSt.idx][0], d = (sortSt.dir === 'desc' || sortSt.dir < 0) ? -1 : 1;
      r = r.slice().sort(function (a, b) {
        var va = val(a, c), vb = val(b, c);
        if (c === '보유주식수') return ((va == null ? -1 : va) - (vb == null ? -1 : vb)) * d;
        return String(va).localeCompare(String(vb), 'ko') * d;
      });
    }
    return r;
  }
  function stick(i) {
    var cs = COLS[cur], n = LEFT[cur], last = cs.length - 1;
    if (i < n) { var left = 0; for (var j = 0; j < i; j++) left += cs[j][1]; return ' data-st="' + (i === n - 1 ? 'le' : 'l') + '" style="left:' + left + 'px"'; }
    if (cur === 'sh' && i === last - 1) return ' data-st="rs" style="right:' + cs[last][1] + 'px"';
    if (i === last) return ' data-st="r" style="right:0"';
    return '';
  }
  function cls(c) { var a = c[2] ? [c[2]] : []; if (c[0] === '이름') a.push('b'); return a.length ? ' class="' + a.join(' ') + '"' : ''; }
  function head() {
    var cs = COLS[cur], min = 0;
    cs.forEach(function (c) { min += c[1] || 200; });
    tbl.style.minWidth = min + 'px';
    document.getElementById('lcCols').innerHTML = cs.map(function (c) { return c[1] ? '<col style="width:' + c[1] + 'px">' : '<col>'; }).join('');
    document.getElementById('lcHead').innerHTML = '<tr>' + cs.map(function (c, i) { return '<th' + stick(i) + (c[2] ? ' class="' + c[2] + '"' : '') + '>' + c[0] + '</th>'; }).join('') + '</tr>';
    qf.innerHTML = QF[cur].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
  }
  function chips() {
    var base = list();
    document.getElementById('lcChips').innerHTML = CHIPS[cur].map(function (c) {
      var n = c[0] === 'all' ? base.length : base.filter(function (x) { return x.st === c[0]; }).length;
      return '<button type="button" class="lc-chip' + (c[0] === chip ? ' on' : '') + '" data-chip="' + c[0] + '">' + c[1] + '<span class="c">' + n + '</span></button>';
    }).join('');
  }
  function render() {
    chips();
    var r = rows(), cs = COLS[cur];
    lastTotal = r.length;
    var pages = Math.max(1, Math.ceil(r.length / pageSize)); if (page > pages) page = pages;
    var pg = r.slice((page - 1) * pageSize, page * pageSize);
    body.innerHTML = pg.length ? pg.map(function (x) {
      return '<tr data-k="' + x.k + '">' + cs.map(function (c, j) { return '<td' + stick(j) + cls(c) + '>' + cell(x, c[0]) + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + cs.length + '" class="lc-empty">검색 결과가 없습니다.</td></tr>';
    var sum = r.reduce(function (a, x) { return a + (shares(x) || 0); }, 0);
    document.getElementById('lcCount').textContent = '총 ' + r.length + '명' + (cur === 'sh' ? ' · ' + cm(sum) + '주' : '');
    pager(pages);
    if (shX) paintSheet();
  }
  function pager(pages) {
    var dP = page <= 1 ? ' dis' : '', dN = page >= pages ? ' dis' : '';
    var h = '<span class="pp' + dP + '" data-pg="first" aria-label="처음"><i class="ph ph-caret-double-left"></i></span><span class="pp' + dP + '" data-pg="prev" aria-label="이전"><i class="ph ph-caret-left"></i></span>';
    var e = Math.min(pages, Math.max(1, page - 1) + 2), s = Math.max(1, e - 2);
    for (var p = s; p <= e; p++) h += '<span class="pp' + (p === page ? ' cur' : '') + '" data-pg="' + p + '">' + p + '</span>';
    h += '<span class="pp' + dN + '" data-pg="next" aria-label="다음"><i class="ph ph-caret-right"></i></span><span class="pp' + dN + '" data-pg="last" aria-label="마지막"><i class="ph ph-caret-double-right"></i></span><span class="tot">' + page + ' / ' + pages + '</span>';
    document.getElementById('lcPager').innerHTML = h;
  }
  function byK(k) { for (var i = 0; i < L.length; i++) if (L[i].k === +k) return L[i]; return null; }
  function log(x, t) { x.hist.unshift({ at: now(), t: t, by: ME }); }
  function done(m) { render(); toast(m); }

  /* 탭 · 검색 · 칩 · 페이지 */
  document.getElementById('lcTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b || b.dataset.t === cur) return;
    cur = b.dataset.t; chip = 'all'; page = 1; sortSt = null; filtPred = null; q.value = '';
    [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
    if (tbl.__cx) { tbl.__cx.filters = {}; tbl.__cx.draft = {}; }
    head(); render();
  });
  q.addEventListener('input', function () { page = 1; render(); });
  qf.addEventListener('change', function () { page = 1; render(); });
  document.getElementById('lcChips').addEventListener('click', function (e) { var b = e.target.closest('[data-chip]'); if (!b) return; chip = b.dataset.chip; page = 1; render(); });
  document.getElementById('lcSize').addEventListener('change', function () { pageSize = parseInt(this.value, 10) || 20; page = 1; render(); });
  document.getElementById('lcPager').addEventListener('click', function (e) {
    var b = e.target.closest('.pp'); if (!b || b.classList.contains('dis')) return;
    var v = b.dataset.pg, pages = Math.max(1, Math.ceil(lastTotal / pageSize));
    page = v === 'first' ? 1 : v === 'prev' ? Math.max(1, page - 1) : v === 'next' ? Math.min(pages, page + 1) : v === 'last' ? pages : (parseInt(v, 10) || 1);
    render();
  });
  /* 전체 데이터 기준 정렬 · 필터(conexus 표 규칙) */
  tbl.addEventListener('cxsort', function (e) { e.preventDefault(); sortSt = { idx: e.detail.idx, dir: e.detail.dir }; page = 1; render(); });
  tbl.cxFilter = function (pred) { filtPred = pred; page = 1; render(); };
  tbl.cxValues = function (i) { var c = COLS[cur][i][0]; return list().map(function (x) { return txt(x, c); }); };

  /* ---------- 더보기 메뉴 ---------- */
  var menu = document.createElement('div'); menu.className = 'lc-menu'; document.body.appendChild(menu);
  var menuX = null, menuBtn = null, cool = {};
  function hideMenu() { menu.classList.remove('on'); if (menuBtn) menuBtn.classList.remove('on'); menuBtn = null; }
  /* 비활성 항목은 메뉴에 그리지 않는다 */
  function it(a, ic, t, dis, c2) { if (dis) return ''; return '<button type="button" data-a="' + a + '"' + (c2 ? ' class="' + c2 + '"' : '') + '><i class="ph ' + ic + '"></i>' + t + '</button>'; }
  function openMenu(x, btn) {
    var admin = x.route === '관리자 등록', rv = x.st === '로그인코드 회수', cd = cool[x.k] || {}, g = [];
    if (OPEN[x.st]) g.push(it('supp', 'ph-paper-plane-tilt', '보완 요청', x.supp >= 2) + it('rej', 'ph-prohibit', '주주확인 반려'));
    g.push(it('pw', 'ph-paper-plane-tilt', '임시비밀번호 발송', rv || cd.pw) + it('re', 'ph-arrow-clockwise', '코드 재발급', !admin || cd.re) + it('rv', 'ph-backspace', '코드 회수', !admin || rv));
    if (admin) g.push(it('del', 'ph-trash', '참석자 삭제', false, 'danger'));
    g = g.filter(Boolean); if (!g.length) return;   /* 쓸 수 있는 항목이 없으면 열지 않는다 */
    menu.innerHTML = g.map(function (s) { return '<div class="g">' + s + '</div>'; }).join('<div class="sep"></div>');
    menuX = x; menuBtn = btn; btn.classList.add('on'); menu.classList.add('on');
    var r = btn.getBoundingClientRect();
    menu.style.left = Math.max(8, r.right - menu.offsetWidth) + 'px';
    menu.style.top = (r.bottom + 4 + menu.offsetHeight > window.innerHeight ? r.top - 4 - menu.offsetHeight : r.bottom + 4) + 'px';
  }
  menu.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b || b.disabled) return; var x = menuX; hideMenu(); act(b.dataset.a, x); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.lc-menu') && !e.target.closest('.lc-more')) hideMenu(); });
  window.addEventListener('scroll', hideMenu, true);

  body.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-k]'); if (!tr) return;
    var x = byK(tr.dataset.k), m = e.target.closest('.lc-more');
    if (m) { if (menuBtn === m) hideMenu(); else { hideMenu(); openMenu(x, m); } return; }
    var a = e.target.closest('[data-a]');
    if (a) { if (!a.disabled) act(a.dataset.a, x); return; }
    openSheet(x);
  });

  /* ---------- 알림 · 사유 입력 ---------- */
  var alertEl = document.getElementById('lcAlert'), alertCb = null;
  var ICON = { check: ['ph-check-circle', ''], trash: ['ph-trash', 'red'], undo: ['ph-arrow-u-up-left', 'red'], warn: ['ph-warning-circle', 'red'] };
  function alertDlg(o, cb) {
    var ic = ICON[o.ic || 'check'], m = alertEl.querySelector('.am');
    m.className = 'am ' + ic[1]; m.querySelector('i').className = 'ph ' + ic[0];
    alertEl.querySelector('.at').textContent = o.t; alertEl.querySelector('.ad').textContent = o.d || '';
    alertEl.querySelector('.af').innerHTML = (o.cancel ? '<button class="btn" data-x>취소</button>' : '') + '<button class="btn ' + (o.danger ? 'danger' : 'dark') + '" data-ok>' + (o.ok || '확인') + '</button>';
    alertCb = cb || null; alertEl.classList.add('show');
  }
  alertEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-x]')) { alertEl.classList.remove('show'); return; }
    if (e.target.closest('[data-ok]')) { alertEl.classList.remove('show'); var f = alertCb; alertCb = null; if (f) f(); }
  });
  var askEl = document.getElementById('lcAsk'), askCb = null, askTa = askEl.querySelector('textarea'), askOk = askEl.querySelector('[data-ok]');
  function ask(o, cb) {
    askEl.querySelector('.lc-dt').textContent = o.t;
    var dd = askEl.querySelector('.lc-dd'); dd.textContent = o.d || ''; dd.style.display = o.d ? '' : 'none';
    askEl.querySelector('.lb').textContent = o.lb; askTa.value = ''; askTa.placeholder = o.ph;
    askEl.querySelector('.dn').textContent = o.note || '';
    askOk.textContent = o.ok; askOk.disabled = true; askCb = cb; askEl.classList.add('show'); setTimeout(function () { askTa.focus(); }, 30);
  }
  askTa.addEventListener('input', function () { askOk.disabled = !askTa.value.trim(); });
  askEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-x]')) { askEl.classList.remove('show'); return; }
    if (e.target.closest('[data-ok]') && !askOk.disabled) { askEl.classList.remove('show'); askCb(askTa.value.trim()); }
  });
  /* 임시비밀번호 · 재발급 — 1분 동안 비활성(남은 시간은 표시하지 않음) */
  function cooldown(x, key) {
    cool[x.k] = cool[x.k] || {}; cool[x.k][key] = 1;
    setTimeout(function () { delete cool[x.k][key]; if (shX === x) paintSheet(); }, 60000);
  }

  /* ---------- 동작 ---------- */
  function act(a, x) {
    if (a === 'map') return openMap(x);
    if (a === 'supp') return ask({ t: '보완 요청', lb: '보완 요청 내용', ph: '주주에게 안내할 보완 내용을 입력해 주세요', note: '보완 요청 ' + (x.supp + 1) + '/2회 · 요청 내용은 주주 이메일로 안내됩니다.', ok: '요청' }, function () {
      x.supp++; x.st = '주주확인 보완'; log(x, '서류 보완 요청 (' + x.supp + '/2)'); done('서류 보완을 요청했습니다.');
    });
    if (a === 'rej') return ask({ t: '주주확인 반려', d: '반려하면 종결 처리되며 이후 상태를 변경할 수 없습니다.', lb: '반려 사유', ph: '반려 사유를 입력해 주세요. 주주에게 이메일로 안내됩니다.', ok: '반려하기' }, function (v) {
      x.st = '주주확인 반려'; x.rej = v; log(x, '주주확인 반려'); done('주주확인을 반려했습니다.');
    });
    if (a === 'pw') {
      cooldown(x, 'pw'); log(x, '임시비밀번호 발송'); render();
      return alertDlg({ ic: 'check', t: '임시비밀번호를 발송했습니다', d: x.email + '(으)로 임시비밀번호를 보냈습니다.' });
    }
    if (a === 're') {
      cooldown(x, 're'); var old = x.code; x.code = newCode(); x.mailAt = now();
      if (x.st === '로그인코드 회수') x.st = x.prev || '로그인코드 발급';
      log(x, '로그인코드 재발급 (' + old + ' 폐기)'); render();
      return alertDlg({ ic: 'check', t: '로그인코드를 재발급했습니다', d: '기존 코드는 폐기되었습니다.\n새 코드 ' + x.code + '를 ' + x.email + '(으)로 보냈습니다.' });
    }
    if (a === 'rv') {
      return alertDlg(x.st === '주주확인 완료'
        ? { ic: 'warn', t: '코드를 회수하시겠습니까?', d: '이미 주주확인이 완료된 주주입니다. 회수하면 총회에 입장할 수 없습니다.', cancel: 1, ok: '회수하기', danger: 1 }
        : { ic: 'undo', t: '로그인코드를 회수하시겠습니까?', d: '회수하면 ' + x.code + ' 코드로 로그인할 수 없습니다.', cancel: 1, ok: '회수', danger: 1 },
        function () { x.prev = x.st; x.st = '로그인코드 회수'; log(x, '로그인코드 회수 · 로그인 차단'); done('로그인코드를 회수했습니다.'); });
    }
    if (a === 'del') return alertDlg({ ic: 'trash', t: '참석자를 삭제하시겠습니까?', d: '로그인코드와 신청 내역이 모두 삭제되며 되돌릴 수 없습니다.', cancel: 1, ok: '삭제', danger: 1 }, function () {
      L.splice(L.indexOf(x), 1); closeSheet(); done(x.name + ' 참석자를 삭제했습니다.');
    });
  }

  /* ---------- 로그인코드 발급(관리자 등록) ---------- */
  var issueEl = document.getElementById('lcIssueDlg'), issueOk = issueEl.querySelector('[data-ok]');
  /* 필수는 표시 없음, 선택 입력만 라벨에 (선택) */
  function fld(id, lb, ph, req, extra) { return '<div class="lc-f"><label for="' + id + '">' + lb + (req ? '' : ' (선택)') + '</label><input class="lc-in" id="' + id + '" placeholder="' + ph + '"' + (extra || '') + '></div>'; }
  function fv(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  /* 좌: 발급정보 입력 · 우: 발급 대상(주주/비주주) → 주주는 주주 유형 + 주주명부에서 투표권자 선택, 비주주는 유형 카드 */
  var iss = null, issL = document.getElementById('lcIssL'), issR = document.getElementById('lcIssR');
  var NSK = ['임직원', '감사인', '변호사', '언론/기자', '외국인', '기타'];
  function tg(k, v, lb, on) { return '<button type="button" data-' + k + '="' + v + '"' + (on ? ' class="on"' : '') + '>' + lb + '</button>'; }
  function issNew(ns) { return { ns: ns, corp: true, kind: '', picked: [], q: '', f: 'vt', v: {} }; }
  /* 이미 이용자로 등록된 투표권자는 목록에서 제외 */
  function taken(r) { return L.some(function (x) { return x.voters.indexOf(r) >= 0; }); }
  function issPaint() {
    var v = iss.v, ns = iss.ns;
    function f(id, lb, ph, req, ex) { return fld(id, lb, ph, req, ex).replace('placeholder=', 'value="' + esc(v[id] || '') + '" placeholder='); }
    /* 법인: 법인(기관)명·담당자명·부서·직급 / 개인: 이름 / 비주주: 이름·소속·직급·질의권 — 공통으로 휴대폰번호·이메일·메모 */
    var corp = !ns && iss.corp, dep = ns ? '소속' : '부서';
    var row2 = '<div class="lc-row2">' + f('lciOrg', dep, dep) + f('lciPos', '직급', '직급') + '</div>';
    issL.innerHTML = '<div class="lc-sh">발급 정보 입력</div>' +
      (corp ? f('lciName', '법인(기관)명', '법인(기관)명', 1) + f('lciMgr', '담당자명', '담당자명', 1) + row2 : f('lciName', '이름', '이름', 1) + (ns ? row2 : '')) +
      f('lciPhone', '휴대폰번호', ns ? '010-0000-0000' : '+1-212-000-0000', 1, ns ? ' inputmode="numeric" maxlength="13"' : '') + f('lciMail', '이메일', 'name@example.com', 1) +
      '<div class="lc-f"><label for="lciMemo">메모 (선택)</label><textarea class="lc-in" id="lciMemo" placeholder="참석 목적 등 메모를 입력해 주세요">' + esc(v.lciMemo || '') + '</textarea></div>' +
      (ns ? '<div class="lc-f"><label>질의권 부여</label><label class="lc-chk"><input type="checkbox" id="lciAsk"' + (v.lciAsk ? ' checked' : '') + '>질의 권한을 부여합니다.</label></div>' : '');
    issR.innerHTML = '<div class="lc-tgrow"><div class="lc-tgw"><div class="lc-sh">발급대상</div><div class="lc-tg">' + tg('tgt', 'sh', '주주', !ns) + tg('tgt', 'ns', '비주주', ns) + '</div></div>' +
      (ns ? '' : '<div class="lc-tgw"><div class="lc-sh">주주 유형</div><div class="lc-tg">' + tg('corp', '1', '기관', iss.corp) + tg('corp', '', '개인', !iss.corp) + '</div></div>') + '</div>' +
      (ns ? '<div class="lc-f"><label>유형 선택</label><div class="lc-tg lc-kgrid">' + NSK.map(function (k) { return tg('kind', k, k, iss.kind === k); }).join('') + '</div></div>'
        : '<div class="lc-iss-roster"><div class="lc-sh"><span>주주명부 목록</span><span class="lc-iss-sum" id="lcIssSum"></span></div>' +
          '<div class="mbar"><select class="lc-sel" id="lcIssF" aria-label="검색 기준">' + [['vt', '투표권자'], ['nm', '주주명'], ['id', '주주번호'], ['ac', '실질계좌번호']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === iss.f ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          '<label class="lc-search"><i class="ph ph-magnifying-glass"></i><input id="lcIssQ" placeholder="검색어를 입력하세요" value="' + esc(iss.q) + '"></label></div><div class="lc-ml" id="lcIssList"></div></div>');
    if (!ns) issList();
    issCheck();
  }
  function issRows() {
    var s = iss.q.trim().toLowerCase(), k = iss.f;
    /* 검색 전에는 외국인 주주부터 — 본인인증이 안 되는 해외 주주가 발급 대상 */
    var res = CX.roster.filter(function (r) { return !taken(r) && (s ? String(k === 'vt' ? voterOf(r) : r[k]).toLowerCase().indexOf(s) >= 0 : r.fr === '외국인'); }).slice(0, 60);
    iss.picked.forEach(function (r) { if (res.indexOf(r) < 0) res.unshift(r); });
    return res;
  }
  function issList() {
    var res = issRows(), all = res.length && res.every(function (r) { return iss.picked.indexOf(r) >= 0; });
    document.getElementById('lcIssList').innerHTML = '<div class="lc-mrow hd"><span><input type="checkbox" data-all' + (all ? ' checked' : '') + ' aria-label="전체 선택"></span><span>투표권자명</span><span>주주명</span><span>주주번호</span><span class="n">보유주식</span><span style="text-align:center">통합내역</span></div>' +
      (res.length ? res.map(function (r) {
        var on = iss.picked.indexOf(r) >= 0, g = GROUP_OF[r.i];
        return '<div class="lc-mrow' + (on ? ' on' : '') + '" data-i="' + r.i + '" title="주주번호 ' + r.id + '&#10;실질계좌번호 ' + r.ac + '"><span><input type="checkbox"' + (on ? ' checked' : '') + ' aria-label="선택"></span><span class="vt">' + esc(voterOf(r)) + '</span><span class="mu">' + esc(r.nm) + '</span><span class="mu">' + r.id + '</span><span class="n">' + cm(r.sh) + '</span>' +
          '<span style="text-align:center">' + (g ? '<button type="button" class="mini" data-grp="' + g.id + '">보기</button>' : '<span class="mu">-</span>') + '</span></div>';
      }).join('') : '<div class="lc-mempty">검색 결과가 없습니다.</div>');
    var p = iss.picked;
    document.getElementById('lcIssSum').textContent = p.length ? '선택 ' + p.length + '건 · ' + cm(p.reduce(function (a, r) { return a + r.sh; }, 0)) + '주' : '';
  }
  function issCheck() {
    var v = iss.v;
    issueOk.disabled = !(v.lciName && (iss.ns || !iss.corp || v.lciMgr) && /.+@.+\..+/.test(v.lciMail || '') && v.lciPhone && (iss.ns ? iss.kind : iss.picked.length));
  }
  /* 첫 진입: 발급 대상(주주/비주주)과 유형을 고르는 작은 모달 */
  var pickEl = document.getElementById('lcPickDlg'), pickOk = pickEl.querySelector('[data-ok]'), pk = null;
  function rad(name, v, lb, on) { return '<label><input type="radio" name="' + name + '" value="' + v + '"' + (on ? ' checked' : '') + '>' + lb + '</label>'; }
  function pickPaint() {
    document.getElementById('lcPickForm').innerHTML = '<div class="lc-f"><label>발급 대상</label><div class="lc-rad">' + rad('lcpTgt', 'sh', '주주', !pk.ns) + rad('lcpTgt', 'ns', '비주주', pk.ns) + '</div></div>' +
      (pk.ns
        ? '<div class="lc-f"><label for="lcpKind">비주주 유형</label><select class="lc-sel" id="lcpKind" style="width:100%"><option value="" disabled' + (pk.kind ? '' : ' selected') + '>유형을 선택해 주세요</option>' + NSK.map(function (k) { return '<option' + (k === pk.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>'
        : '<div class="lc-f"><label>주주 유형</label><div class="lc-rad">' + rad('lcpCorp', '1', '기관', pk.corp) + rad('lcpCorp', '', '개인', !pk.corp) + '</div></div>');
    pickOk.disabled = pk.ns && !pk.kind;
  }
  document.getElementById('lcIssue').addEventListener('click', function () { iss = null; pk = { ns: cur === 'ns', corp: true, kind: '' }; pickPaint(); pickEl.classList.add('show'); });
  pickEl.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'lcpTgt') { pk.ns = t.value === 'ns'; pickPaint(); }
    else if (t.name === 'lcpCorp') pk.corp = !!t.value;
    else if (t.id === 'lcpKind') { pk.kind = t.value; pickOk.disabled = false; }
  });
  pickEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-x]')) { pickEl.classList.remove('show'); return; }
    if (!e.target.closest('[data-ok]') || pickOk.disabled) return;
    pickEl.classList.remove('show');
    var keep = iss && iss.ns === pk.ns ? iss : null; iss = issNew(pk.ns); iss.corp = pk.corp; iss.kind = pk.kind; if (keep) { iss.v = keep.v; iss.picked = keep.picked; } issPaint(); issueEl.classList.add('show');
  });
  issueEl.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'lcIssQ') { iss.q = t.value; issList(); return; }
    if (t.id === 'lciPhone' && iss.ns) { var d = t.value.replace(/\D/g, '').slice(0, 11); t.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7); }
    if (/^lci/.test(t.id)) { iss.v[t.id] = t.type === 'checkbox' ? t.checked : t.value.trim(); issCheck(); }
  });
  issueEl.addEventListener('change', function (e) {
    if (e.target.id === 'lcIssF') { iss.f = e.target.value; issList(); }
    else if (e.target.id === 'lciAsk') iss.v.lciAsk = e.target.checked;
  });
  issueEl.addEventListener('click', function (e) {
    var t = e.target, b;
    if (t.closest('[data-x]')) { issueEl.classList.remove('show'); return; }
    if (t.closest('[data-back]')) { issueEl.classList.remove('show'); pk = { ns: iss.ns, corp: iss.corp, kind: iss.kind }; pickPaint(); pickEl.classList.add('show'); return; }
    if ((b = t.closest('[data-tgt]'))) { if ((b.dataset.tgt === 'ns') !== iss.ns) { iss.ns = !iss.ns; issPaint(); } return; }
    if ((b = t.closest('[data-corp]'))) { iss.corp = !!b.dataset.corp; issPaint(); return; }
    if ((b = t.closest('[data-kind]'))) { iss.kind = b.dataset.kind; [].forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); issCheck(); return; }
    if ((b = t.closest('[data-grp]'))) {
      var g = (CX.rosterGroups || []).filter(function (y) { return y.id === b.dataset.grp; })[0];
      return alertDlg({ ic: 'check', t: g.voter + ' 통합내역', d: g.members.map(function (m) { return m.nm + ' · ' + cm(m.sh) + '주'; }).join('\n') });
    }
    if (t.closest('[data-all]')) {
      var on = t.checked;
      issRows().forEach(function (r) { var at = iss.picked.indexOf(r); if (on && at < 0) iss.picked.push(r); if (!on && at >= 0) iss.picked.splice(at, 1); });
      issPicked(); return;
    }
    var row = t.closest('#lcIssList .lc-mrow[data-i]');
    if (row) {
      var r = CX.roster.filter(function (y) { return y.i === +row.dataset.i; })[0], at = iss.picked.indexOf(r);
      if (at >= 0) iss.picked.splice(at, 1); else iss.picked.push(r);
      issPicked(); return;
    }
    if (t.closest('[data-ok]') && !issueOk.disabled) issDo();
  });
  /* 선택한 투표권자 이름을 비어 있는 이름 칸에 채운다 */
  function issPicked() {
    if (iss.picked.length && !iss.v.lciName) { iss.v.lciName = voterOf(iss.picked[0]); document.getElementById('lciName').value = iss.v.lciName; }
    issList(); issCheck();
  }
  function issDo() {
    var ns = iss.ns, v = iss.v, t = now();
    var x = { k: uid++, ns: ns, voters: [], files: [], accts: [], supp: 0, reAt: '', cfAt: '', rej: '', mapAt: '', mapBy: '', route: '관리자 등록', st: '로그인코드 발급', codeAt: '', mailAt: t, code: newCode(), name: v.lciName, email: v.lciMail, phone: v.lciPhone, org: v.lciOrg || '-', pos: v.lciPos || '-', memo: v.lciMemo || '' };
    x.hist = [{ at: t, t: '로그인코드 발급 · 이메일 발송', by: ME }];
    if (ns) { x.kind = iss.kind; x.qna = !!v.lciAsk; }
    else {
      /* 주주명부에서 고른 투표권자로 바로 연결 — 셀프 신청의 주주확인 단계를 거치지 않는다 */
      x.corp = iss.corp; x.trust = '-'; x.mgr = iss.corp ? v.lciMgr : '-'; x.dept = iss.corp ? v.lciOrg || '-' : '-';
      x.voters = iss.picked.slice(); x.st = '주주확인 완료'; x.mapAt = t; x.mapBy = ME;
      x.hist.unshift({ at: t, t: '주주명부 선택 · 투표권자 ' + x.voters.map(voterOf).join(', ') + ' 연결', by: ME });
    }
    L.unshift(x); issueEl.classList.remove('show');
    if ((ns ? 'ns' : 'sh') !== cur) document.querySelector('#lcTabs [data-t="' + (ns ? 'ns' : 'sh') + '"]').click();
    chip = 'all'; page = 1; sortSt = null; render();
    alertDlg({ ic: 'check', t: '로그인코드를 발급했습니다', d: '로그인코드 ' + x.code + '\n' + x.name + '님의 이메일(' + x.email + ')로 접속 정보를 보냈습니다.' });
  }

  /* ---------- 상세 패널 ---------- */
  var sheet = document.getElementById('lcSheet');
  function kv(k, v) { return '<div class="lc-kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function sec(t, inner, btn) { return '<div class="lc-sec"><div class="lc-sh"><span>' + t + '</span>' + (btn || '') + '</div>' + inner + '</div>'; }
  function file(f) { return '<div class="lc-file"><span class="fi"><i class="ph ph-file"></i></span><span class="fn">' + esc(f.n) + '</span><span class="fs">' + f.n.split('.').pop() + '・' + f.kb + 'KB</span><a data-dl title="다운로드"><i class="ph ph-download-simple"></i></a></div>'; }
  function files(x) { return x.files.length ? x.files.map(file).join('') : '<div class="lc-none">제출된 서류 없음</div>'; }
  function acctCards(x) {
    return x.accts.map(function (a, i) {
      return '<div class="lc-acct"><div class="h">' + (x.accts.length > 1 ? '계좌 ' + (i + 1) : '계좌') + '</div>' + kv('실질계좌번호', a.ac) + (x.corp ? kv('상임대리인 계좌번호', a.ag) : '') + kv('주식수', cm(a.sh) + '주') + '</div>';
    }).join('');
  }
  function paintSheet() {
    var x = shX; if (!x) return;
    var rv = x.st === '로그인코드 회수', admin = x.route === '관리자 등록', cd = cool[x.k] || {}, h = '';
    h += '<div class="lc-stbox"><span>처리상태</span>' + badge(x.st) + '</div>';
    /* 로그인코드 신청내역 — 주주: 신청일시 · 법인(기관)명 · 담당자명 · 부서 · 직책 · 휴대폰번호 · 이메일 · 로그인코드
       수동등록 비주주: 이름 · 부서 · 직책 · 이메일 · 휴대폰번호 · 메모 · 질의권 부여 · 로그인코드 */
    var c = '', mail = esc(x.email) + ' <span class="mu">(' + x.mailAt + ')</span>';
    if (x.ns) c += kv('이름', esc(x.name)) + kv('부서', esc(x.org || '-')) + kv('직책', esc(x.pos || '-')) + kv('이메일', mail) + kv('휴대폰번호', esc(x.phone || '-')) + kv('메모', esc(x.memo || '-')) + kv('질의권 부여', x.qna ? '부여' : '미부여');
    else {
      c += kv('신청일시', x.codeAt || '-');
      c += x.corp ? kv('법인(기관)명', esc(x.name)) + kv('담당자명', esc(x.mgr)) + kv('부서', esc(x.dept)) + kv('직책', esc(x.pos)) : kv('이름', esc(x.name));
      c += kv('휴대폰번호', esc(x.phone || '-')) + kv('이메일', mail);
    }
    c += kv('로그인코드', '<span class="lc-code' + (rv ? ' off' : '') + '">' + x.code + '</span>');
    c += '<div class="lc-2btn"><button type="button" class="btn" data-a="re"' + (!admin || cd.re ? ' disabled' : '') + '><i class="ph ph-arrow-counter-clockwise"></i>코드 재발급</button><button type="button" class="btn soft" data-a="rv"' + (!admin || rv ? ' disabled' : '') + '><i class="ph ph-prohibit"></i>코드 회수</button></div>';
    if (!admin) c += '<div class="lc-note">주주가 직접 신청한 코드는 재발급·회수할 수 없습니다.</div>';
    h += sec(x.ns ? '로그인코드 발급내역' : '로그인코드 신청내역', c);
    if (x.cfAt) {
      h += sec('주주확인 신청내역', kv('신청일시', x.cfAt + (x.reAt ? ' <span class="mu">(재제출 ' + x.reAt + ')</span>' : '')) + kv('보완요청', x.supp + '/2회') + acctCards(x));
      h += sec('제출 서류', files(x), OPEN[x.st] ? '<button type="button" class="btn" data-a="supp"' + (x.supp >= 2 ? ' disabled' : '') + '><i class="ph ph-paper-plane-tilt"></i>서류 보완 요청</button>' : '');
    }
    if (x.st === '주주확인 반려') h += sec('반려사유', '<div class="lc-rej">' + esc(x.rej || '-') + '</div>');
    if (x.voters.length) h += sec('주주확인 후 매핑정보', x.voters.map(function (r) { return '<div class="lc-acct"><div class="h">' + esc(voterOf(r)) + '</div>' + kv('주주명', esc(r.nm)) + kv('주주번호', r.id) + kv('실질계좌번호', r.ac) + kv('보유주식수', cm(r.sh) + '주') + '</div>'; }).join('') + kv('매핑일시', x.mapAt) + kv('처리자', x.mapBy));
    h += sec('이력', '<div class="lc-tl">' + x.hist.map(function (e) { return '<div class="row"><i></i><div><div class="t1">' + esc(e.t) + '</div><div class="t2">' + e.at + ' · ' + e.by + '</div></div></div>'; }).join('') + '</div>');
    document.getElementById('lcShBody').innerHTML = h;
    document.getElementById('lcShFt').innerHTML = OPEN[x.st] ? '<button type="button" class="btn danger" data-a="rej">주주확인 반려</button><button type="button" class="btn dark" data-a="map">주주매핑</button>'
      : x.st === '주주확인 완료' ? '<button type="button" class="btn" data-sx>닫기</button><button type="button" class="btn dark" data-a="map">변경하기</button>'
      : '<button type="button" class="btn" data-sx>닫기</button>';
    document.getElementById('lcShMod').textContent = x.hist.length ? '마지막 수정 ' + x.hist[0].at + ' · ' + x.hist[0].by : '';
  }
  function openSheet(x) { shX = x; paintSheet(); sheet.classList.add('show'); }
  function closeSheet() { shX = null; sheet.classList.remove('show'); }
  sheet.addEventListener('click', function (e) {
    if (e.target.closest('[data-sx]')) { closeSheet(); return; }
    if (e.target.closest('[data-dl]')) { toast('파일을 다운로드합니다.'); return; }
    var a = e.target.closest('[data-a]'); if (a && !a.disabled && shX) act(a.dataset.a, shX);
  });

  /* ---------- 주주 매핑 ---------- */
  var mapEl = document.getElementById('lcMap'), mapX = null, picked = [], mapQ = document.getElementById('lcMapQ'), mapF = document.getElementById('lcMapF'), mapOk = document.getElementById('lcMapOk');
  function openMap(x) {
    if (VOTING_STARTED) return alertDlg({ ic: 'warn', t: '표결이 시작되어 변경이 불가합니다', d: '표결이 시작된 이후에는 주주확인 및 매핑 변경을 할 수 없습니다.', ok: '확인', danger: 1 });
    mapX = x; picked = x.voters.slice(); mapQ.value = ''; mapF.value = 'vt';
    var l = kv('구분', x.corp ? '기관' : '개인') + kv(x.corp ? '법인(기관)명' : '이름', esc(x.name)) + (x.corp ? kv('담당자명', esc(x.mgr)) : '') + kv('휴대폰번호', esc(x.phone)) + kv('이메일', esc(x.email)) + kv('로그인코드', '<span class="lc-code">' + x.code + '</span>') +
      kv('주주번호', esc(x.idNo) + ' <span class="mu">(' + x.idType + ')</span>') + (x.corp ? kv('상임대리인코드', x.agent) : '') + kv('보유주식수량', cm(x.decl) + '주 · 계좌 ' + x.accts.length + '건');
    document.getElementById('lcMapL').innerHTML = sec('주주 신청 정보', l) + (x.accts.length ? sec('신고 계좌', acctCards(x)) : '') + sec('제출 서류', files(x));
    mapOk.textContent = x.st === '주주확인 완료' ? '변경하기' : '주주 매핑';
    paintMap(); mapEl.classList.add('show'); setTimeout(function () { mapQ.focus(); }, 30);
  }
  function paintMap() {
    var s = mapQ.value.trim().toLowerCase(), fldk = mapF.value, res = [];
    if (s) res = CX.roster.filter(function (r) { return String(fldk === 'vt' ? voterOf(r) : r[fldk]).toLowerCase().indexOf(s) >= 0; }).slice(0, 60);
    picked.forEach(function (r) { if (res.indexOf(r) < 0) res.unshift(r); });
    var full = picked.length >= 1;   /* 투표권자는 하나만 선택 */
    document.getElementById('lcMapList').innerHTML = '<div class="lc-mrow hd"><span></span><span>투표권자명</span><span>주주명</span><span>주주번호</span><span class="n">보유주식</span><span style="text-align:center">통합내역</span></div>' +
      (res.length ? res.map(function (r) {
        var on = picked.indexOf(r) >= 0, dis = full && !on, g = GROUP_OF[r.i];
        return '<div class="lc-mrow' + (on ? ' on' : '') + (dis ? ' dis' : '') + '" data-i="' + r.i + '" title="주주명 ' + esc(r.nm) + '&#10;주주번호 ' + r.id + '&#10;실질계좌번호 ' + r.ac + '">' +
          '<span><input type="checkbox"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="선택"></span><span class="vt">' + esc(voterOf(r)) + '</span><span class="mu">' + esc(r.nm) + '</span><span class="mu">' + r.id + '</span><span class="n">' + cm(r.sh) + '</span>' +
          '<span style="text-align:center">' + (g ? '<button type="button" class="mini" data-grp="' + g.id + '">보기</button>' : '<span class="mu">-</span>') + '</span></div>';
      }).join('') : '<div class="lc-mempty">' + (s ? '검색 결과가 없습니다.' : '검색 후 매핑할 투표권자를 선택하세요.') + '</div>');
    mapOk.disabled = !picked.length || (mapX.voters.length === picked.length && mapX.voters.every(function (r, i) { return r === picked[i]; }));
  }
  mapQ.addEventListener('input', paintMap); mapF.addEventListener('change', paintMap);
  mapEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-x]')) { mapEl.classList.remove('show'); return; }
    var gb = e.target.closest('[data-grp]');
    if (gb) {
      var g = (CX.rosterGroups || []).filter(function (y) { return y.id === gb.dataset.grp; })[0];
      return alertDlg({ ic: 'check', t: g.voter + ' 통합내역', d: g.members.map(function (m) { return m.nm + ' · ' + cm(m.sh) + '주'; }).join('\n') + '\n\n통합내역 변경은 주주명부 관리에서 할 수 있습니다.' });
    }
    var row = e.target.closest('.lc-mrow[data-i]');
    if (row && !row.classList.contains('dis')) {
      var r = CX.roster.filter(function (y) { return y.i === +row.dataset.i; })[0], at = picked.indexOf(r);
      if (at >= 0) picked.splice(at, 1); else picked.push(r);
      paintMap(); return;
    }
    if (e.target.closest('#lcMapOk') && !mapOk.disabled) {
      var chg = mapX.st === '주주확인 완료';
      document.getElementById('lcCfT').textContent = chg ? '주주 매핑 변경 확인' : '주주 매핑 확인';
      document.getElementById('lcCfOk').textContent = chg ? '변경하기' : '승인하기';
      /* 확인 다이얼로그 — 신청자 · 투표권자 · 연결 계좌 수, 아래 회색 박스에 계좌별 보유주식 */
      document.getElementById('lcCfBody').innerHTML = kv('신청자', esc(mapX.name)) + (chg ? kv('기존 투표권자', esc(mapX.voters.map(voterOf).join(', '))) : '') + kv('투표권자', esc(picked.map(voterOf).join(', '))) + kv('연결 계좌 수', picked.length + '개');
      document.getElementById('lcCfAcct').innerHTML = picked.map(function (r, i) { return '<div class="it"><div class="h">' + (picked.length > 1 ? '계좌 ' + (i + 1) : '계좌') + '</div><div class="r"><span>보유주식</span><b>' + cm(r.sh) + '주</b></div></div>'; }).join('');
      document.getElementById('lcConfirm').classList.add('show');
    }
  });
  document.getElementById('lcConfirm').addEventListener('click', function (e) {
    var el = this;
    if (e.target.closest('[data-x]')) { el.classList.remove('show'); return; }
    if (!e.target.closest('[data-ok]')) return;
    var x = mapX, chg = x.st === '주주확인 완료';
    x.voters = picked.slice(); x.st = '주주확인 완료'; x.mapAt = now(); x.mapBy = ME;
    log(x, (chg ? '매핑 변경 · 투표권자 ' : '주주 매핑 완료 · 투표권자 ') + x.voters.map(voterOf).join(', ') + ' 연결');
    el.classList.remove('show'); mapEl.classList.remove('show');
    done(chg ? '투표권자 매핑을 변경했습니다.' : '주주 매핑을 완료했습니다.');
  });

  head(); render();
})();
