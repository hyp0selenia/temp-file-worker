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
  <title>管理上传 - 临时文件分享</title>
  <style>
    :root { --bg:#0f1115; --card:#1a1d24; --text:#e8eaed; --muted:#9aa0a6; --accent:#4f8cff; --border:#2a2f3a; --ok:#3dd68c; --err:#ff6b6b; }
    * { box-sizing: border-box; margin:0; padding:0; }
    body { font-family: system-ui, -apple-system, sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:2rem 1rem; }
    h1 { font-size:1.5rem; margin-bottom:0.5rem; }
    .sub { color:var(--muted); font-size:0.9rem; margin-bottom:2rem; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.5rem; width:100%; max-width:480px; }
    label { display:block; font-size:0.85rem; color:var(--muted); margin-bottom:0.4rem; }
    input, select { width:100%; padding:0.6rem 0.75rem; border-radius:8px; border:1px solid var(--border); background:#12151b; color:var(--text); margin-bottom:1rem; }
    button { width:100%; padding:0.75rem; border:none; border-radius:8px; background:var(--accent); color:#fff; font-weight:600; cursor:pointer; font-size:1rem; }
    button:disabled { opacity:0.5; cursor:not-allowed; }
    .result { margin-top:1.25rem; padding:1rem; background:#12151b; border-radius:8px; border:1px solid var(--border); display:none; word-break:break-all; }
    .result.show { display:block; }
    .result a { color:var(--accent); }
    .progress { height:4px; background:var(--border); border-radius:2px; margin-top:0.75rem; overflow:hidden; display:none; }
    .progress > div { height:100%; background:var(--accent); width:0%; }
    .hint { font-size:0.8rem; color:var(--muted); margin-top:0.5rem; }
    .err { color:var(--err); } .ok { color:var(--ok); }
    .login { max-width:360px; }
  </style>
</head>
<body>
  <h1>管理上传</h1>
  <p class="sub">无有效期 / 次数限制</p>
  <div class="card login" id="loginBox">
    <label>管理员密码</label>
    <input type="password" id="pwd" />
    <button id="loginBtn">登录</button>
  </div>
  <div class="card" id="uploadBox" style="display:none">
    <form id="form">
      <label>选择文件</label>
      <input type="file" id="file" required />
      <div class="row" style="display:flex;gap:0.75rem">
        <div style="flex:1">
          <label>有效期（天，0=永不过期）</label>
          <input type="number" id="days" min="0" value="30" />
        </div>
        <div style="flex:1">
          <label>最大下载次数（0=无限）</label>
          <input type="number" id="maxdl" min="0" value="0" />
        </div>
      </div>
      <button type="submit" id="btn">上传</button>
      <div class="progress" id="prog"><div id="bar"></div></div>
    </form>
    <div class="result" id="result"></div>
  </div>
  <script>
    let token = sessionStorage.getItem('admin_token') || '';
    const loginBox = document.getElementById('loginBox');
    const uploadBox = document.getElementById('uploadBox');
    if (token) { loginBox.style.display='none'; uploadBox.style.display='block'; }

    document.getElementById('loginBtn').onclick = async () => {
      const pwd = document.getElementById('pwd').value;
      const r = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) });
      const d = await r.json();
      if (!r.ok) { alert(d.error || '登录失败'); return; }
      token = d.token;
      sessionStorage.setItem('admin_token', token);
      loginBox.style.display='none';
      uploadBox.style.display='block';
    };

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
        result.innerHTML = \`成功<br><a href="\${data.url}" target="_blank">\${data.url}</a><br>过期: \${data.expiresAt || '永不'} · 次数: \${data.maxDownloads || '无限'}\`;
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
