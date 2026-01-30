// 从 URL 中提取并归一化搜索 query（decode / trim / lowercase）
function getQuery() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q == null || q === '') return '';
  try {
    const decoded = decodeURIComponent(q);
    return decoded.trim().toLowerCase();
  } catch {
    return q.trim().toLowerCase();
  }
}
