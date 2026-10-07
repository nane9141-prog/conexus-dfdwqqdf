/* 전자주주총회 관리 · 진행 설정 — 카드별 토글·일정·규칙, 한 번에 저장
   - 진행 시간 예약을 켠 채로 일시가 비면 저장 불가
   - 사전 신청 · 사전 질의 종료는 총회 전날 24:00 까지, 대리인 신청 시작은 사전 신청 시작 이후
   - 당일 질의 · 당일 발언은 둘 다 끌 수 없음 */
(function () {
  var root = document.getElementById('pgRoot');
  if (!root || !window.EM) return;
  var M = (window.CX && CX.meeting) || { date: '2026-09-29' };
  var D = M.date, PREV = (function () { var d = new Date(D + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + EM.p2(d.getMonth() + 1) + '-' + EM.p2(d.getDate()); })();

  function sw(k, on) { return '<button type="button" class="pg-sw' + (on ? ' on' : '') + '" data-pgsw="' + k + '" role="switch" aria-checked="' + !!on + '"></button>'; }
  function card(k, t, d, inner, on, w) {
    return '<section class="pg-card' + (on === false ? ' off' : '') + '" data-card="' + k + '"><div class="pg-top"><div><div class="pg-t">' + t + '</div><div class="pg-d">' + d + '</div></div>' + (on == null ? '' : sw(k, on)) + '</div>' + (inner ? '<div class="pg-body">' + inner + '</div>' : '') + '</section>';
  }
  function dt(id, lb, d, t, hint) {
    return '<div class="pg-f" data-dt="' + id + '"><label>' + lb + '</label>' + dtIn(id, d, t) + (hint ? '<div class="hint">' + hint + '</div>' : '') + '<div class="err" hidden></div></div>';
  }
  /* 날짜·시간 트리거 한 쌍 — 값은 hidden input(id+D / id+T) */
  function dtIn(id, d, t, attr) {
    return '<div class="pg-dt"' + (attr || '') + '>' +
      '<button type="button" class="pg-in pk-tr" data-pk="date" data-for="' + id + 'D"><i class="ph ph-calendar-blank"></i><span></span></button><input type="hidden" id="' + id + 'D" value="' + (d || '') + '">' +
      '<label class="pg-in pk-tr t"><i class="ph ph-clock"></i><input id="' + id + 'T" value="' + (t || '') + '" placeholder="00:00" inputmode="numeric" maxlength="5" aria-label="시간"></label></div>';
  }
  function inp(id, lb, v, ph, w) { return '<div class="pg-f"' + (w ? ' style="width:' + w + 'px"' : ' style="flex:1"') + '><label for="' + id + '">' + lb + '</label><input class="pg-in" id="' + id + '" value="' + (v || '') + '" placeholder="' + (ph || '') + '"></div>'; }
  function unit(id, lb, v, u) { return '<div class="pg-f" style="flex:1"><label for="' + id + '">' + lb + '</label><div class="pg-unit"><input id="' + id + '" inputmode="numeric" value="' + v + '"><span>' + u + '</span></div></div>'; }
  function chk(n, lb, on) { return '<label><input type="checkbox" name="' + n + '"' + (on ? ' checked' : '') + '>' + lb + '</label>'; }
  function rad(n, v, lb, on) { return '<label><input type="radio" name="' + n + '" value="' + v + '"' + (on ? ' checked' : '') + '>' + lb + '</label>'; }
  function sel(id, opts, w) { return '<select class="lc-sel pg-sel" id="' + id + '" style="width:' + w + 'px">' + opts.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>'; }

  root.innerHTML = '<div class="pg lc">' +
    '<div class="pg-hd lc-hd"><div><h2>진행 설정</h2><p>전자주주총회 운영에 필요한 진행·질의·발언 설정을 관리합니다.</p></div><button type="button" class="btn dark" id="pgSave" style="height:32px;border-radius:10px">저장</button></div>' +
    card('time', '전자주주총회 진행 시간 예약', '예약 미설정 시, 주주총회 당일에 수동으로 진행합니다.',
      '<div class="pg-row">' + dt('pgStart', '시작 일시', D, '10:00') + dt('pgEnd', '종료 일시', D, '12:00') + '</div>', true) +
    card('open', '주주총회 정보 공개 설정', '공개 설정에 따라 주주PASS - 전자주주총회 사이트에 주주총회 설정 정보가 제공됩니다.',
      '<div class="pg-rad" style="align-items:center">' + rad('pgOpen', 'now', '즉시 공개') + rad('pgOpen', 'rsv', '예약 공개', 1) + dtIn('pgOpenT', '2026-09-04', '10:30', ' id="pgOpenAt"') + '</div>') +
    card('late', '전자주주총회 중도입장 허용', '주주총회 개회 후에도 주주의 실시간 온라인 입장을 허용합니다.', '', true) +
    card('apply', '사전 신청 기간', '주주들이 주주총회 당일 전자주주총회 시청 및 참여를 위해 미리 신청하는 기간을 설정합니다.',
      '<div class="pg-row">' + dt('pgApS', '시작 일시', '2026-09-11', '09:00') + dt('pgApE', '종료 일시', PREV, '23:59', '총회 전날 24:00까지 설정할 수 있습니다.') + '</div>', true) +
    card('proxy', '대리인 신청 기간', '주주가 본인 대신 대리인을 지정하여 전자주주총회에 참석 및 의결권을 행사할 수 있도록 신청받는 기간입니다.',
      '<div class="pg-row">' + dt('pgPxS', '시작 일시', '2026-09-11', '09:00', '사전 신청 시작 이후로 설정해 주세요.') + dt('pgPxE', '종료 일시', PREV, '18:00') + '</div>', true) +
    card('preq', '사전 질의 운영 설정', '주총 개최 전, 지정된 사전 기간 동안 주주들이 미리 질문을 등록하고 수정할 수 있도록 허용합니다.',
      '<div class="pg-row">' + dt('pgPqS', '시작 일시', '2026-09-11', '09:00') + dt('pgPqE', '종료 일시', PREV, '23:59', '총회 전날 24:00까지 설정할 수 있습니다.') + '</div>' +
      '<div class="pg-row">' + unit('pgPqN', '질의 횟수', '3', '회') + unit('pgPqL', '작성 분량', '1,000', '자') + '</div>' +
      '<div class="pg-row">' + inp('pgPqNote', '사전질의 주의사항 (선택)', '', '주주에게 안내할 주의사항을 입력해 주세요') + '</div><div class="pg-hr"></div>' +
      '<div class="pg-f"><span class="pg-lb">주주 권한 설정</span><div class="pg-chk">' + chk('pqAuth', '질의 수정 허용', 1) + chk('pqAuth', '질의 삭제 허용', 1) + '</div></div>' +
      '<div class="pg-f"><span class="pg-lb">관리자 알림 설정</span><div class="pg-chk">' + chk('pqNoti', '신규 질의 등록 시 알림 받기', 1) + '</div><div class="pg-row">' + inp('pgPqMail', '수신 이메일', 'ir@kudoselectric.com', 'name@example.com') + inp('pgPqTel', '수신 휴대폰번호', '010-2345-6789', '010-0000-0000') + '</div></div>', true) +
    card('ask', '당일 질의 규칙', '전자주주총회 진행 중 텍스트 질의 등록 시 적용되는 제한 규칙을 설정합니다.',
      '<div class="pg-f"><label for="pgAskBy">질의 기준</label>' + sel('pgAskBy', ['의안별', '주총 전체'], 200) + '</div>' +
      '<div class="pg-chk">' + chk('askOnlyCur', '진행 중인 의안에만 질의 허용', 1) + '</div>' +
      '<div class="pg-row">' + unit('pgAskN', '1인당 질의 횟수', '3', '회') + unit('pgAskL', '질의 글자 수 제한', '500', '자') + unit('pgAskGap', '질의 간격', '30', '초') + '</div>' +
      '<div class="pg-f"><span class="pg-lb">주주 권한 설정</span><div class="pg-chk">' + chk('askAuth', '수정 허용') + chk('askAuth', '삭제 허용', 1) + chk('askAuth', '질의 취소 시 횟수 차감 제외') + '</div></div>' +
      '<div class="pg-f"><span class="pg-lb">질의 공개 범위</span><div class="pg-rad">' + rad('askOpen', 'all', '전체 공개', 1) + rad('askOpen', 'me', '비공개(작성자 본인만 확인)') + '</div></div>', true) +
    card('speak', '당일 발언 규칙', '총회 당일 주주가 음성으로 발언을 신청하는 규칙입니다.',
      '<div class="pg-row"><div class="pg-f" style="flex:1"><label for="pgSpBy">발언 기준</label>' + sel('pgSpBy', ['의안별', '주총 전체'], 176).replace('width:176px', 'width:100%') + '</div>' +
        unit('pgSpN', '1인당 발언 횟수', '1', '회') + unit('pgSpT', '1회 발언 시간', '3', '분') + '</div>' +
      '<div class="pg-chk">' + chk('spAuth', '질의 취소 시 횟수 차감 제외') + chk('spAuth', '발언신청 삭제 허용', 1) + '</div>', true) +
    /* 당일 동의 규칙 — 당일 발언 규칙과 같은 구성 */
    card('amend', '당일 동의 규칙', '총회 당일 주주가 동의를 신청하는 규칙입니다.',
      '<div class="pg-row"><div class="pg-f" style="flex:1"><label for="pgAmBy">동의 기준</label>' + sel('pgAmBy', ['의안별', '주총 전체'], 176).replace('width:176px', 'width:100%') + '</div>' +
        unit('pgAmN', '1인당 동의 횟수', '1', '회') + unit('pgAmT', '1회 발언 시간', '3', '분') + '</div>' +
      '<div class="pg-chk">' + chk('amAuth', '동의 취소 시 횟수 차감 제외') + chk('amAuth', '동의신청 삭제 허용', 1) + '</div>', true) +
    card('cc', 'AI 자막 언어 설정', '라이브 화면에 노출할 AI 실시간 자막 언어를 선택합니다.',
      '<div class="pg-chk">' + chk('cc', '한국어', 1) + chk('cc', '영어', 1) + chk('cc', '일본어') + chk('cc', '중국어') + '</div>') +
    '</div>';

  var save = document.getElementById('pgSave');
  function $(id) { return document.getElementById(id); }
  function at(id) { var d = $(id + 'D').value, t = $(id + 'T').value; return d && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? d + 'T' + t : ''; }
  function on(k) { var s = root.querySelector('[data-pgsw="' + k + '"]'); return !s || s.classList.contains('on'); }
  function err(id, m) {
    var f = root.querySelector('[data-dt="' + id + '"]'), e = f.querySelector('.err');
    e.hidden = !m; e.textContent = m || '';
    f.querySelectorAll('.pg-in').forEach(function (i) { i.classList.toggle('bad', !!m); });
    return !m;
  }
  var LIMIT = PREV + 'T23:59';
  function validate() {
    var ok = true;
    if (on('time')) {
      ok = err('pgStart', at('pgStart') ? '' : '시작 일시를 입력해 주세요.') && ok;
      ok = err('pgEnd', !at('pgEnd') ? '종료 일시를 입력해 주세요.' : at('pgEnd') <= at('pgStart') ? '종료 일시는 시작 일시 이후여야 합니다.' : '') && ok;
    } else { err('pgStart'); err('pgEnd'); }
    ok = err('pgApE', on('apply') && at('pgApE') > LIMIT ? '총회 전날 24:00 이후로 설정할 수 없습니다.' : '') && ok;
    ok = err('pgPqE', on('preq') && at('pgPqE') > LIMIT ? '총회 전날 24:00 이후로 설정할 수 없습니다.' : '') && ok;
    ok = err('pgPxS', on('proxy') && on('apply') && at('pgPxS') && at('pgPxS') < at('pgApS') ? '사전 신청 시작 이전으로 설정할 수 없습니다.' : '') && ok;
    save.disabled = !ok;
    return ok;
  }
  function touch() { EM.setDirty('progress', true); validate(); }

  root.addEventListener('click', function (e) {
    var s = e.target.closest('[data-pgsw]'); if (!s) return;
    var k = s.dataset.pgsw, next = !s.classList.contains('on');
    if (!next && (k === 'ask' || k === 'speak') && !on(k === 'ask' ? 'speak' : 'ask')) {
      return EM.alertDlg({ ic: 'info', t: '질의와 발언을 모두 끌 수 없습니다', d: '당일 질의 또는 당일 발언 중 하나 이상은 켜 두어야 합니다.' });
    }
    s.classList.toggle('on', next); s.setAttribute('aria-checked', next);
    s.closest('.pg-card').classList.toggle('off', !next);
    touch();
  });
  /* 시간 칸: 포커스하면 전체 선택, 이미 다 찬 상태에서 숫자를 치면 비우고 새로 입력 — 기존 값을 덮어쓴다 */
  function isTime(t) { return /T$/.test(t.id) && t.closest && t.closest('.pk-tr'); }
  root.addEventListener('focusin', function (e) { var t = e.target; if (isTime(t)) setTimeout(function () { t.select(); }); });
  root.addEventListener('keydown', function (e) {
    var t = e.target;
    if (isTime(t) && /^\d$/.test(e.key) && t.value.length >= 5 && t.selectionStart === t.selectionEnd) t.value = '';
  });
  root.addEventListener('input', function (e) {
    /* 시간 직접 입력 — 숫자만 받아 HH:MM 으로 맞춘다 */
    var t = e.target;
    if (/T$/.test(t.id) && t.closest('.pk-tr')) { var d = t.value.replace(/\D/g, '').slice(0, 4); t.value = d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d; }
    touch();
  });
  root.addEventListener('change', function (e) {
    if (e.target.name === 'pgOpen') $('pgOpenAt').style.display = e.target.value === 'now' ? 'none' : '';
    touch();
  });
  /* 당일 질의 · 발언 · 동의 규칙 — 저장하면 시청 화면(주주PASS)이 같은 횟수로 받는다(cx.rules) */
  function num(id, d) { var v = parseInt(($(id) || {}).value, 10); return v > 0 ? v : d; }
  function saveRules() {
    var r = { ask: { on: on('ask'), n: num('pgAskN', 3) }, speak: { on: on('speak'), n: num('pgSpN', 1), t: num('pgSpT', 3) },
              amend: { on: on('amend'), n: num('pgAmN', 1), t: num('pgAmT', 3) }, ts: Date.now() };
    try { localStorage.setItem('cx.rules', JSON.stringify(r)); } catch (e) {}
  }
  (function restoreRules() {
    var r = null; try { r = JSON.parse(localStorage.getItem('cx.rules') || 'null'); } catch (e) {}
    if (!r) return;
    [['ask', 'pgAskN'], ['speak', 'pgSpN'], ['amend', 'pgAmN']].forEach(function (k) {
      var v = r[k[0]]; if (!v) return;
      if ($(k[1]) && v.n) $(k[1]).value = v.n;
      var sw = root.querySelector('[data-pgsw="' + k[0] + '"]');
      if (sw && v.on === false) { sw.classList.remove('on'); sw.setAttribute('aria-checked', false); sw.closest('.pg-card').classList.add('off'); }
    });
    if (r.speak && r.speak.t && $('pgSpT')) $('pgSpT').value = r.speak.t;
    if (r.amend && r.amend.t && $('pgAmT')) $('pgAmT').value = r.amend.t;
  })();
  save.addEventListener('click', function () {
    if (!validate()) return;
    saveRules();
    EM.setDirty('progress', false); EM.markDone('progress'); EM.toast('저장되었습니다');
  });
  /* ---------- 날짜 피커 (DS Calendar 규격: 셀 28 · nav 28 · 오늘 muted · 선택 primary) ---------- */
  var pop = document.createElement('div'); pop.className = 'pk-pop'; document.body.appendChild(pop);
  var pkBtn = null, pkMonth = null, TODAY = (function () { var d = new Date(); return d.getFullYear() + '-' + EM.p2(d.getMonth() + 1) + '-' + EM.p2(d.getDate()); })();
  function paintTr(b) {
    var v = $(b.dataset.for).value, sp = b.querySelector('span');
    sp.textContent = v ? v.replace(/-/g, '. ') + '.' : '날짜 선택';
    sp.className = v ? '' : 'ph-t';
  }
  root.querySelectorAll('[data-pk]').forEach(paintTr);
  function setVal(v) { $(pkBtn.dataset.for).value = v; paintTr(pkBtn); touch(); }
  function calHtml() {
    var y = pkMonth.getFullYear(), m = pkMonth.getMonth(), first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), sel = $(pkBtn.dataset.for).value, h = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = d.getFullYear() + '-' + EM.p2(d.getMonth() + 1) + '-' + EM.p2(d.getDate());
      if (i % 7 === 0) h += '<div class="wk">';
      h += '<button type="button" data-day="' + k + '" class="' + (d.getMonth() !== m ? 'out ' : '') + (k === TODAY ? 'today ' : '') + (k === sel ? 'on' : '') + '">' + d.getDate() + '</button>';
      if (i % 7 === 6) h += '</div>';
    }
    return '<div class="cap"><button type="button" class="nav" data-mv="-1" aria-label="이전 달"><i class="ph ph-caret-left"></i></button><b>' + y + '년 ' + (m + 1) + '월</b><button type="button" class="nav" data-mv="1" aria-label="다음 달"><i class="ph ph-caret-right"></i></button></div>' +
      '<div class="wd">' + ['일', '월', '화', '수', '목', '금', '토'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' + h;
  }
  function paintPop() {
    pop.className = 'pk-pop on ' + pkBtn.dataset.pk;
    pop.innerHTML = calHtml();
  }
  function closePk() { pop.className = 'pk-pop'; if (pkBtn) pkBtn.classList.remove('open'); pkBtn = null; }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pk]'); if (!b) return;
    if (pkBtn === b) return closePk();
    closePk(); pkBtn = b; b.classList.add('open');
    var v = $(b.dataset.for).value; pkMonth = v ? new Date(v + 'T00:00:00') : new Date(); pkMonth.setDate(1);
    paintPop();
    var r = b.getBoundingClientRect(), top = r.bottom + 4;
    if (top + pop.offsetHeight > innerHeight - 8) top = r.top - 4 - pop.offsetHeight;
    pop.style.left = r.left + 'px'; pop.style.top = top + 'px';
    e.stopPropagation();
  });
  pop.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.mv) { pkMonth.setMonth(pkMonth.getMonth() + +b.dataset.mv); return paintPop(); }
    if (b.dataset.day) { setVal(b.dataset.day); closePk(); }
  });
  document.addEventListener('click', function (e) { if (pkBtn && !e.target.closest('.pk-pop')) closePk(); });
  window.addEventListener('scroll', function (e) { if (pkBtn && !pop.contains(e.target)) closePk(); }, true);


  validate();
})();
