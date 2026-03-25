// ── 로그인 ────────────────────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const adminScreen = document.getElementById('admin-screen');

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) {
    errEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
    errEl.classList.remove('hidden');
  } else {
    showAdmin();
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  loginScreen.classList.remove('hidden');
  adminScreen.classList.add('hidden');
});

// 세션 체크
sb.auth.getSession().then(({ data }) => {
  if (data.session) showAdmin();
});

function showAdmin() {
  loginScreen.classList.add('hidden');
  adminScreen.classList.remove('hidden');
  // 다음 금요일 기본값
  const dateInput = document.getElementById('admin-week-date');
  dateInput.value = getNextFriday();
  loadSubmissions(dateInput.value);
}

// ── 주차 불러오기 ─────────────────────────────────────────────────────────────
document.getElementById('load-btn').addEventListener('click', () => {
  const date = document.getElementById('admin-week-date').value;
  if (date) loadSubmissions(date);
});

async function loadSubmissions(weekDate) {
  try {
    const subs = await getSubmissions(weekDate);
    updateStatusUI(subs);
    await updateDownloadList(subs, weekDate);

    // 공지사항 로드
    const notice = await getNotice();
    document.getElementById('notice-text').value = notice;

    // 취합 명령어 업데이트
    document.getElementById('merge-command').textContent =
      `python merge.py --date ${weekDate}`;
  } catch (err) {
    console.error(err);
  }
}

// ── 다운로드 목록 ─────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  education: '네트워킹 교육',
  vice_chair: '부의장 자료',
  feature: '피처 프레젠테이션',
  wp: 'WP',
  result: '📎 최종 장표'
};

async function updateDownloadList(subs, weekDate) {
  const list = document.getElementById('download-list');

  // 최종 결과물도 조회
  const { data: resultSubs } = await sb.from('ppt_submissions')
    .select('*').eq('week_date', weekDate).eq('type', 'result');

  const allSubs = [...(resultSubs || []), ...subs];

  if (!allSubs.length) {
    list.innerHTML = '<div class="loading">이 주차에 업로드된 파일이 없습니다.</div>';
    return;
  }

  const rows = await Promise.all(allSubs.map(async (s) => {
    try {
      const { data } = await sb.storage.from('ppt-uploads').createSignedUrl(s.file_path, 3600);
      const label = s.type === 'wp'
        ? `WP — ${s.member_name}`
        : (TYPE_LABELS[s.type] || s.type);
      return `<div class="download-item">
        <span>${label}</span>
        <a href="${data.signedUrl}" download class="dl-btn">다운로드</a>
      </div>`;
    } catch {
      return '';
    }
  }));

  list.innerHTML = rows.join('');
}

function updateStatusUI(subs) {
  const types = ['education', 'vice_chair', 'feature'];
  types.forEach(type => {
    const el = document.getElementById(`status-${type}`);
    const found = subs.find(s => s.type === type);
    if (found) {
      el.textContent = '제출완료';
      el.className = 'badge badge-done';
    } else {
      el.textContent = '미제출';
      el.className = 'badge badge-empty';
    }
  });

  const wpSubs = subs.filter(s => s.type === 'wp');
  const wpBadge = document.getElementById('status-wp');
  wpBadge.textContent = `${wpSubs.length}명`;
  wpBadge.className = wpSubs.length > 0 ? 'badge badge-done' : 'badge badge-empty';

  const wpList = document.getElementById('wp-list');
  if (wpSubs.length > 0) {
    wpList.innerHTML = wpSubs.map(s =>
      `<div class="wp-item">✅ ${s.member_name} — ${s.original_filename}</div>`
    ).join('');
    wpList.classList.remove('hidden');
  } else {
    wpList.classList.add('hidden');
  }
}

// ── 섹션 업로드 ───────────────────────────────────────────────────────────────
document.querySelectorAll('.upload-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type = btn.dataset.type;
    const fileInput = document.getElementById(`file-${type}`);
    const file = fileInput.files[0];
    const weekDate = document.getElementById('admin-week-date').value;

    if (!file) { alert('파일을 선택해주세요.'); return; }
    if (!weekDate) { alert('주차를 먼저 선택해주세요.'); return; }

    btn.disabled = true;
    btn.textContent = '업로드 중...';
    try {
      await uploadSection(weekDate, type, file);
      btn.textContent = '완료!';
      setTimeout(() => { btn.textContent = '업로드'; btn.disabled = false; }, 2000);
      loadSubmissions(weekDate);
    } catch (err) {
      alert(`업로드 실패: ${err.message}`);
      btn.textContent = '업로드';
      btn.disabled = false;
    }
  });
});

// ── 공지사항 저장 ─────────────────────────────────────────────────────────────
document.getElementById('save-notice-btn').addEventListener('click', async () => {
  const text = document.getElementById('notice-text').value;
  try {
    await saveNotice(text);
    const btn = document.getElementById('save-notice-btn');
    btn.textContent = '저장됨!';
    setTimeout(() => { btn.textContent = '저장'; }, 2000);
  } catch (err) {
    alert(`저장 실패: ${err.message}`);
  }
});

// ── 명령어 복사 ───────────────────────────────────────────────────────────────
document.getElementById('copy-cmd-btn').addEventListener('click', () => {
  const cmd = document.getElementById('merge-command').textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById('copy-cmd-btn');
    btn.textContent = '복사됨!';
    setTimeout(() => { btn.textContent = '복사'; }, 2000);
  });
});
