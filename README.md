# Đặt Món Chung

Web đặt đồ ăn chung cho nhóm, lấy dữ liệu thẳng từ ShopeeFood.

- **Chọn quán bất kỳ trên ShopeeFood:** chọn thành phố, gõ tên quán hoặc món (vd. "xôi", "bún chả"), bấm vào quán là mở menu. Hoặc dán link quán `shopeefood.vn/...`.
- **Toàn bộ món hiện ngay dưới ô "Tìm món"**, chia theo nhóm món như trên ShopeeFood (ảnh, giá, giá giảm, món hết).
- **Tìm món** gõ có dấu hay không dấu đều được.
- **Ai đặt gì:** bấm **+ / −** cạnh món. Dưới mỗi món hiện tên + số lượng từng người (vd. "Lan ×2", "Minh ×1", "Tổng 3"), cập nhật tức thì cho mọi người đang mở trang.
- **Đơn chung:** xem theo người hoặc gộp theo món, tổng tiền, nút copy đơn để đi đặt.
- Quán nào cũng dùng được. Mỗi quán có link riêng (`/#/quan/<mã>`) để gửi cho cả nhóm.

Không cần cài thư viện, chỉ cần Node.js 18 trở lên.

## Chạy trên máy

```bash
node server.js
```

Mở http://localhost:3000. Người cùng wifi vào bằng `http://<IP máy bạn>:3000`.

## Chạy trên GitHub (Codespaces), không cần web nào khác

1. Mở repo này trên github.com, bấm nút xanh **Code → Codespaces → Create codespace on main**.
2. Đợi khoảng 1 phút. Web tự chạy, tab **Ports** hiện cổng `3000` với link dạng `https://<tên>-3000.app.github.dev`. Bấm vào để mở.
3. Gửi link đó cho cả nhóm. Cổng đã được đặt **Public** nên ai cũng mở được, không cần tài khoản GitHub.

Lần sau chỉ cần vào **Code → Codespaces**, bấm vào codespace cũ để bật lại (link giữ nguyên, quán và đơn vẫn còn).

Lưu ý: Codespace tự tắt sau 30 phút không ai dùng (đổi lên tối đa 4 giờ ở github.com/settings/codespaces, mục *Default idle timeout*). Tài khoản GitHub miễn phí có 60 giờ chạy mỗi tháng. Nếu cổng chưa Public: chuột phải cổng 3000 ở tab Ports, chọn *Port Visibility → Public*.

> GitHub Pages không chạy được web này: Pages chỉ chứa trang tĩnh, trình duyệt không được phép tự gọi API của ShopeeFood, và đơn chung tức thì cần một máy chủ (`server.js`).

Muốn có link luôn sống thì có thể đưa repo lên Render (file `render.yaml` có sẵn: New → Blueprint → chọn repo).

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng chạy web |
| `DATA_DIR` | `./data` | Thư mục lưu `data.json` |
| `GAPP_BASE` | `https://gappapi.deliverynow.vn/api/` | API của ShopeeFood |

## Cách hoạt động

`server.js` gọi API công khai mà chính trang shopeefood.vn dùng: `delivery/search_global` + `delivery/get_infos` để tìm quán, `delivery/get_from_url` / `delivery/get_detail` để đọc link, `dish/get_delivery_dishes` để lấy menu. Đơn lưu ở `data/data.json`, cập nhật tức thì qua Server-Sent Events.

Không có đăng nhập: ai có link cũng chọn món và xoá đơn được.
