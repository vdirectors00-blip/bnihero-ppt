// bnihero Supabase에서 멤버 목록 가져오기 (anon key로 SELECT 가능)
const BNIHERO_URL = 'https://dzzjlycqxfqdyqgnqixh.supabase.co';
const BNIHERO_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6empseWNxeGZxZHlxZ25xaXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjU3NTEsImV4cCI6MjA4OTU0MTc1MX0.PBXuSGfe2h-4JNl7dXGKN6WYQ-Jqk21Vt2KD-Fx39Jc';
const sbHero = supabase.createClient(BNIHERO_URL, BNIHERO_ANON);

const weekDateInput = document.getElementById('week-date');
const memberSelect = document.getElementById('member-name');
const wpFile = document.getElementById('wp-file');
const fileNameEl = document.getElementById('file-name');
const fileDrop = document.getElementById('file-drop');

// 다음 금요일 자동 세팅 (hidden)
const nextFriday = getNextFriday();
weekDateInput.value = nextFriday;

// 마감 여부 체크: 금요일 기준 수요일 정오까지
function isDeadlinePassed(fridayDateStr) {
  const now = new Date();
  // 금요일 당일은 마감 (토요일부터 다음 주 창구 열림)
  if (now.getDay() === 5) return true;
  // 수요일 정오 이후 마감
  const friday = new Date(fridayDateStr + 'T00:00:00');
  const deadline = new Date(friday);
  deadline.setDate(friday.getDate() - 2); // 수요일
  deadline.setHours(12, 0, 0, 0);         // 정오
  return now > deadline;
}

function showLocked() {
  document.getElementById('wp-form').classList.add('hidden');
  const locked = document.getElementById('locked-msg');
  locked.classList.remove('hidden');
}

if (isDeadlinePassed(nextFriday)) {
  showLocked();
}

// 멤버 드롭다운 로드
async function loadMembers() {
  const { data, error } = await sbHero.from('members')
    .select('company_name').order('sort_order', { ascending: true });

  if (error || !data?.length) {
    memberSelect.innerHTML = '<option value="">멤버 목록 로드 실패 - 새로고침 해주세요</option>';
    return;
  }

  memberSelect.innerHTML = '<option value="">선택해주세요</option>' +
    data.map(m => `<option value="${m.company_name}">${m.company_name}</option>`).join('');
}

loadMembers();

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
    const dt = e.dataTransfer;
    wpFile.files = dt.files;
    fileNameEl.textContent = dt.files[0].name;
  }
});

// 폼 제출
const form = document.getElementById('wp-form');
const submitBtn = document.getElementById('submit-btn');
const result = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const weekDate = weekDateInput.value;
  const memberName = memberSelect.value;
  const file = wpFile.files[0];

  if (!memberName || !file) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중...';
  result.className = 'result hidden';

  try {
    await submitWP(weekDate, memberName, file);
    result.className = 'result success';
    result.textContent = `✅ 제출 완료! ${memberName}님의 WP가 등록되었습니다.`;
    form.reset();
    weekDateInput.value = getNextFriday();
    fileNameEl.textContent = '파일을 선택하거나 여기에 끌어다 놓으세요';
    await loadMembers();
  } catch (err) {
    result.className = 'result error';
    result.textContent = `❌ 오류: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '제출하기';
  }
});
