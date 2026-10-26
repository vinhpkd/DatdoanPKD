// Đặt Món Chung — chọn một quán bất kỳ trên ShopeeFood, cả nhóm cùng chọn món, ai cũng thấy ngay.
// Không cần cài thư viện: chỉ cần Node.js 18 trở lên. Chạy bằng `node server.js`.
//
//   PORT        cổng (mặc định 3000)
//   DATA_DIR    thư mục lưu data.json (mặc định ./data)
//   GAPP_BASE   API của ShopeeFood (mặc định https://gappapi.deliverynow.vn/api/)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const GAPP_BASE = process.env.GAPP_BASE || 'https://gappapi.deliverynow.vn/api/';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Thành phố trên ShopeeFood: id dùng cho API tìm quán, slug là phần đầu link quán.
const CITIES = [
  { id: 217, slug: 'ho-chi-minh', name: 'TP. Hồ Chí Minh' },
  { id: 218, slug: 'ha-noi', name: 'Hà Nội' },
  { id: 219, slug: 'da-nang', name: 'Đà Nẵng' },
  { id: 220, slug: 'can-tho', name: 'Cần Thơ' },
  { id: 221, slug: 'hai-phong', name: 'Hải Phòng' },
];

// ---------- lưu trữ ----------
// shops[key] = menu đã lấy; orders[key][dishId][tên] = số lượng
let db = { shops: {}, orders: {} };
try { db = { shops: {}, orders: {}, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch (e) { /* lần chạy đầu */ }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  }, 200);
}

// ---------- cập nhật tức thì (Server-Sent Events) ----------
// Mỗi trình duyệt nghe một quán; khi ai đó bấm +/−, mọi người đang xem quán đó nhận số mới ngay.
const listeners = new Map(); // key quán -> Set(res)
function push(key) {
  const msg = 'data: ' + JSON.stringify({ orders: db.orders[key] || {} }) + '\n\n';
  for (const res of listeners.get(key) || []) res.write(msg);
}
setInterval(() => { for (const set of listeners.values()) for (const res of set) res.write(': ping\n\n'); }, 25000);

// ---------- ShopeeFood ----------
const HEADERS = {
  'x-foody-client-id': '', 'x-foody-client-type': '1', 'x-foody-app-type': '1004', 'x-foody-client-version': '3.0.0',
  'x-foody-api-version': '1', 'x-foody-client-language': 'vi', 'x-foody-access-token': '',
  'accept': 'application/json, text/plain, */*', 'content-type': 'application/json;charset=UTF-8',
  'origin': 'https://shopeefood.vn', 'referer': 'https://shopeefood.vn/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};
async function gapp(p, body) {
  try {
    const r = await fetch(GAPP_BASE + p, {
      method: body ? 'POST' : 'GET', headers: HEADERS, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.warn('ShopeeFood', r.status, p); return null; }
    const j = await r.json();
    return (j && j.reply) || null;
  } catch (e) { console.warn('ShopeeFood', e.message, p); return null; }
}

const str = (x, n) => String(x == null ? '' : x).slice(0, n);
const priceOf = (p) => (p && typeof p.value === 'number') ? p.value : (p ? Number(String(p.text || '').replace(/\D/g, '')) || 0 : 0);
// ShopeeFood trả mỗi ảnh nhiều cỡ; lấy cỡ nhỏ nhất vẫn nét.
function photoOf(photos) {
  const list = (Array.isArray(photos) ? photos : []).filter((p) => p && p.value).sort((a, b) => (a.width || 0) - (b.width || 0));
  const p = list.find((x) => (x.width || 0) >= 120) || list[list.length - 1];
  return p ? p.value : '';
}

// Tìm quán theo từ khoá trong một thành phố. Trả về [{name, address, photo, did, rid, url}].
async function searchShops(keyword, cityId) {
  const found = await gapp('delivery/search_global', {
    category_group: 1, city_id: cityId, delivery_only: true, keyword, sort_type: 1, foody_services: [1], full_restaurant_ids: true,
  });
  const results = (found && (found.search_result || found.search_results)) || [];
  const ids = [...new Set([].concat(...results.map((x) => x.restaurant_ids || [])))].slice(0, 30);
  if (!ids.length) return [];
  const info = await gapp('delivery/get_infos', { restaurant_ids: ids, city_id: cityId });
  const city = CITIES.find((c) => c.id === cityId);
  return ((info && info.delivery_infos) || []).map((d) => ({
    name: str(d.name, 120), address: str(d.address, 200), photo: photoOf(d.photos),
    did: d.delivery_id || '', rid: d.restaurant_id || '',
    url: d.url ? (String(d.url).startsWith('http') ? d.url : 'https://shopeefood.vn/' + String(d.url).replace(/^\/+/, ''))
      : (d.url_rewrite_name && city ? 'https://shopeefood.vn/' + city.slug + '/' + d.url_rewrite_name : ''),
    open: d.is_open !== false && !(d.delivery && d.delivery.is_open === false),
  })).filter((d) => d.name && (d.did || d.rid));
}

// Đọc link quán: shopeefood.vn/now-food/shop/1265033 (mã giao hàng) hoặc shopeefood.vn/ha-noi/ten-quan.
// Link rút gọn (shp.ee, s.shopee.vn) thì đi theo chuyển hướng.
async function parseLink(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (e) { return null; }
  const read = (x) => {
    if (!/(^|\.)(shopeefood\.vn|now\.vn)$/.test(x.hostname)) return null;
    const m = x.pathname.match(/\/shop\/(\d+)/);
    if (m) return { did: m[1] };
    const slug = x.pathname.replace(/^\/+|\/+$/g, '');
    return slug.split('/').length === 2 ? { slug } : null;
  };
  if (read(u)) return read(u);
  if (!/(^|\.)(shopee\.vn|shp\.ee|foody\.vn)$/.test(u.hostname)) return null;
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': HEADERS['user-agent'] }, signal: AbortSignal.timeout(10000) });
    return read(new URL(r.url));
  } catch (e) { return null; }
}

// Lấy toàn bộ menu. Nhận {did} (mã giao hàng), {rid} (mã quán) hoặc {slug}; thiếu cái nào thì tra cái đó.
async function fetchShop({ did, rid, slug }) {
  let det = null;
  if (slug && !did) { const r = await gapp('delivery/get_from_url?url=' + encodeURIComponent(slug)); if (r) { did = r.delivery_id; rid = rid || r.restaurant_id; } }
  if (did) { const r = await gapp('delivery/get_detail?id_type=2&request_id=' + did); det = r && r.delivery_detail; }
  if (!det && rid) { const r = await gapp('delivery/get_detail?id_type=1&request_id=' + rid); det = r && r.delivery_detail; }
  if (det) { did = did || det.delivery_id; rid = rid || det.restaurant_id; }
  let menu = did ? await gapp('dish/get_delivery_dishes?id_type=2&request_id=' + did) : null;
  if (!(menu && menu.menu_infos && menu.menu_infos.length) && rid) menu = await gapp('dish/get_delivery_dishes?id_type=1&request_id=' + rid);
  const groups = (menu && menu.menu_infos) || [];
  if (!groups.length) return null;
  const seen = new Set();
  const categories = groups.map((g) => ({
    name: str(g.dish_type_name, 80) || 'Món',
    dishes: (g.dishs || g.dishes || []).filter((d) => d && d.name && !seen.has(String(d.id)) && seen.add(String(d.id))).map((d) => {
      const price = priceOf(d.discount_price) || priceOf(d.price);
      const old = d.discount_price ? priceOf(d.price) : 0;
      return {
        id: str(d.id, 40), name: str(d.name, 120), desc: str(d.description, 200), photo: photoOf(d.photos),
        price, oldPrice: old > price ? old : 0, available: d.is_available !== false,
      };
    }),
  })).filter((c) => c.dishes.length);
  if (!categories.length) return null;
  return {
    key: String(did || rid), did: String(did || ''), rid: String(rid || ''),
    name: str(det && det.name, 120) || 'Quán', address: str(det && det.address, 200), photo: photoOf(det && det.photos),
    categories, updatedAt: Date.now(),
  };
}

async function loadShop(ref, url) {
  const shop = await fetchShop(ref);
  if (!shop) return null;
  const prev = db.shops[shop.key];
  db.shops[shop.key] = { ...shop, url: str(url, 300) || (prev && prev.url) || '', addedAt: prev ? prev.addedAt : Date.now() };
  save();
  return db.shops[shop.key];
}

// ---------- HTTP ----------
function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1e5) { reject(new Error('quá lớn')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { // đường dẫn lạ (vd. /quan/123) cũng trả trang chính để mở đúng quán
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(html); });
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
}
const summary = (s) => ({ key: s.key, name: s.name, address: s.address, photo: s.photo, url: s.url, addedAt: s.addedAt,
  count: Object.values(db.orders[s.key] || {}).reduce((n, who) => n + Object.values(who).reduce((a, b) => a + b, 0), 0) });

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://x');
  let m;
  try {
    if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && pathname === '/api/cities') return send(res, 200, { cities: CITIES });

    // Quán nhóm đã mở trước đây
    if (req.method === 'GET' && pathname === '/api/shops') {
      return send(res, 200, { shops: Object.values(db.shops).sort((a, b) => b.addedAt - a.addedAt).map(summary) });
    }
    // Tìm quán trên ShopeeFood
    if (req.method === 'GET' && pathname === '/api/search') {
      const q = str(searchParams.get('q'), 80).trim();
      const city = CITIES.find((c) => c.id === Number(searchParams.get('city'))) || CITIES[0];
      if (!q) return send(res, 400, { error: 'Nhập tên quán hoặc món muốn tìm.' });
      const results = await searchShops(q, city.id);
      return send(res, 200, { results });
    }
    // Mở quán: từ link dán vào, hoặc từ kết quả tìm kiếm (did/rid)
    if (req.method === 'POST' && pathname === '/api/shops') {
      const b = await readBody(req);
      const ref = b.url ? await parseLink(b.url) : (b.did || b.rid) ? { did: str(b.did, 20).replace(/\D/g, ''), rid: str(b.rid, 20).replace(/\D/g, '') } : null;
      if (!ref) return send(res, 400, { error: 'Link chưa đúng. Hãy dán link quán trên shopeefood.vn, ví dụ https://shopeefood.vn/ha-noi/ten-quan' });
      const shop = await loadShop(ref, b.url);
      if (!shop) return send(res, 502, { error: 'Chưa lấy được menu từ ShopeeFood. Thử lại sau ít phút.' });
      return send(res, 200, { shop: summary(shop) });
    }
    if (req.method === 'GET' && (m = pathname.match(/^\/api\/shops\/(\d+)$/))) {
      const shop = db.shops[m[1]];
      if (!shop) return send(res, 404, { error: 'Không thấy quán.' });
      return send(res, 200, { shop, orders: db.orders[shop.key] || {} });
    }
    if (req.method === 'POST' && (m = pathname.match(/^\/api\/shops\/(\d+)\/refresh$/))) {
      const shop = db.shops[m[1]];
      if (!shop) return send(res, 404, { error: 'Không thấy quán.' });
      const fresh = await loadShop({ did: shop.did, rid: shop.rid }, shop.url);
      if (!fresh) return send(res, 502, { error: 'Không lấy lại được menu lúc này.' });
      return send(res, 200, { shop: fresh });
    }
    if (req.method === 'GET' && (m = pathname.match(/^\/api\/shops\/(\d+)\/events$/))) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write('retry: 2000\ndata: ' + JSON.stringify({ orders: db.orders[m[1]] || {} }) + '\n\n');
      if (!listeners.has(m[1])) listeners.set(m[1], new Set());
      listeners.get(m[1]).add(res);
      req.on('close', () => listeners.get(m[1]).delete(res));
      return;
    }
    // Thêm/bớt món: {dish, name, delta} hoặc đặt hẳn số lượng {dish, name, qty}
    if (req.method === 'POST' && (m = pathname.match(/^\/api\/shops\/(\d+)\/order$/))) {
      const shop = db.shops[m[1]];
      if (!shop) return send(res, 404, { error: 'Không thấy quán.' });
      const b = await readBody(req);
      const dish = shop.categories.flatMap((c) => c.dishes).find((d) => d.id === String(b.dish));
      const name = str(b.name, 30).trim();
      if (!dish) return send(res, 400, { error: 'Món này không còn trong menu.' });
      if (!name) return send(res, 400, { error: 'Nhập tên bạn trước khi chọn món.' });
      const orders = db.orders[shop.key] || (db.orders[shop.key] = {});
      const line = orders[dish.id] || (orders[dish.id] = {});
      const now = line[name] || 0;
      const next = Math.max(0, Math.min(99, b.qty != null ? Math.round(Number(b.qty) || 0) : now + Math.round(Number(b.delta) || 0)));
      if (next > now && !dish.available) return send(res, 400, { error: 'Quán đang hết món này.' });
      if (next) line[name] = next; else delete line[name];
      if (!Object.keys(line).length) delete orders[dish.id];
      save(); push(shop.key);
      return send(res, 200, { qty: next });
    }
    // Đổi tên: chuyển hết món của tên cũ sang tên mới
    if (req.method === 'POST' && (m = pathname.match(/^\/api\/shops\/(\d+)\/rename$/))) {
      const b = await readBody(req);
      const from = str(b.from, 30).trim(), to = str(b.to, 30).trim();
      const orders = db.orders[m[1]] || {};
      if (from && to && from !== to) {
        for (const line of Object.values(orders)) if (line[from]) { line[to] = Math.min(99, (line[to] || 0) + line[from]); delete line[from]; }
        save(); push(m[1]);
      }
      return send(res, 200, { ok: true });
    }
    // Xoá đơn của quán (sau khi đã đặt xong)
    if (req.method === 'POST' && (m = pathname.match(/^\/api\/shops\/(\d+)\/clear$/))) {
      delete db.orders[m[1]];
      save(); push(m[1]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && !pathname.startsWith('/api/')) return serveStatic(res, pathname);
    send(res, 404, { error: 'Không tìm thấy.' });
  } catch (e) {
    console.warn(e);
    send(res, 400, { error: 'Yêu cầu không hợp lệ.' });
  }
});

server.listen(PORT, () => console.log('Đặt Món Chung đang chạy ở http://localhost:' + PORT));
