const SUPABASE_URL = 'https://gyomwkviuxlcdqfqtcif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b213a3ZpdXhsY2RxZnF0Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjM5MTAsImV4cCI6MjA4OTk5OTkxMH0.WlUacpMuBvfCtcXaPFEIF-DAIWtaGvOC6QQoZarIKtY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 다음 금요일 날짜 반환 (YYYY-MM-DD)
function getNextFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
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
