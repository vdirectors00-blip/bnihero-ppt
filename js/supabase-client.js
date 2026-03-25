// bnippt Supabase (PPT 제출/저장)
const SUPABASE_URL = 'https://gyomwkviuxlcdqfqtcif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b213a3ZpdXhsY2RxZnF0Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjM5MTAsImV4cCI6MjA4OTk5OTkxMH0.WlUacpMuBvfCtcXaPFEIF-DAIWtaGvOC6QQoZarIKtY';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// bnihero Supabase (회원 목록 + 일정)
const BNIHERO_URL  = 'https://dzzjlycqxfqdyqgnqixh.supabase.co';
const BNIHERO_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6empseWNxeGZxZHlxZ25xaXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjU3NTEsImV4cCI6MjA4OTU0MTc1MX0.PBXuSGfe2h-4JNl7dXGKN6WYQ-Jqk21Vt2KD-Fx39Jc';
const sbHero = supabase.createClient(BNIHERO_URL, BNIHERO_ANON);

// 날짜 포맷 헬퍼
function _fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// bnihero schedule 테이블 기준으로 다음 오프라인 회의 금요일 반환
// 온라인/취소로 명시된 날짜 제외. 없으면 null 반환.
async function getNextOfflineMeeting() {
  const today = new Date();
  const fromDate = _fmt(today);

  const endD = new Date(fromDate + 'T00:00:00');
  endD.setDate(endD.getDate() + 84); // 12주 앞까지 조회

  const { data, error } = await sbHero
    .from('schedule')
    .select('meeting_date, meeting_type')
    .gte('meeting_date', fromDate)
    .lte('meeting_date', _fmt(endD))
    .order('meeting_date', { ascending: true });

  if (error) throw error;

  // online/cancelled 로 명시된 날짜 집합
  const blocked = new Set();
  (data || []).forEach(s => {
    if (s.meeting_type !== 'offline') blocked.add(s.meeting_date);
  });

  // 오늘 이후 첫 금요일로 이동
  const d = new Date(fromDate + 'T00:00:00');
  const daysToFri = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysToFri);

  // 최대 12주 금요일 순회
  for (let i = 0; i < 12; i++) {
    const dateStr = _fmt(d);
    if (!blocked.has(dateStr)) return dateStr;
    d.setDate(d.getDate() + 7);
  }
  return null;
}

// WP 제출
async function submitWP(weekDate, memberName, file) {
  const ext = file.name.split('.').pop();
  const path = `${weekDate}/wp/${memberName}_${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('ppt-uploads').upload(path, file);
  if (upErr) throw upErr;
  const { error: dbErr } = await sb.from('ppt_submissions').insert([{
    week_date: weekDate,
    type: 'wp',
    member_name: memberName,
    file_path: path,
    original_filename: file.name
  }]);
  if (dbErr) throw dbErr;
}

// ST: 섹션 파일 업로드 (education, vice_chair, feature)
async function uploadSection(weekDate, type, file) {
  const ext = file.name.split('.').pop();
  const path = `${weekDate}/${type}/${type}_${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('ppt-uploads').upload(path, file, { upsert: true });
  if (upErr) throw upErr;
  // 기존 레코드 삭제 후 재등록
  await sb.from('ppt_submissions').delete().eq('week_date', weekDate).eq('type', type);
  const { error: dbErr } = await sb.from('ppt_submissions').insert([{
    week_date: weekDate,
    type: type,
    file_path: path,
    original_filename: file.name
  }]);
  if (dbErr) throw dbErr;
}

// 해당 주 제출 현황 조회
async function getSubmissions(weekDate) {
  const { data, error } = await sb.from('ppt_submissions')
    .select('*').eq('week_date', weekDate).order('created_at');
  if (error) throw error;
  return data || [];
}

// 공지사항 조회/저장
async function getNotice() {
  const { data } = await sb.from('ppt_settings').select('value').eq('key', 'notice').single();
  return data?.value || '';
}

async function saveNotice(value) {
  const { error } = await sb.from('ppt_settings').upsert({ key: 'notice', value });
  if (error) throw error;
}
