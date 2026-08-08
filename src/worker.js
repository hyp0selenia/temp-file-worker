/**
 * Cloudflare Temp File Share
 * Workers + R2 + KV
 * Public: max 100MB / 7 days / 100 downloads
 * Admin: no limits (still subject to CF free 100MB body)
 */

const HTML_PUBLIC = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>临时文件分享</title>
  <style>
    :root { --bg:#0f1115; --card:#1a1d24; --text:#e8eaed; --muted:#9aa0a6; --accent:#4f8cff; --border:#2a2f3a; --ok:#3dd68c; --err:#ff6b6b; }
    * { box-sizing: border-box; margin:0; padding:0; }
    body { font-family: system-ui, -apple-system, sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:2rem 1rem; }
    h1 { font-size:1.5rem; margin-bottom:0.5rem; }
    .sub { color:var(--muted); font-size:0.9rem; margin-bottom:2rem; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.5rem; width:100%; max-width:480px; }
    label { display:block; font-size:0.85rem; color:var(--muted); margin-bottom:0.4rem; }
    input[type=file], select { width:100%; padding:0.6rem 0.75rem; border-radius:8px; border:1px solid var(--border); background:#12151b; color:var(--text); margin-bottom:1rem; }
    input[type=file] { padding:0.5rem; }
    .row { display:flex; gap:0.75rem; }
    .row > div { flex:1; }
    button { width:100%; padding:0.75rem; border:none; border-radius:8px; background:var(--accent); color:#fff; font-weight:600; cursor:pointer; font-size:1rem; }
    button:disabled { opacity:0.5; cursor:not-allowed; }
    button:hover:not(:disabled) { filter:brightness(1.1); }
    .result { margin-top:1.25rem; padding:1rem; background:#12151b; border-radius:8px; border:1px solid var(--border); display:none; word-break:break-all; }
    .result.show { display:block; }
    .result a { color:var(--accent); }
    .progress { height:4px; background:var(--border); border-radius:2px; margin-top:0.75rem; overflow:hidden; display:none; }
    .progress > div { height:100%; background:var(--accent); width:0%; transition:width 0.2s; }
    .hint { font-size:0.8rem; color:var(--muted); margin-top:0.5rem; }
    .err { color:var(--err); }
    .ok { color:var(--ok); }
    .admin-link { margin-top:1.5rem; }
    .admin-link a { display:inline-block; padding:0.5rem 1rem; border:1px solid var(--border); border-radius:8px; color:var(--muted); text-decoration:none; font-size:0.85rem; }
    .admin-link a:hover { color:var(--text); border-color:var(--accent); }
  </style>
</head>
<body>
  <h1>临时文件分享</h1>
  <p class="sub">单文件 ≤100MB · 最多 7 天 · 最多 100 次下载</p>
  <div class="card">
    <form id="form">
      <label>选择文件（一次只能一个）</label>
      <input type="file" id="file" required />
      <div class="row">
        <div>
          <label>有效期</label>
          <select id="x7k2m9p">
            <option value="a1">1 天</option>
            <option value="b2">2 天</option>
            <option value="c3">3 天</option>
            <option value="d5">5 天</option>
            <option value="e7" selected>7 天</option>
          </select>
        </div>
        <div>
          <label>最大下载次数</label>
          <select id="q4w8n3r">
            <option value="f1">1 次</option>
            <option value="g5">5 次</option>
            <option value="h10" selected>10 次</option>
            <option value="i20">20 次</option>
            <option value="j50">50 次</option>
            <option value="k100">100 次</option>
          </select>
        </div>
      </div>
      <button type="submit" id="btn">上传并生成链接</button>
      <div class="progress" id="prog"><div id="bar"></div></div>
    </form>
    <div class="result" id="result"></div>
  </div>
  <div class="admin-link"><a href="/admin">管理后台</a></div>
  <script>
    (function(){
      const _m = {a1:1,b2:2,c3:3,d5:5,e7:7,f1:1,g5:5,h10:10,i20:20,j50:50,k100:100};
      const _k1 = 'x7k2m9p', _k2 = 'q4w8n3r';
      const _enc = (n) => btoa(String(n * 17 + 93)).replace(/=+$/,'');
      const form = document.getElementById('form');
      const fileInput = document.getElementById('file');
      const btn = document.getElementById('btn');
      const result = document.getElementById('result');
      const prog = document.getElementById('prog');
      const bar = document.getElementById('bar');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 104857600) {
          result.className = 'result show err';
          result.textContent = '文件超过 100MB 限制';
          return;
        }
        const v1 = document.getElementById(_k1).value;
        const v2 = document.getElementById(_k2).value;
        const days = _m[v1] || 1;
        const maxdl = _m[v2] || 10;

        btn.disabled = true;
        prog.style.display = 'block';
        bar.style.width = '0%';
        result.className = 'result';
        result.innerHTML = '';

        const fd = new FormData();
        fd.append('file', file);
        // 混淆字段名 + 编码值，服务端只认这些，忽略明文 days/maxDownloads
        fd.append('z9f3k7x', _enc(days));
        fd.append('p2m8q5w', _enc(maxdl));
        fd.append('t6h1v4', Date.now().toString(36));

        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload');
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) bar.style.width = Math.round(ev.loaded / ev.total * 100) + '%';
          };
          const res = await new Promise((resolve, reject) => {
            xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.send(fd);
          });
          const data = JSON.parse(res.body);
          if (res.status !== 200) throw new Error(data.error || '上传失败');
          result.className = 'result show ok';
          result.innerHTML = \`链接已生成（\${data.expiresAt} 前有效，最多 \${data.maxDownloads} 次）<br><a href="\${data.url}" target="_blank">\${data.url}</a><br><button type="button" style="margin-top:0.75rem;width:auto;padding:0.4rem 0.8rem" onclick="navigator.clipboard.writeText('\${data.url}')">复制链接</button>\`;
        } catch (err) {
          result.className = 'result show err';
          result.textContent = err.message || '上传失败';
        } finally {
          btn.disabled = false;
          setTimeout(() => { prog.style.display = 'none'; }, 500);
        }
      });
    })();
  </script>
</body>
</html>`;

const HTML_ADMIN = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>管理后台</title>
  <style>
    :root { --bg:#0f1115; --card:#1a1d24; --text:#e8eaed; --muted:#9aa0a6; --accent:#4f8cff; --border:#2a2f3a; --ok:#3dd68c; --err:#ff6b6b; --danger:#e74c3c; }
    * { box-sizing: border-box; margin:0; padding:0; }
    body { font-family: system-ui, -apple-system, sans-serif; background:var(--bg); color:var(--text); min-height:100vh; padding:2rem 1rem; }
    .wrap { max-width:720px; margin:0 auto; }
    h1 { font-size:1.5rem; margin-bottom:0.35rem; }
    .sub { color:var(--muted); font-size:0.9rem; margin-bottom:1.25rem; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.25rem; margin-bottom:1rem; }
    label { display:block; font-size:0.85rem; color:var(--muted); margin-bottom:0.4rem; }
    input, select { width:100%; padding:0.6rem 0.75rem; border-radius:8px; border:1px solid var(--border); background:#12151b; color:var(--text); margin-bottom:0.85rem; }
    button, .btn { padding:0.6rem 1rem; border:none; border-radius:8px; background:var(--accent); color:#fff; font-weight:600; cursor:pointer; font-size:0.9rem; }
    button:disabled { opacity:0.5; cursor:not-allowed; }
    button.danger, .btn.danger { background:var(--danger); }
    button.ghost, .btn.ghost { background:transparent; border:1px solid var(--border); color:var(--muted); }
    .row { display:flex; gap:0.75rem; flex-wrap:wrap; }
    .row > div { flex:1; min-width:120px; }
    .tabs { display:flex; gap:0.5rem; margin-bottom:1rem; }
    .tabs button { flex:0; background:transparent; border:1px solid var(--border); color:var(--muted); }
    .tabs button.active { background:var(--accent); color:#fff; border-color:var(--accent); }
    .result { margin-top:1rem; padding:0.85rem; background:#12151b; border-radius:8px; border:1px solid var(--border); display:none; word-break:break-all; font-size:0.9rem; }
    .result.show { display:block; }
    .result a { color:var(--accent); }
    .progress { height:4px; background:var(--border); border-radius:2px; margin-top:0.75rem; overflow:hidden; display:none; }
    .progress > div { height:100%; background:var(--accent); width:0%; }
    .err { color:var(--err); } .ok { color:var(--ok); }
    .login { max-width:360px; margin:2rem auto; }
    table { width:100%; border-collapse:collapse; font-size:0.85rem; }
    th, td { text-align:left; padding:0.55rem 0.4rem; border-bottom:1px solid var(--border); vertical-align:middle; }
    th { color:var(--muted); font-weight:500; }
    td a { color:var(--accent); }
    .actions { display:flex; gap:0.35rem; flex-wrap:wrap; }
    .actions button { padding:0.3rem 0.55rem; font-size:0.75rem; width:auto; }
    .meta { color:var(--muted); font-size:0.75rem; }
    .empty { color:var(--muted); text-align:center; padding:1.5rem; }
    .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem; }
    .topbar a { color:var(--muted); font-size:0.85rem; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="loginBox" class="card login">
      <h1>管理后台</h1>
      <p class="sub">登录后可上传与管理文件</p>
      <label>管理员密码</label>
      <input type="password" id="pwd" />
      <button id="loginBtn" style="width:100%">登录</button>
    </div>

    <div id="mainBox" style="display:none">
      <div class="topbar">
        <div>
          <h1>管理后台</h1>
          <p class="sub" style="margin:0">无有效期 / 次数限制</p>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <a href="/">← 前台</a>
          <button class="ghost" id="logoutBtn" style="width:auto;padding:0.35rem 0.7rem;font-size:0.8rem">退出</button>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="active" data-tab="upload">上传</button>
        <button type="button" data-tab="list">文件列表</button>
      </div>

      <div id="tab-upload" class="card">
        <form id="form">
          <label>选择文件</label>
          <input type="file" id="file" required />
          <div class="row">
            <div>
              <label>有效期（天，0=永不过期）</label>
              <input type="number" id="days" min="0" value="30" />
            </div>
            <div>
              <label>最大下载次数（0=无限）</label>
              <input type="number" id="maxdl" min="0" value="0" />
            </div>
          </div>
          <button type="submit" id="btn">上传</button>
          <div class="progress" id="prog"><div id="bar"></div></div>
        </form>
        <div class="result" id="result"></div>
      </div>

      <div id="tab-list" class="card" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
          <span class="meta" id="listCount">加载中…</span>
          <button type="button" class="ghost" id="refreshBtn" style="width:auto;padding:0.35rem 0.7rem;font-size:0.8rem">刷新</button>
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>文件名</th>
                <th>大小</th>
                <th>下载</th>
                <th>过期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="listBody"></tbody>
          </table>
        </div>
        <div class="empty" id="listEmpty" style="display:none">暂无文件</div>
      </div>
    </div>
  </div>
  <script>
    let token = sessionStorage.getItem('admin_token') || '';
    const loginBox = document.getElementById('loginBox');
    const mainBox = document.getElementById('mainBox');

    function showMain() {
      loginBox.style.display = 'none';
      mainBox.style.display = 'block';
      loadList();
    }
    if (token) showMain();

    document.getElementById('loginBtn').onclick = async () => {
      const pwd = document.getElementById('pwd').value;
      const r = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) });
      const d = await r.json();
      if (!r.ok) { alert(d.error || '登录失败'); return; }
      token = d.token;
      sessionStorage.setItem('admin_token', token);
      showMain();
    };

    document.getElementById('logoutBtn').onclick = () => {
      token = '';
      sessionStorage.removeItem('admin_token');
      mainBox.style.display = 'none';
      loginBox.style.display = 'block';
    };

    document.querySelectorAll('.tabs button').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-upload').style.display = btn.dataset.tab === 'upload' ? 'block' : 'none';
        document.getElementById('tab-list').style.display = btn.dataset.tab === 'list' ? 'block' : 'none';
        if (btn.dataset.tab === 'list') loadList();
      };
    });

    function fmtSize(n) {
      if (n < 1024) return n + ' B';
      if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
      return (n/1048576).toFixed(1) + ' MB';
    }
    function fmtTime(iso) {
      if (!iso) return '永不';
      const d = new Date(iso);
      return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    }

    async function loadList() {
      const body = document.getElementById('listBody');
      const empty = document.getElementById('listEmpty');
      const count = document.getElementById('listCount');
      body.innerHTML = '';
      empty.style.display = 'none';
      count.textContent = '加载中…';
      try {
        const r = await fetch('/api/admin/list', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '加载失败');
        const files = d.files || [];
        count.textContent = '共 ' + files.length + ' 个文件';
        if (!files.length) { empty.style.display = 'block'; return; }
        files.forEach(f => {
          const tr = document.createElement('tr');
          const rem = f.maxDownloads === 0 ? '无限' : (f.downloads + '/' + f.maxDownloads);
          tr.innerHTML = '<td><div>' + escapeHtml(f.filename) + '</div><div class="meta">' + f.id + '</div></td>' +
            '<td>' + fmtSize(f.size) + '</td>' +
            '<td>' + rem + '</td>' +
            '<td class="meta">' + fmtTime(f.expiresAt) + '</td>' +
            '<td class="actions">' +
            '<button type="button" class="ghost" data-copy="' + f.url + '">复制</button>' +
            '<a href="' + f.url + '" target="_blank"><button type="button" class="ghost">打开</button></a>' +
            '<button type="button" class="danger" data-del="' + f.id + '">删除</button>' +
            '</td>';
          body.appendChild(tr);
        });
        body.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy));
        body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delFile(b.dataset.del));
      } catch (e) {
        count.textContent = e.message || '加载失败';
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    async function delFile(id) {
      if (!confirm('确定删除此文件？')) return;
      const r = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id })
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || '删除失败'); return; }
      loadList();
    }

    document.getElementById('refreshBtn').onclick = loadList;

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('file').files[0];
      if (!file) return;
      if (file.size > 104857600) { alert('超过 100MB'); return; }
      const days = parseInt(document.getElementById('days').value) || 0;
      const maxdl = parseInt(document.getElementById('maxdl').value) || 0;
      const btn = document.getElementById('btn');
      const result = document.getElementById('result');
      const prog = document.getElementById('prog');
      const bar = document.getElementById('bar');
      btn.disabled = true; prog.style.display='block'; bar.style.width='0%'; result.className='result';

      const fd = new FormData();
      fd.append('file', file);
      fd.append('days', days);
      fd.append('maxDownloads', maxdl);
      fd.append('admin', '1');

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) bar.style.width = Math.round(ev.loaded/ev.total*100)+'%'; };
        const res = await new Promise((resolve, reject) => {
          xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
          xhr.onerror = () => reject(new Error('网络错误'));
          xhr.send(fd);
        });
        const data = JSON.parse(res.body);
        if (res.status !== 200) throw new Error(data.error || '失败');
        result.className = 'result show ok';
        result.innerHTML = '成功<br><a href="' + data.url + '" target="_blank">' + data.url + '</a><br>过期: ' + (data.expiresAt || '永不') + ' · 次数: ' + (data.maxDownloads || '无限');
        document.getElementById('file').value = '';
      } catch (err) {
        result.className = 'result show err';
        result.textContent = err.message;
      } finally {
        btn.disabled = false;
        setTimeout(() => prog.style.display='none', 400);
      }
    });
  </script>
</body>
</html>`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function randomId(len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Pages
    if (path === '/' || path === '') {
      return new Response(HTML_PUBLIC, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (path === '/admin') {
      return new Response(HTML_ADMIN, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Download
    if (path.startsWith('/d/') && request.method === 'GET') {
      return handleDownload(request, env, path.slice(3));
    }

    // API
    if (path === '/api/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    if (path === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }
    if (path === '/api/admin/list' && request.method === 'GET') {
      return handleAdminList(request, env);
    }
    if (path === '/api/admin/delete' && request.method === 'POST') {
      return handleAdminDelete(request, env);
    }
    if (path === '/api/info' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing id' }, 400);
      const meta = await env.META.get(`file:${id}`, 'json');
      if (!meta) return json({ error: 'not found' }, 404);
      return json({
        filename: meta.filename,
        size: meta.size,
        expiresAt: meta.expiresAt,
        maxDownloads: meta.maxDownloads,
        downloads: meta.downloads,
        remaining: meta.maxDownloads === 0 ? null : Math.max(0, meta.maxDownloads - meta.downloads),
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Cron cleanup
  async scheduled(event, env, ctx) {
    const list = await env.META.list({ prefix: 'file:' });
    const now = Date.now();
    for (const key of list.keys) {
      const meta = await env.META.get(key.name, 'json');
      if (!meta) continue;
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() < now) {
        await env.BUCKET.delete(`files/${meta.id}`);
        await env.META.delete(key.name);
      }
    }
  },
};

async function handleAdminLogin(request, env) {
  try {
    const { password } = await request.json();
    const expected = env.ADMIN_PASSWORD;
    if (!expected) return json({ error: 'ADMIN_PASSWORD not configured' }, 500);
    if (password !== expected) return json({ error: '密码错误' }, 401);
    // simple token = hash of password + day
    const day = Math.floor(Date.now() / 86400000);
    const token = await hashPassword(expected + ':' + day);
    return json({ token });
  } catch {
    return json({ error: 'bad request' }, 400);
  }
}

async function verifyAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const day = Math.floor(Date.now() / 86400000);
  const valid = await hashPassword(expected + ':' + day);
  // also accept previous day for timezone edge
  const validPrev = await hashPassword(expected + ':' + (day - 1));
  return token === valid || token === validPrev;
}

async function handleAdminList(request, env) {
  if (!(await verifyAdmin(request, env))) {
    return json({ error: '未授权' }, 401);
  }
  try {
    const list = await env.META.list({ prefix: 'file:' });
    const origin = new URL(request.url).origin;
    const files = [];
    for (const key of list.keys) {
      const meta = await env.META.get(key.name, 'json');
      if (!meta) continue;
      // skip expired
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) continue;
      files.push({
        id: meta.id,
        filename: meta.filename,
        size: meta.size,
        createdAt: meta.createdAt,
        expiresAt: meta.expiresAt,
        maxDownloads: meta.maxDownloads,
        downloads: meta.downloads || 0,
        isAdmin: !!meta.isAdmin,
        url: `${origin}/d/${meta.id}`,
      });
    }
    // newest first
    files.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return json({ files });
  } catch (err) {
    return json({ error: err.message || '列表失败' }, 500);
  }
}

async function handleAdminDelete(request, env) {
  if (!(await verifyAdmin(request, env))) {
    return json({ error: '未授权' }, 401);
  }
  try {
    const { id } = await request.json();
    if (!id || !/^[a-zA-Z0-9]+$/.test(id)) {
      return json({ error: '无效 id' }, 400);
    }
    await env.BUCKET.delete(`files/${id}`);
    await env.META.delete(`file:${id}`);
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message || '删除失败' }, 500);
  }
}

async function handleUpload(request, env) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return json({ error: '需要 multipart/form-data' }, 400);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string' || !file.size) {
      return json({ error: '未选择文件' }, 400);
    }

    const isAdminFlag = form.get('admin') === '1';
    const isAdmin = isAdminFlag && (await verifyAdmin(request, env));

    const maxSize = parseInt(env.MAX_FILE_SIZE || '104857600', 10);
    if (file.size > maxSize) {
      return json({ error: `文件过大，最大 ${Math.floor(maxSize / 1048576)}MB` }, 413);
    }

    // 解码混淆参数：z9f3k7x = days, p2m8q5w = maxDownloads
    // 编码规则: btoa(String(n * 17 + 93)) 去尾部 =
    function decObf(s) {
      if (!s || typeof s !== 'string') return null;
      try {
        const raw = atob(s);
        const n = (parseInt(raw, 10) - 93) / 17;
        if (!Number.isInteger(n) || n < 0) return null;
        return n;
      } catch {
        return null;
      }
    }

    let days, maxDownloads;

    if (isAdmin) {
      // 后台：明文 days / maxDownloads，0 = 无限制
      days = parseInt(form.get('days') || '0', 10);
      maxDownloads = parseInt(form.get('maxDownloads') || '0', 10);
      if (isNaN(days) || days < 0) days = 0;
      if (isNaN(maxDownloads) || maxDownloads < 0) maxDownloads = 0;
    } else {
      // 前台：只认混淆字段，忽略明文 days/maxDownloads，防止绕过
      const publicMaxDays = parseInt(env.PUBLIC_MAX_DAYS || '7', 10);
      const publicMaxDl = parseInt(env.PUBLIC_MAX_DOWNLOADS || '100', 10);
      const allowedDays = new Set([1, 2, 3, 5, 7]);
      const allowedDl = new Set([1, 5, 10, 20, 50, 100]);

      days = decObf(form.get('z9f3k7x'));
      maxDownloads = decObf(form.get('p2m8q5w'));

      if (days === null || !allowedDays.has(days)) days = 1;
      if (maxDownloads === null || !allowedDl.has(maxDownloads)) maxDownloads = 10;

      days = Math.min(publicMaxDays, Math.max(1, days));
      maxDownloads = Math.min(publicMaxDl, Math.max(1, maxDownloads));
    }

    const id = randomId(12);
    const key = `files/${id}`;
    const filename = file.name || 'file';
    const contentTypeFile = file.type || 'application/octet-stream';

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: contentTypeFile,
        contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
      customMetadata: {
        filename,
        id,
      },
    });

    let expiresAt = null;
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString();
    }

    const meta = {
      id,
      filename,
      size: file.size,
      contentType: contentTypeFile,
      createdAt: new Date().toISOString(),
      expiresAt,
      maxDownloads,
      downloads: 0,
      isAdmin: !!isAdmin,
    };

    await env.META.put(`file:${id}`, JSON.stringify(meta), {
      expirationTtl: days > 0 ? days * 86400 + 3600 : undefined, // KV auto expire a bit later
    });

    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/d/${id}`;

    return json({
      id,
      url: shareUrl,
      filename,
      size: file.size,
      expiresAt: expiresAt || null,
      maxDownloads: maxDownloads || null,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err.message || '上传失败' }, 500);
  }
}

async function handleDownload(request, env, id) {
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    return new Response('Invalid id', { status: 400 });
  }

  const metaKey = `file:${id}`;
  const meta = await env.META.get(metaKey, 'json');
  if (!meta) {
    return new Response('链接不存在或已失效', { status: 404 });
  }

  // check expiry
  if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
    await env.BUCKET.delete(`files/${id}`);
    await env.META.delete(metaKey);
    return new Response('链接已过期', { status: 410 });
  }

  // check download count
  if (meta.maxDownloads > 0 && meta.downloads >= meta.maxDownloads) {
    await env.BUCKET.delete(`files/${id}`);
    await env.META.delete(metaKey);
    return new Response('下载次数已用尽', { status: 410 });
  }

  const obj = await env.BUCKET.get(`files/${id}`);
  if (!obj) {
    await env.META.delete(metaKey);
    return new Response('文件不存在', { status: 404 });
  }

  // increment download count (best-effort)
  meta.downloads = (meta.downloads || 0) + 1;
  const remainingTtl = meta.expiresAt
    ? Math.max(60, Math.floor((new Date(meta.expiresAt).getTime() - Date.now()) / 1000) + 3600)
    : undefined;
  await env.META.put(metaKey, JSON.stringify(meta), { expirationTtl: remainingTtl });

  // if this was the last allowed download, schedule cleanup
  if (meta.maxDownloads > 0 && meta.downloads >= meta.maxDownloads) {
    // delete after response
    // (we already served the file)
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'no-store');
  // force download name
  if (meta.filename) {
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(meta.filename)}`);
  }

  return new Response(obj.body, { headers });
}
