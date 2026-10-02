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

  /* 네이버 지도(Web Dynamic Map) Client ID.
     여기에 적어 두거나, 주소 뒤에 ?ncpKeyId=... 를 붙이거나, 설정 화면에서 넣을 수 있다.
     비어 있으면 지도는 키가 필요 없는 OSM 지도로 뜬다. */
  APP.NAVER_KEY = '434fyvv4r5';

  /* 기업 목록 — 주주PASS 시청 페이지가 쓰는 기업 리스트와 같은 이름을 쓴다 */
  /* 상세 조건의 기업 선택은 지금 권유가 진행중인 기업만 보여 준다 (아래 CAMPAIGNS 에서 뽑는다) */
  /* 기업 로고 — 주주PASS 시청 페이지와 같은 파일을 쓴다 */
  APP.LOGO = {
    '큐더스전자': 'logo-kudoselectric.png', '카카오뱅크': 'logo-kakaobank.png',
    '네이버': 'logo-naver.png', '한미반도체': 'logo-hanmi.png',
    '한화에어로스페이스': 'logo-hanwha-aero.png', '무신사': 'logo-musinsa.png',
    '농심': 'logo-nongshim.png', 'GS': 'logo-gs.png'
  };
  APP.logoOf = function (org) { return 'assets/' + (APP.LOGO[org] || 'logo-kudoselectric.png'); };

  APP.liveCompanies = function () {
    return APP.CAMPAIGNS.filter(function (c) { return c.state === 'live'; })
      .map(function (c) { return c.org; });
  };

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
     시연 구역은 여의도 일대. 실제 단지·도로명과 좌표를 쓰되 동·호는 임의로 만든다. */
  var AREAS = [
    { zip: '07325', dong: '여의도동', road: '여의대방로', lat: 37.5205, lng: 126.9268,
      apt: ['브라이튼 여의도', '여의도자이', '리첸시아'] },
    { zip: '07327', dong: '여의도동', road: '여의나루로', lat: 37.5268, lng: 126.9330,
      apt: ['시범아파트', '삼부아파트', '목화아파트'] },
    { zip: '07330', dong: '여의도동', road: '국제금융로', lat: 37.5250, lng: 126.9250,
      apt: ['서울아파트', '광장아파트', '수정아파트'] },
    { zip: '07333', dong: '여의도동', road: '의사당대로', lat: 37.5288, lng: 126.9192,
      apt: ['공작아파트', '진주아파트', '미성아파트'] },
    { zip: '07335', dong: '여의도동', road: '은행로', lat: 37.5222, lng: 126.9310,
      apt: ['한양아파트', '대교아파트', '장미아파트'] },
    /* 여의도 밖 인접 생활권 — 다리 하나 건너는 거리 */
    { zip: '07236', dong: '영등포동', road: '영중로', lat: 37.5185, lng: 126.9075,
      apt: ['영등포푸르지오', '아크로타워스퀘어', '포레나영등포'] },
    { zip: '07004', dong: '당산동', road: '당산로', lat: 37.5340, lng: 126.9020,
      apt: ['당산삼성래미안', '유원제일', '상아현대'] },
    { zip: '06958', gu: '동작구', dong: '노량진동', road: '노량진로', lat: 37.5130, lng: 126.9420,
      apt: ['신동아리버파크', '쌍용예가', '삼익아파트'] }
  ];
  /* 전국 — 지도를 멀리 당겨 보면 지역별 분포와 수치를 볼 수 있도록 주요 도시를 깔아 둔다 */
  var NATION = [
    { si: '부산광역시', gu: '해운대구', dong: '우동',   road: '센텀남대로', lat: 35.1696, lng: 129.1306, zip: '48058', apt: ['트럼프월드', '경동제이드', '두산위브'] },
    { si: '대구광역시', gu: '수성구',   dong: '범어동', road: '달구벌대로', lat: 35.8580, lng: 128.6260, zip: '42111', apt: ['두산위브더제니스', '범어숲화성파크드림', '수성SK리더스뷰'] },
    { si: '인천광역시', gu: '연수구',   dong: '송도동', road: '컨벤시아대로', lat: 37.3860, lng: 126.6430, zip: '21998', apt: ['더샵퍼스트월드', '송도센트럴파크', '글로벌캠퍼스푸르지오'] },
    { si: '광주광역시', gu: '서구',     dong: '치평동', road: '상무중앙로', lat: 35.1520, lng: 126.8510, zip: '61947', apt: ['상무자이', '금호타운', '한국아델리움'] },
    { si: '대전광역시', gu: '유성구',   dong: '도룡동', road: '대덕대로', lat: 36.3920, lng: 127.3970, zip: '34142', apt: ['스마트시티', '도룡포레미소지움', 'SK뷰'] },
    { si: '울산광역시', gu: '남구',     dong: '삼산동', road: '삼산로',   lat: 35.5380, lng: 129.3380, zip: '44705', apt: ['벽산아파트', '현대홈타운', '삼산코아루'] },
    { si: '세종특별자치시', gu: '',     dong: '도담동', road: '도움1로',  lat: 36.5090, lng: 127.2560, zip: '30099', apt: ['도램마을', '새뜸마을', '가재마을'] },
    { si: '경기도', gu: '수원시 영통구', dong: '이의동', road: '광교중앙로', lat: 37.2990, lng: 127.0460, zip: '16514', apt: ['자연앤힐스테이트', '광교아이파크', '중흥S클래스'] },
    { si: '경기도', gu: '성남시 분당구', dong: '정자동', road: '정자일로', lat: 37.3660, lng: 127.1080, zip: '13561', apt: ['파크뷰', '아이파크분당', '한솔마을'] },
    { si: '경기도', gu: '고양시 일산동구', dong: '장항동', road: '호수로', lat: 37.6580, lng: 126.7700, zip: '10401', apt: ['호수마을', '백마마을', '밤가시마을'] },
    { si: '경기도', gu: '용인시 수지구', dong: '동천동', road: '수지로',  lat: 37.3340, lng: 127.0970, zip: '16827', apt: ['래미안이스트팰리스', '동천자이', '현대홈타운'] },
    { si: '충청북도', gu: '청주시 흥덕구', dong: '복대동', road: '직지대로', lat: 36.6350, lng: 127.4320, zip: '28375', apt: ['지웰시티', '신영지웰', '두산위브'] },
    { si: '충청남도', gu: '천안시 서북구', dong: '불당동', road: '불당대로', lat: 36.8180, lng: 127.1070, zip: '31157', apt: ['지웰더샵', '호반써밋', '파크밸리'] },
    { si: '전라북도', gu: '전주시 덕진구', dong: '송천동', road: '기린대로', lat: 35.8530, lng: 127.1220, zip: '54321', apt: ['에코시티더샵', '포레나', '하늘채'] },
    { si: '경상북도', gu: '포항시 남구', dong: '대잠동', road: '중흥로',   lat: 36.0120, lng: 129.3470, zip: '37673', apt: ['자이', '중흥S클래스', '우방신천지'] },
    { si: '경상남도', gu: '창원시 성산구', dong: '상남동', road: '중앙대로', lat: 35.2270, lng: 128.6810, zip: '51495', apt: ['토월성원', '한성', '트리비앙'] },
    { si: '강원특별자치도', gu: '춘천시', dong: '온의동', road: '공지로',  lat: 37.8690, lng: 127.7200, zip: '24409', apt: ['e편한세상', '롯데캐슬스카이클래스', '현진에버빌'] },
    { si: '제주특별자치도', gu: '제주시', dong: '노형동', road: '노형로',  lat: 33.4820, lng: 126.4800, zip: '63088', apt: ['아이파크', '중흥S클래스', '해모로'] }
  ];
  /* 시연 타겟 — 박성용(큐더스전자 1,200주)은 여의도 브라이튼 거주로 고정한다 */
  var TARGET = 894;
  var TARGET_ADDR = {
    zip: '07325',
    full: '서울특별시 영등포구 여의대방로 379 브라이튼 여의도 101동 2304호',
    short: '서울특별시 영등포구 여의도동',
    lat: 37.52051, lng: 126.92683
  };

  /* 순번에서 뽑는 난수 — 같은 순번이면 늘 같은 값 */
  function rnd(i, salt) {
    var x = Math.sin((i + 1) * 9301 + (salt || 0) * 49297) * 233280;
    return x - Math.floor(x);
  }
  function pick(arr, i, salt) { return arr[Math.floor(rnd(i, salt) * arr.length) % arr.length]; }

  function addrOf(i) {
    if (i === TARGET) return TARGET_ADDR;
    /* 담당 구역(여의도 일대) 65% · 전국 35% — 지도를 당겨 보면 전국 분포가 보인다 */
    var far = rnd(i, 21) >= 0.65;
    if (far) {
      var n = NATION[Math.floor(rnd(i, 22) * NATION.length) % NATION.length];
      var no2 = 10 + Math.floor(rnd(i, 23) * 180);
      var dg = 101 + Math.floor(rnd(i, 24) * 15);
      var h2 = 101 + Math.floor(rnd(i, 25) * 20) * 10 + Math.floor(rnd(i, 26) * 4);
      return {
        zip: n.zip,
        full: n.si + ' ' + (n.gu ? n.gu + ' ' : '') + n.road + ' ' + no2 + ' ' + pick(n.apt, i, 27) + ' ' + dg + '동 ' + h2 + '호',
        short: n.si + ' ' + (n.gu || n.dong),
        lat: n.lat + (rnd(i, 28) - 0.5) * 0.09,
        lng: n.lng + (rnd(i, 29) - 0.5) * 0.11
      };
    }
    /* 여의도 안쪽(0~4번 구역)에 3/4, 인접 생활권에 1/4 */
    var inside = rnd(i, 8) < 0.76;
    var pool = inside ? AREAS.slice(0, 5) : AREAS.slice(5);
    var a = pool[Math.floor(rnd(i, 9) * pool.length) % pool.length];
    var no = 10 + Math.floor(rnd(i, 3) * 180);
    var dong = 101 + Math.floor(rnd(i, 4) * 12);
    var ho = 101 + Math.floor(rnd(i, 5) * 20) * 10 + Math.floor(rnd(i, 6) * 4);
    /* 여의도는 섬이라 좁게, 바깥은 조금 넓게 흩뿌린다 */
    var s = inside ? 0.0075 : 0.014;
    return {
      zip: a.zip,
      full: '서울특별시 ' + (a.gu || '영등포구') + ' ' + a.road + ' ' + no + ' ' + pick(a.apt, i, 7) + ' ' + dong + '동 ' + ho + '호',
      short: '서울특별시 ' + (a.gu || '영등포구') + ' ' + a.dong,
      lat: a.lat + (rnd(i, 1) - 0.5) * s,
      lng: a.lng + (rnd(i, 2) - 0.5) * s * 1.3
    };
  }

  /* 생년월일 · 성별 — 명부의 마스킹된 주민등록번호 앞자리를 그대로 읽는다.
     (앞 6자리 생년월일 + 뒷자리 첫 숫자로 1900년대·2000년대와 성별이 갈린다) */
  function bornOf(r) {
    var i = r.i;
    function p(v) { return (v < 10 ? '0' : '') + v; }
    var m = /^(\d{2})(\d{2})(\d{2})-([1-4])/.exec(String(r.id || ''));
    if (m) {
      var c = (m[4] === '1' || m[4] === '2') ? 1900 : 2000;
      var y = c + (+m[1]);
      return { ymd: y + '-' + m[2] + '-' + m[3], age: 2026 - y,
        sex: (m[4] === '1' || m[4] === '3') ? '남성' : '여성' };
    }
    /* 법인 등록번호처럼 형식이 다르면 순번으로 만든다 */
    var y2 = 1948 + Math.floor(rnd(i, 11) * 52);
    return { ymd: y2 + '-' + p(1 + Math.floor(rnd(i, 12) * 12)) + '-' + p(1 + Math.floor(rnd(i, 13) * 28)),
      age: 2026 - y2, sex: rnd(i, 14) < 0.47 ? '남성' : '여성' };
  }

  /* 거주 가능성 — 명부 주소와 최근 우편물 반송 여부를 섞은 값(시연용) */
  function liveOf(i) {
    if (i === TARGET) return { k: 'high', nm: '거주 가능성 높음' };
    var v = rnd(i, 21);
    if (v > 0.72) return { k: 'high', nm: '거주 가능성 높음' };
    if (v > 0.30) return { k: 'mid',  nm: '거주 가능성 보통' };
    return { k: 'low', nm: '거주 가능성 낮음' };
  }

  /* ── 캠페인(주주총회) ──────────────────────────────────────────────── */
  var M = (CX.meeting || {});
  /* from = 권유 시작일, due = 수집 마감일. c1 만 앱에서 수집한 실적을 그대로 쓴다. */
  APP.CAMPAIGNS = [
    { id: 'c1', org: M.org || '큐더스전자', term: M.name || '제10기 정기주주총회',
      from: '2026-09-15', due: '2026-10-21', state: 'live',
      goalSh: 50, goalVt: 15000000 },
    { id: 'c4', org: '한미반도체', term: '제 9기 정기주주총회',
      from: '2026-09-18', due: '2026-10-14', state: 'live',
      goalSh: 40, goalVt: 9000000, doneSh: 31, doneVt: 6840000 },
    { id: 'c5', org: '한화에어로스페이스', term: '제 9기 정기주주총회',
      from: '2026-09-22', due: '2026-10-07', state: 'live',
      goalSh: 60, goalVt: 20000000, doneSh: 18, doneVt: 5120000 },
    { id: 'c6', org: '무신사', term: '제 9기 정기주주총회',
      from: '2026-09-10', due: '2026-10-03', state: 'live',
      goalSh: 30, goalVt: 6000000, doneSh: 27, doneVt: 5460000 },
    { id: 'c7', org: '농심', term: '제 9기 정기주주총회',
      from: '2026-09-25', due: '2026-10-28', state: 'live',
      goalSh: 45, goalVt: 12000000, doneSh: 9, doneVt: 2180000 },
    { id: 'c8', org: 'GS', term: '제 9기 정기주주총회',
      from: '2026-09-12', due: '2026-10-09', state: 'live',
      goalSh: 35, goalVt: 8000000, doneSh: 24, doneVt: 5900000 },
    /* 지난 캠페인은 마감된 실적을 그대로 보여 준다 */
    { id: 'c2', org: '카카오뱅크', term: '제 9기 정기주주총회', from: '2026-02-16', due: '2026-03-12', state: 'end',
      goalSh: 50, goalVt: 15000000, doneSh: 50, doneVt: 15420000 },
    { id: 'c3', org: '네이버', term: '제 26기 임시주주총회', from: '2026-01-26', due: '2026-02-20', state: 'end',
      goalSh: 50, goalVt: 15000000, doneSh: 45, doneVt: 13610000 }
  ];

  /* ── 행정구역 — 지역 선택 드롭다운용 ───────────────────────────────── */
  APP.REGION = {
    '서울특별시': ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
    '부산광역시': ['강서구','금정구','기장군','남구','동구','동래구','부산진구','북구','사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구'],
    '대구광역시': ['남구','달서구','달성군','동구','북구','서구','수성구','중구','군위군'],
    '인천광역시': ['강화군','계양구','미추홀구','남동구','동구','부평구','서구','연수구','옹진군','중구'],
    '광주광역시': ['광산구','남구','동구','북구','서구'],
    '대전광역시': ['대덕구','동구','서구','유성구','중구'],
    '울산광역시': ['남구','동구','북구','울주군','중구'],
    '세종특별자치시': ['세종시'],
    '경기도': ['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시','남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시','안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시','의정부시','이천시','파주시','평택시','포천시','하남시','화성시'],
    '강원특별자치도': ['강릉시','고성군','동해시','삼척시','속초시','양구군','양양군','영월군','원주시','인제군','정선군','철원군','춘천시','태백시','평창군','홍천군','화천군','횡성군'],
    '충청북도': ['괴산군','단양군','보은군','영동군','옥천군','음성군','제천시','증평군','진천군','청주시','충주시'],
    '충청남도': ['계룡시','공주시','금산군','논산시','당진시','보령시','부여군','서산시','서천군','아산시','예산군','천안시','청양군','태안군','홍성군'],
    '전북특별자치도': ['고창군','군산시','김제시','남원시','무주군','부안군','순창군','완주군','익산시','임실군','장수군','전주시','정읍시','진안군'],
    '전라남도': ['강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시','무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군','장성군','장흥군','진도군','함평군','해남군','화순군'],
    '경상북도': ['경산시','경주시','고령군','구미시','김천시','문경시','봉화군','상주시','성주군','안동시','영덕군','영양군','영주시','영천시','예천군','울릉군','울진군','의성군','청도군','청송군','칠곡군','포항시'],
    '경상남도': ['거제시','거창군','고성군','김해시','남해군','밀양시','사천시','산청군','양산시','의령군','진주시','창녕군','창원시','통영시','하동군','함안군','함양군','합천군'],
    '제주특별자치도': ['서귀포시','제주시']
  };
  APP.SIDO = Object.keys(APP.REGION);

  /* ── 수집 대상 만들기 ──────────────────────────────────────────────── */
  var SAVED = load();

  function baseState(i) {
    if (i === TARGET) return 'plan';   /* 시연은 이 주주를 처음 찾아가는 데서 시작한다 */
    var v = rnd(i, 31);
    if (v > 0.86) return 'done';
    if (v > 0.74) return 'fix';
    if (v > 0.60) return 'no';
    if (v > 0.34) return 'replan';
    return 'plan';
  }

  /* 명부에 잡히는 주소들 — 첫 번째가 대표 주소.
     추가 주소는 같은 동네에서 조금씩 어긋난 이력 주소로 만든다. */
  var LIVE3 = [{ k: 'high', nm: '거주 가능성 높음' }, { k: 'mid', nm: '거주 가능성 보통' }, { k: 'low', nm: '거주 가능성 낮음' }];
  function addrList(i, ad, lv) {
    var out = [{ zip: ad.zip, full: ad.full, short: ad.short, lat: ad.lat, lng: ad.lng, live: lv, other: false }];
    var n = (rnd(i, 52) < 0.35) ? 1 + Math.floor(rnd(i, 53) * 3) : 0;
    for (var k = 0; k < n; k++) {
      var a2 = addrOf(i + 613 * (k + 1));
      var l2 = LIVE3[Math.min(2, Math.floor(rnd(i, 60 + k) * 3))];
      out.push({ zip: a2.zip, full: a2.full, short: a2.short, lat: a2.lat, lng: a2.lng,
        live: l2, other: l2.k === 'low' });    /* 거주 가능성 낮음 → 타인거주 확인 대상 */
    }
    return out;
  }

  /* 권유 기간(9/15~9/29) 안의 처리 일시 */
  function atOf(i) {
    function p(v) { return (v < 10 ? '0' : '') + v; }
    var d = 15 + Math.floor(rnd(i, 41) * 15);
    var h = 9 + Math.floor(rnd(i, 42) * 11), m = Math.floor(rnd(i, 43) * 60);
    return '2026-09-' + p(d) + ' ' + p(h) + ':' + p(m);
  }

  function build() {
    /* 현장 방문 대상이라 국내 거주 개인 주주만 본다 */
    var R = (CX.roster || []).filter(function (r) { return r.gb === '개인'; });
    if (!R.length) R = (CX.roster || []).filter(function (r) { return r.gb === '개인'; });
    if (!R.length) R = (CX.roster || []).slice();
    /* 여의도 구역에 배정된 명부 — 보유주식이 큰 개인부터 149명 */
    R = R.slice().sort(function (a, b) { return b.sh - a.sh; }).slice(0, 999);   /* 전국 분포가 보이도록 명부의 개인 주주를 모두 쓴다 */
    /* 시연 타겟(박성용 1,200주)은 보유 규모와 무관하게 반드시 포함해 150명을 맞춘다 */
    if (!R.some(function (r) { return r.i === TARGET; })) {
      var t = (CX.roster || []).filter(function (r) { return r.i === TARGET; })[0];
      if (t) R.push(t); else R = R.slice(0, 1000);
    }
    return R.map(function (r, i) {
      var ad = addrOf(r.i), bn = bornOf(r), lv = liveOf(r.i);
      var st = SAVED.st[r.i] || baseState(r.i);
      /* 위임을 받았다는 건 그 자리에서 본인을 만났다는 뜻이라 거주가 확인된 것으로 본다 */
      if (st === 'done') lv = { k: 'high', nm: '거주 가능성 높음' };
      return {
        i: r.i, name: r.nm, sh: r.sh, rt: r.rt,
        org: campOf(r.i).org, camp: campOf(r.i).id,
        sex: bn.sex, born: bn.ymd, age: bn.age,
        tel: SAVED.tel[r.i] || '',
        zip: ad.zip, addr: ad.full, area: ad.short, lat: ad.lat, lng: ad.lng,
        gb: r.gb,                                   /* 개인 · 법인 */
        bld: rnd(r.i, 51) < 0.72 ? '집합건물' : '단독건물',
        live: lv, st: st,
        addrs: addrList(r.i, ad, lv),               /* 대표 주소 + 추가 주소 */
        get more() { return Math.max(0, this.addrs.length - 1); },
        memo: SAVED.memo[r.i] || '',
        visit: SAVED.visit[r.i] || '',              /* 재방문 일정 */
        /* 앱에서 처리한 적이 없는 건은 배정 이후 아무 날짜나 하나 붙여 둔다 */
        at: SAVED.at[r.i] || (st === 'plan' ? '' : atOf(r.i))
      };
    });
  }

  /* 주주가 어느 기업 주주인지 — 이번 주총(큐더스전자) 70%, 나머지 진행중 기업이 30% */
  function campOf(i) {
    var live = APP.CAMPAIGNS.filter(function (c) { return c.state === 'live'; });
    var main = live[0], rest = live.slice(1);
    if (!rest.length || rnd(i, 97) < 0.7) return main;
    return rest[Math.floor(rnd(i, 113) * rest.length) % rest.length];
  }

  /* ── 저장 — CONEXUS 와 같은 칸(cx.collect)을 쓴다 ───────────────────── */
  var KEY = 'cx.collect';
  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    return { st: s.st || {}, memo: s.memo || {}, tel: s.tel || {}, at: s.at || {}, addr: s.addr || {}, visit: s.visit || {} };
  }
  function save() {
    var s = { st: SAVED.st, memo: SAVED.memo, tel: SAVED.tel, at: SAVED.at, addr: SAVED.addr, visit: SAVED.visit, ts: Date.now() };
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
    if (st === 'done') {
      x.live = { k: 'high', nm: '거주 가능성 높음' };
      if (x.addrs && x.addrs[0]) x.addrs[0].live = x.live;
    }
    x.at = new Date().toISOString().slice(0, 16).replace('T', ' ');
    SAVED.at[x.i] = x.at;
    save();
  };
  APP.setMemo = function (i, t) { var x = APP.find(i); if (!x) return; x.memo = t; SAVED.memo[x.i] = t; save(); };
  /* 대표 주소 바꾸기 — 고른 주소를 맨 앞으로 올리고 카드·지도에 쓰는 값도 같이 바꾼다 */
  APP.setPrimaryAddr = function (i, k) {
    var x = APP.find(i); if (!x || !x.addrs[k]) return;
    var a = x.addrs.splice(k, 1)[0];
    x.addrs.unshift(a);
    x.zip = a.zip; x.addr = a.full; x.area = a.short; x.lat = a.lat; x.lng = a.lng; x.live = a.live;
    SAVED.addr[x.i] = k; save();
  };
  APP.setTel  = function (i, t) { var x = APP.find(i); if (!x) return; x.tel  = t; SAVED.tel[x.i]  = t; save(); };
  APP.setVisit = function (i, v) { var x = APP.find(i); if (!x) return; x.visit = v; SAVED.visit[x.i] = v; save(); };
  /* 위임장 — 의안별 행사 방향·서명·신분증.
     이미지는 1024px JPEG 로 줄여 넣지만 그래도 커서 최근 20건만 남긴다. */
  var PXKEY = 'cx.app.px';
  function pxAll() {
    try { return JSON.parse(localStorage.getItem(PXKEY) || '{}'); } catch (e) { return {}; }
  }
  APP.setProxy = function (i, v) {
    var x = APP.find(i); if (!x) return;
    var all = pxAll();
    /* 신분증 사진은 쌓아 둘 이유가 없어 가장 최근 한 건만 들고 있는다 */
    Object.keys(all).forEach(function (k) { delete all[k].idImg; });
    all[x.i] = { votes: v.votes, sign: v.sign, idImg: v.idImg, at: x.at };
    var keys = Object.keys(all);
    while (keys.length > 20) { delete all[keys.shift()]; }
    try { localStorage.setItem(PXKEY, JSON.stringify(all)); }
    catch (e) {                                   /* 그래도 용량이 차면 이미지는 버리고 기록만 남긴다 */
      all[x.i] = { votes: v.votes, at: x.at };
      try { localStorage.setItem(PXKEY, JSON.stringify(all)); } catch (e2) {}
    }
  };
  APP.proxyOf = function (i) { return pxAll()[i] || null; };

  /* 수집현황 — 캠페인별 확보 주주 수 · 주식수 */
  APP.stat = function (campId) {
    var L = APP.list().filter(function (x) { return x.camp === campId; });
    var done = L.filter(function (x) { return x.st === 'done'; });
    var c = null; APP.CAMPAIGNS.forEach(function (x) { if (x.id === campId) c = x; });
    var gSh = (c && c.goalSh) || 50, gVt = (c && c.goalVt) || 15000000;
    var vt = done.reduce(function (a, x) { return a + x.sh; }, 0);
    /* c1 만 앱에서 실제로 수집한 값을 쓰고, 나머지는 미리 정해 둔 실적을 보여 준다 */
    if (c && c.doneSh != null) {
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
