const weekDateInput = document.getElementById('week-date');
const memberSelect  = document.getElementById('member-name');
const wpFile        = document.getElementById('wp-file');
const fileNameEl    = document.getElementById('file-name');
const fileDrop      = document.getElementById('file-drop');
const submitBtn     = document.getElementById('submit-btn');

let nextFriday = null;
let deadlinePassed = false;

// 마감 여부
function isDeadlinePassed(fridayDateStr) {
  const now = new Date();
  if (now.getDay() === 5) return true; // 금요일 당일
  const friday = new Date(fridayDateStr + 'T00:00:00');
  const deadline = new Date(friday);
  deadline.setDate(friday.getDate() - 2); // 수요일
  deadline.setHours(12, 0, 0, 0);
  return now > deadline;
}

function lockUpload() {
  submitBtn.disabled = true;
  submitBtn.textContent = '마감됨';
  fileDrop.style.opacity = '0.5';
  fileDrop.style.pointerEvents = 'none';
}

// 멤버 목록 + 제출 현황 로드
async function loadAll() {
  const [membersRes, submissionsRes] = await Promise.all([
    sbHero.from('members').select('company_name').order('sort_order', { ascending: true }),
    sb.from('ppt_submissions').select('member_name').eq('week_date', nextFriday).eq('type', 'wp')
  ]);

  const members = (membersRes.data || []);
  const submitted = new Set((submissionsRes.data || []).map(s => s.member_name));

  // 드롭다운
  memberSelect.innerHTML = '<option value="">선택해주세요</option>' +
    members.map(m => `<option value="${m.company_name}">${m.company_name}</option>`).join('');

  // 제출 현황 리스트
  const list = document.getElementById('status-list');
  if (!members.length) {
    list.innerHTML = '<div class="loading">멤버 정보를 불러올 수 없습니다.</div>';
    return;
  }
  list.innerHTML = members.map(m => {
    const done = submitted.has(m.company_name);
    return `<div class="status-item ${done ? 'done' : 'pending'}">
      <span>${m.company_name}</span>
      <span class="badge ${done ? 'badge-done' : 'badge-empty'}">${done ? '제출완료' : '미제출'}</span>
    </div>`;
  }).join('');
}

// 초기화
async function init() {
  try {
    nextFriday = await getNextOfflineMeeting();
  } catch (err) {
    console.error('일정 조회 실패:', err);
  }

  if (!nextFriday) {
    // 오프라인 회의 없음 → 업로드 폼 숨김
    document.getElementById('no-meeting-notice').classList.remove('hidden');
    document.getElementById('upload-section').classList.add('hidden');
    document.getElementById('status-section').classList.add('hidden');
    return;
  }

  // 날짜 세팅
  weekDateInput.value = nextFriday;
  document.getElementById('week-label').textContent =
    `${nextFriday.replace(/-/g, '.')} 회의`;

  // 마감 체크
  deadlinePassed = isDeadlinePassed(nextFriday);
  if (deadlinePassed) {
    document.getElementById('deadline-notice').classList.remove('hidden');
    lockUpload();
  }

  // 멤버 + 현황 로드
  loadAll().catch(err => {
    document.getElementById('status-list').innerHTML = '<div class="loading">불러오기 실패. 새로고침 해주세요.</div>';
    console.error(err);
  });
}

init();

// 파일 선택 표시
wpFile.addEventListener('change', () => {
  fileNameEl.textContent = wpFile.files[0]?.name || '파일을 선택하거나 여기에 끌어다 놓으세요';
});
fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.classList.remove('dragover');
  if (e.dataTransfer.files[0]) {
    wpFile.files = e.dataTransfer.files;
    fileNameEl.textContent = e.dataTransfer.files[0].name;
  }
});

// 제출
const form   = document.getElementById('wp-form');
const result = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (deadlinePassed || !nextFriday) return;

  const memberName = memberSelect.value;
  const file = wpFile.files[0];
  if (!memberName || !file) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중...';
  result.className = 'result hidden';

  try {
    await submitWP(nextFriday, memberName, file);
    result.className = 'result success';
    result.textContent = `✅ ${memberName}님의 WP가 제출되었습니다.`;
    form.reset();
    weekDateInput.value = nextFriday;
    fileNameEl.textContent = '파일을 선택하거나 여기에 끌어다 놓으세요';
    await loadAll();
  } catch (err) {
    result.className = 'result error';
    result.textContent = `❌ 오류: ${err.message}`;
  } finally {
    if (!deadlinePassed) {
      submitBtn.disabled = false;
      submitBtn.textContent = '제출하기';
    }
  }
});
