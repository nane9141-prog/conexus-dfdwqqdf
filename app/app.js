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
  function toast(t) {
    var el = $('#toastT'); el.textContent = t; el.classList.add('on');
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
    if (k === 'list') drawList();
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
    var html = '<button class="chip" data-act="detail" type="button"><i class="ph ph-sliders-horizontal"></i>상세</button>'
      + '<button class="chip' + (F.bookOnly ? ' sel' : '') + '" data-act="book" type="button">'
      + (F.bookOnly ? '<i class="ph-fill ph-bookmark-simple"></i>' : '') + '관심 주주'
      + (F.bookOnly ? '<i class="ph ph-x"></i>' : '') + '</button>';
    APP.STATE_ORDER.forEach(function (k) {
      var on = F.st.indexOf(k) >= 0;
      html += '<button class="chip' + (on ? ' sel' : '') + '" data-st="' + k + '" type="button">' + ST[k].nm
        + (on ? '<i class="ph ph-x"></i>' : '') + '</button>';
    });
    c.innerHTML = html;
    c.querySelectorAll('[data-st]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.st, i = F.st.indexOf(k);
        if (i >= 0) F.st.splice(i, 1); else F.st.push(k);
        drawList();
      });
    });
    c.querySelector('[data-act="book"]').addEventListener('click', function () { F.bookOnly = !F.bookOnly; drawList(); });
    c.querySelector('[data-act="detail"]').addEventListener('click', openDetailFilter);
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
            b.querySelector('.cb').classList.toggle('on', F.st.indexOf(k) >= 0); drawList();
          });
        });
        bx.querySelector('[data-fbook]').addEventListener('click', function (e) {
          F.bookOnly = !F.bookOnly;
          e.currentTarget.querySelector('.cb').classList.toggle('on', F.bookOnly); drawList();
        });
        bx.querySelector('[data-clr]').addEventListener('click', function () {
          F.st = []; F.bookOnly = false; F.q = ''; $('#q').value = ''; drawList(); closeSheet();
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
          b.addEventListener('click', function () { F.sort = b.dataset.srt; closeSheet(); drawList(); });
        });
      }
    });
  });
  $('#q').addEventListener('input', function () { F.q = this.value; drawList(); });
  $('#btnBook').addEventListener('click', function () { F.bookOnly = !F.bookOnly; drawList(); toast(F.bookOnly ? '관심 주주만 보고 있습니다' : '전체 주주를 보고 있습니다'); });

  function liveBg(x) {
    var m = { high: 'green', mid: 'gray', low: 'red' };
    return '<span class="bg ' + m[x.live.k] + '">' + x.live.nm + '</span>';
  }
  function cardHtml(x) {
    var s = ST[x.st];
    return '<button class="card" type="button" data-open="' + x.i + '">'
      + '<div class="l1"><span class="nm">' + esc(x.name) + '</span>'
      + (BOOK.indexOf(x.i) >= 0 ? '<i class="ph-fill ph-bookmark-simple" style="color:#0071F3;font-size:15px"></i>' : '')
      + '<span class="sp"></span><span class="sh">' + cm(x.sh) + '주</span></div>'
      + '<div class="mt"><span>' + esc(x.org) + '</span><span class="d"></span><span>' + x.age + '세 ' + x.sex + '</span>'
      + '<span class="d"></span><span>' + esc(x.area) + '</span></div>'
      + '<div class="bgs"><span class="bg ' + s.cls + '">' + s.nm + '</span>' + liveBg(x) + '</div>'
      + '<div class="ad"><div class="zp"><span>' + x.zip + '</span>'
      + '<span class="cp" data-zip="' + x.zip + '"><i class="ph ph-copy"></i></span></div>'
      + '<div class="tx">' + esc(x.addr) + '</div></div>'
      + '</button>';
  }
  function bindCards(root) {
    root.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        var cp = e.target.closest('[data-zip]');
        if (cp) { e.stopPropagation(); copy(cp.dataset.zip); return; }
        openDetail(b.dataset.open);
      });
    });
  }
  function copy(t) {
    try { navigator.clipboard.writeText(t); } catch (e) {}
    toast('복사했습니다 — ' + t);
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
  $('#btnMap').addEventListener('click', openMap);

  /* ══ 지도 ════════════════════════════════════ */
  var MAP = null, LAYER = null, ME = { lat: 37.5250, lng: 126.9250 }, MEMK = null;

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
  function openMap() {
    show('#scrMap'); $('#tabbar').hidden = true;
    if (!MAP) {
      MAP = L.map('map', { zoomControl: false, attributionControl: true })
        .setView([ME.lat, ME.lng], 11);
      tiles();
      MAP.on('moveend zoomend', paintMarkers);
      /* 담당 구역 전체가 한눈에 들어오게 */
      var pts = APP.list().map(function (x) { return [x.lat, x.lng]; });
      if (pts.length) MAP.fitBounds(L.latLngBounds(pts).pad(0.12));
      setMe();
    }
    setTimeout(function () { MAP.invalidateSize(); paintMarkers(); }, 60);
  }
  $('#mapBack').addEventListener('click', function () { goTab('list'); });
  $('#mapList').addEventListener('click', function () { goTab('list'); });
  $('#mapIn').addEventListener('click', function () { MAP.zoomIn(); });
  $('#mapOut').addEventListener('click', function () { MAP.zoomOut(); });
  $('#mapMe').addEventListener('click', function () {
    if (!navigator.geolocation) { MAP.setView([ME.lat, ME.lng], 14); return; }
    toast('현재 위치를 확인하고 있습니다');
    navigator.geolocation.getCurrentPosition(function (p) {
      ME = { lat: p.coords.latitude, lng: p.coords.longitude };
      setMe(); MAP.setView([ME.lat, ME.lng], 14);
    }, function () { setMe(); MAP.setView([ME.lat, ME.lng], 14); toast('위치 권한이 없어 기본 위치로 이동합니다'); },
      { timeout: 6000 });
  });
  function setMe() {
    if (MEMK) MAP.removeLayer(MEMK);
    MEMK = L.marker([ME.lat, ME.lng], {
      icon: L.divIcon({
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
        html: '<div style="width:22px;height:22px;border-radius:1000px;background:#0071F3;border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,113,243,.2),0 2px 8px rgba(0,0,0,.3)"></div>'
      })
    }).addTo(MAP);
  }

  /* 화면 안의 주주를 격자로 묶어 클러스터로 보여 준다 */
  function paintMarkers() {
    if (!MAP) return;
    if (LAYER) MAP.removeLayer(LAYER);
    LAYER = L.layerGroup().addTo(MAP);
    var L0 = filtered(), z = MAP.getZoom(), b = MAP.getBounds();
    var vis = L0.filter(function (x) { return b.contains([x.lat, x.lng]); });
    if (z >= 14) {
      vis.slice(0, 300).forEach(function (x) {
        L.marker([x.lat, x.lng], {
          icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: '<div class="pin ' + x.st + '"></div>' })
        }).addTo(LAYER).on('click', function () { openDetail(x.i); });
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
      var lat = g.reduce(function (a, x) { return a + x.lat; }, 0) / n;
      var lng = g.reduce(function (a, x) { return a + x.lng; }, 0) / n;
      var d = n >= 100 ? 62 : n >= 30 ? 54 : n >= 10 ? 46 : 40;
      var lbl = n > 300 ? '300+' : n;
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
          html: '<div class="cls" style="width:' + d + 'px;height:' + d + 'px;font-size:' + (n >= 100 ? 15 : 14) + 'px">' + lbl + '</div>'
        })
      }).addTo(LAYER).on('click', function () {
        if (z >= 12) nearSheet(g, g.length + '명');
        else MAP.setView([lat, lng], z + 2);
      });
    });
  }
  function nearSheet(list, tt) {
    $('#nearTt').textContent = tt || '주변 주주';
    var c = $('#nearCards');
    c.innerHTML = list.slice(0, 30).map(cardHtml).join('');
    bindCards(c);
    $('#nearSheet').classList.add('on');
    $('.mapwrap').classList.add('sheeton');
  }
  function nearClose() { $('#nearSheet').classList.remove('on'); $('.mapwrap').classList.remove('sheeton'); }
  $('#nearX').addEventListener('click', nearClose);
  $('#mapNear').addEventListener('click', function () {
    var L0 = filtered().slice().sort(function (a, b) { return dist(a) - dist(b); }).slice(0, 20);
    nearSheet(L0, '주변 주주 ' + L0.length + '명');
  });

  /* ══ 주주 상세정보 ═══════════════════════════ */
  var CUR = null;
  function openDetail(i) {
    var x = APP.find(i); if (!x) return;
    CUR = x;
    backTo = $('#scrMap').classList.contains('on') ? 'map' : curTab;
    nearClose();
    drawDetail();
    show('#scrDetail'); $('#tabbar').hidden = true;
    $('#dtBd').scrollTop = 0;
  }
  $('#dtBack').addEventListener('click', function () { backTo === 'map' ? openMap() : goTab(backTo || 'list'); });

  function drawDetail() {
    var x = CUR, s = ST[x.st], mk = APP.mapLinks(x), bk = BOOK.indexOf(x.i) >= 0;
    /* cx-roster 의 rt 는 이미 퍼센트 값이다 */
    var pct = (x.rt != null ? Number(x.rt).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : '-');
    $('#dtBd').innerHTML =
      '<div class="dt-hd"><div class="l1"><span class="nm">' + esc(x.name) + '</span>'
      + '<button type="button" id="dtBook" style="margin-left:auto;color:' + (bk ? '#0071F3' : '#A3A3A3') + '">'
      + '<i class="' + (bk ? 'ph-fill' : 'ph') + ' ph-bookmark-simple" style="font-size:22px"></i></button></div>'
      + '<div class="bgs"><span class="bg ' + s.cls + '">' + s.nm + '</span>' + liveBg(x)
      + '<span class="bg gray">' + esc(x.org) + '</span></div></div>'

      + '<div class="sect"><h3>기본 정보</h3>'
      + kv('성별', x.sex) + kv('생년월일', x.born + ' (' + x.age + '세)')
      + kv('보유 주식', cm(x.sh) + '주 <span class="sub">지분율 ' + pct + '%</span>')
      + kv('연락처', x.tel ? ('<a class="lnk" href="tel:' + x.tel.replace(/[^0-9]/g, '') + '">' + esc(x.tel) + '</a>')
        : '<button class="lnk" type="button" id="dtTel">연락처 등록</button>')
      + kv('주소', x.zip + '<div class="sub">' + esc(x.addr) + '</div>')
      + '<div class="maplinks">'
      + '<a href="' + mk.naver + '" target="_blank" rel="noopener"><i class="ph ph-map-pin"></i>네이버 지도</a>'
      + '<a href="' + mk.google + '" target="_blank" rel="noopener"><i class="ph ph-map-trifold"></i>구글 지도</a>'
      + '<a href="' + mk.route + '" target="_blank" rel="noopener"><i class="ph ph-navigation-arrow"></i>길찾기</a>'
      + '</div></div>'

      + '<div class="sect"><h3>메모<span class="sp"></span>'
      + '<button type="button" id="dtMemo">' + (x.memo ? '수정' : '메모하기') + '</button></h3>'
      + '<div class="memo' + (x.memo ? ' has' : '') + '">' + (x.memo ? esc(x.memo) : '메모가 없습니다') + '</div></div>'

      + '<div class="sect" style="margin-bottom:12px"><h3>권유 이력</h3>'
      + '<div class="hist">' + histHtml(x) + '</div></div>';

    $('#dtBook').addEventListener('click', function () {
      var i = BOOK.indexOf(x.i);
      if (i >= 0) { BOOK.splice(i, 1); toast('관심 주주에서 해제했습니다'); }
      else { BOOK.push(x.i); toast('관심 주주로 등록했습니다'); }
      saveBook(); drawDetail();
    });
    var tel = $('#dtTel'); if (tel) tel.addEventListener('click', editTel);
    $('#dtMemo').addEventListener('click', editMemo);
    $('#dtStart').textContent = x.st === 'done' ? '위임장 확인' : '위임 시작';
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

  function editMemo() {
    sheet({
      title: '메모', body: '<textarea class="ta" id="mmTa" placeholder="방문 시 참고할 내용을 적어 두세요">' + esc(CUR.memo) + '</textarea>',
      foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="mmOk">저장</button>',
      after: function (bx) {
        bx.querySelector('#mmTa').focus();
        bx.querySelector('#mmOk').addEventListener('click', function () {
          APP.setMemo(CUR.i, bx.querySelector('#mmTa').value.trim());
          closeSheet(); drawDetail(); toast('메모를 저장했습니다');
        });
      }
    });
  }
  function editTel() {
    sheet({
      title: '연락처 등록',
      body: '<input id="tlIn" inputmode="tel" placeholder="010-0000-0000" style="width:100%;height:48px;padding:0 14px;border:1px solid #E5E5E5;border-radius:12px;outline:none">',
      foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="tlOk">저장</button>',
      after: function (bx) {
        bx.querySelector('#tlIn').focus();
        bx.querySelector('#tlOk').addEventListener('click', function () {
          var v = bx.querySelector('#tlIn').value.trim(); if (!v) return;
          APP.setTel(CUR.i, v); closeSheet(); drawDetail(); toast('연락처를 등록했습니다');
        });
      }
    });
  }

  /* 방문 상태 변경 */
  $('#dtState').addEventListener('click', function () {
    sheet({
      title: '방문 상태 변경',
      body: '<div style="padding:4px 0 8px">' + APP.STATE_ORDER.map(function (k) {
        return '<button class="opt" type="button" data-sst="' + k + '"><span class="cb rd' + (CUR.st === k ? ' on' : '') + '"></span>'
          + '<span class="sp">' + ST[k].nm + '</span><span class="bg ' + ST[k].cls + '">' + ST[k].nm.slice(0, 2) + '</span></button>';
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

  /* 위임 시작 — 위임 완료까지 3단계 */
  $('#dtStart').addEventListener('click', function () {
    if (CUR.st === 'done') {
      sheet({
        mid: true, title: '위임장', body: '<b style="color:#171717">' + esc(CUR.name) + '</b> 님의 위임장은 검증까지 끝났습니다.<br>'
          + '행사 주식 ' + cm(CUR.sh) + '주 · 처리 ' + esc(CUR.at || '2026-09-26 15:20'),
        foot: '<button class="btn" type="button" data-ovx>확인</button>'
      });
      return;
    }
    proxyStep(1);
  });
  function proxyStep(n) {
    if (n === 1) {
      sheet({
        title: '본인 확인',
        body: '<b style="color:#171717">' + esc(CUR.name) + '</b> 님께 신분증과 주주 확인을 요청하세요.<br>'
          + '보유 주식 ' + cm(CUR.sh) + '주 · ' + esc(CUR.org)
          + '<div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#F7F8FA;font-size:12px;line-height:1.6">'
          + '확인이 끝나면 다음 단계에서 의안별 의결권 행사 방향을 함께 정합니다.</div>',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="pxN">확인했습니다</button>',
        after: function (bx) { bx.querySelector('#pxN').addEventListener('click', function () { proxyStep(2); }); }
      });
      return;
    }
    if (n === 2) {
      var AG = (CX.agenda || []).filter(function (a) { return !a.header; });
      if (!AG.length) AG = [{ no: '제1호', nm: '재무제표 승인의 건' }];
      sheet({
        title: '의결권 행사 방향',
        body: '<div style="padding:2px 0 8px">' + AG.slice(0, 5).map(function (a, i) {
          return '<div style="padding:12px 0;border-bottom:1px solid #F5F5F5">'
            + '<div style="font-size:14px;font-weight:700;color:#171717">' + esc(a.no || ('제' + (i + 1) + '호')) + ' · ' + esc(a.nm || a.name || '') + '</div>'
            + '<div style="display:flex;gap:6px;margin-top:8px" data-ag="' + i + '">'
            + ['찬성', '반대', '기권'].map(function (c, ci) {
              return '<button class="chip' + (ci === 0 ? ' sel' : '') + '" type="button" data-c="' + c + '" style="flex:1;justify-content:center;height:36px">' + c + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="pxN2">위임장 작성</button>',
        after: function (bx) {
          bx.querySelectorAll('[data-ag]').forEach(function (r) {
            r.querySelectorAll('[data-c]').forEach(function (b) {
              b.addEventListener('click', function () {
                r.querySelectorAll('[data-c]').forEach(function (o) { o.classList.remove('sel'); });
                b.classList.add('sel');
              });
            });
          });
          bx.querySelector('#pxN2').addEventListener('click', function () { proxyStep(3); });
        }
      });
      return;
    }
    sheet({
      title: '위임장 서명',
      body: '<div style="border:1px dashed #E5E5E5;border-radius:12px;height:140px;display:flex;align-items:center;'
        + 'justify-content:center;color:#A3A3A3;font-size:13px">이 영역에 주주가 직접 서명합니다</div>'
        + '<div style="margin-top:12px;font-size:12px;line-height:1.6">서명을 마치면 위임장이 CONEXUS 로 바로 전송되고, '
        + '사전 의결권 현황의 실시간 주주 확보 현황에 반영됩니다.</div>',
      foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="pxOk">서명 완료 · 전송</button>',
      after: function (bx) {
        bx.querySelector('#pxOk').addEventListener('click', function () {
          APP.setState(CUR.i, 'done'); closeSheet(); drawDetail();
          toast(CUR.name + ' 님 위임 완료 — CONEXUS 로 전송했습니다');
        });
      }
    });
  }

  /* ══ 수집현황 ════════════════════════════════ */
  function gauge(pct) {
    var r = 46, c = Math.PI * r, off = c * (1 - Math.min(1, pct / 100));
    var col = pct >= 100 ? '#059669' : pct >= 60 ? '#0071F3' : '#F97316';
    return '<div class="gauge"><svg viewBox="0 0 110 58" width="110" height="58">'
      + '<path d="M9 52 A46 46 0 0 1 101 52" fill="none" stroke="#EEF0F3" stroke-width="10" stroke-linecap="round"/>'
      + '<path d="M9 52 A46 46 0 0 1 101 52" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round"'
      + ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>'
      + '</svg><div class="pc">' + pct + '%<small>달성</small></div></div>';
  }
  function dday(due) {
    var d = Math.ceil((new Date(due + 'T00:00:00') - new Date('2026-09-30T00:00:00')) / 86400000);
    return d;
  }
  function drawStat() {
    $('#statBd').innerHTML = APP.CAMPAIGNS.map(function (c) {
      var s = APP.stat(c.id), dd = dday(c.due);
      var live = c.state === 'live';
      return '<div class="cmp"><div class="l1"><span class="co">' + esc(c.org) + '</span>'
        + (live ? (dd > 0 ? '<span class="bg blue">D-' + dd + '</span>'
          : dd === 0 ? '<span class="bg blue">D-DAY</span>' : '<span class="bg red">마감 임박</span>')
          : '<span class="bg gray">종료</span>')
        + '</div><div class="tm">' + esc(c.term) + '</div>'
        + '<div class="gg">'
        + '<div class="g"><div class="lb">주주 확보</div><div class="vl">' + cm(s.sh) + '<small>명</small></div>'
        + '<div class="gl">목표 ' + cm(s.goalSh) + '명</div></div>'
        + '<div class="g"><div class="lb">주식 수 확보</div><div class="vl">' + cm(s.vt) + '<small>주</small></div>'
        + '<div class="gl">목표 ' + cm(s.goalVt) + '주</div></div>'
        + '<div class="g" style="padding-top:10px">' + gauge(s.pct) + '</div>'
        + '</div>'
        + '<div class="due"><i class="ph ph-calendar-blank"></i>마감일 ' + esc(c.due)
        + (live ? ' · 남은 기간 안에 위임장 검증까지 끝나야 반영됩니다' : ' · 마감된 캠페인입니다') + '</div>'
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
      '<button class="prof" type="button" data-help="내 프로필"><div class="av"><i class="ph-fill ph-user"></i></div>'
      + '<div class="c"><div class="nm">' + esc(a.id) + '</div>'
      + '<div class="id">현장 파트너 · 위임 완료 ' + cm(done) + '건</div></div><i class="ph ph-caret-right"></i></button>'

      + '<div class="grp">'
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

      + '<div class="grp"><button class="li" type="button" id="setReset"><i class="ph ph-arrow-counter-clockwise"></i>'
      + '<span class="t">시연 데이터 초기화</span><i class="ph ph-caret-right"></i></button>'
      + '<button class="li" type="button" id="setOut"><i class="ph ph-sign-out"></i>'
      + '<span class="t">로그아웃</span><i class="ph ph-caret-right"></i></button></div>'
      + '<div class="ver">CONEXUS 의결권 위임 플랫폼 · 시연용</div>';

    $('#setNoti').innerHTML = '<button class="li" type="button" id="setNotiBtn"><i class="ph ph-bell"></i>'
      + '<span class="t">알림 설정</span><span class="r">' + notiOn() + '개 켜짐</span><i class="ph ph-caret-right"></i></button>';
    $('#setNotiBtn').addEventListener('click', openNoti);
    $('#setReset').addEventListener('click', function () {
      sheet({
        mid: true, title: '시연 데이터 초기화',
        body: '앱에서 바꾼 방문 상태 · 메모 · 연락처 · 관심 주주를 모두 지우고 처음 상태로 되돌립니다. '
          + 'CONEXUS 사전 의결권 현황에 넘긴 수집 결과도 함께 지워집니다.',
        foot: '<button class="btn gh" type="button" data-ovx>취소</button><button class="btn" type="button" id="rsOk">초기화</button>',
        after: function (bx) {
          bx.querySelector('#rsOk').addEventListener('click', function () {
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

  /* 위임 결과가 바뀌면 현황·목록을 다시 그린다 */
  window.addEventListener('cx-collect', function () {
    if (curTab === 'stat') drawStat();
  });
})();
