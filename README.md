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

## Đưa lên mạng (miễn phí) bằng Render

1. Code nằm trên GitHub (repo này).
2. Vào https://render.com, đăng nhập bằng GitHub.
3. Bấm **New → Blueprint**, chọn repo này, bấm **Apply**. Render đọc `render.yaml` và tự cấu hình (gói Free, máy chủ Singapore).
4. Khoảng 2 phút sau có link dạng `https://dat-mon-chung-xxxx.onrender.com`. Gửi link cho cả nhóm.

Mỗi lần code trên GitHub thay đổi, Render tự cập nhật.

Lưu ý gói Free: web ngủ sau 15 phút không ai vào (mở lại mất 30 đến 60 giây) và mất dữ liệu khi ngủ. Quán chỉ cần mở lại, còn đơn cũ sẽ mất. Muốn giữ lâu dài: gắn Disk ở `/data` và đặt biến `DATA_DIR=/data`.

> Không chạy được bằng GitHub Pages: trình duyệt không được phép gọi thẳng API của ShopeeFood, nên cần một máy chủ nhỏ (`server.js`) đứng giữa.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng chạy web |
| `DATA_DIR` | `./data` | Thư mục lưu `data.json` |
| `GAPP_BASE` | `https://gappapi.deliverynow.vn/api/` | API của ShopeeFood |

## Cách hoạt động

`server.js` gọi API công khai mà chính trang shopeefood.vn dùng: `delivery/search_global` + `delivery/get_infos` để tìm quán, `delivery/get_from_url` / `delivery/get_detail` để đọc link, `dish/get_delivery_dishes` để lấy menu. Đơn lưu ở `data/data.json`, cập nhật tức thì qua Server-Sent Events.

Không có đăng nhập: ai có link cũng chọn món và xoá đơn được.
