# Hướng dẫn sử dụng Hotel Chatbot

## Dành cho nhân viên

### 1. Đăng nhập

Truy cập `https://chat.hotel-internal.com` → nhấn **"Đăng nhập với Google"** → dùng tài khoản Google công ty.

> Chỉ email của công ty mới được phép đăng nhập. Liên hệ admin để được cấp quyền nếu bị từ chối.

---

### 2. Chat với AI

**Giao diện chính:**

```
┌─────────────────┬────────────────────────────────────┐
│  Sidebar        │  Vùng chat                         │
│  - Lịch sử      │  [Tin nhắn cũ...]                  │
│  - Tasks        │                                    │
│  - Admin*       │  [Input box] → [Gửi]               │
└─────────────────┴────────────────────────────────────┘
```

**Phím tắt:**
- `Enter` — Gửi tin nhắn
- `Shift+Enter` — Xuống dòng
- `Cuộc trò chuyện mới` — Bắt đầu session mới

---

### 3. Những gì AI có thể làm

| Yêu cầu | Ví dụ |
|---|---|
| Tra cứu tài liệu | "Quy trình check-in của khách VIP là gì?" |
| Tạo task | "Tạo task nhắc tôi gửi báo cáo tuần vào thứ 6" |
| Đặt nhắc nhở | "Nhắc tôi lúc 9:00 sáng mai gọi cho nhà cung cấp" |
| Xem lịch | "Hôm nay tôi có cuộc họp gì?" |
| Gửi email | "Soạn email từ chối đặt phòng cho khách Nguyễn Văn A" |
| Phân tích | "Tổng hợp điểm mạnh/yếu của chính sách giá cuối tuần" |

**Lưu ý:**
- AI chỉ có thể xem lịch/gửi email nếu bạn đã đăng nhập bằng tài khoản Google
- Thông tin nhạy cảm (CCCD, số thẻ) sẽ tự động bị ẩn trong output
- AI sẽ hiện badge **"Đang tra cứu..."** khi đang tìm tài liệu hoặc thực hiện tác vụ

---

### 4. Task Board

Truy cập `/tasks` hoặc nhấn **Tasks** trong sidebar.

- Kanban 4 cột: **Cần làm → Đang làm → Đang review → Hoàn thành**
- Click link màu xanh dưới mỗi task để chuyển cột
- Nhấn **"Tạo task"** để thêm task thủ công
- AI có thể tự tạo task khi bạn yêu cầu trong chat

---

## Dành cho Admin

### 5. Admin Panel

Truy cập `/admin` (chỉ hiển thị nếu role = admin).

**Tab Tổng quan:** Số liệu hệ thống (users, messages, tokens, chi phí ước tính).

**Tab Người dùng:** Xem danh sách, đổi role (staff/manager/admin) qua dropdown.

**Tab Widget Clients:** Quản lý embed widget cho website bên ngoài.

**Tab Audit Log:** Xem 50 log gần nhất. Mỗi request đều được ghi.

---

### 6. Quản lý Knowledge Base

**Upload tài liệu:**
```
Admin Panel → Knowledge (qua API /api/v1/knowledge/upload)
hoặc dùng curl:
curl -X POST https://your-domain/api/v1/knowledge/upload \
  -H "Cookie: access_token=..." \
  -F "file=@policy.pdf" \
  -F "title=Chính sách giá phòng 2025" \
  -F "category=policy" \
  -F "access_level=staff"
```

**Loại file hỗ trợ:** PDF, DOCX, XLSX, MD, TXT

**Categories:** `policy` | `package` | `regulation` | `sop` | `faq` | `other`

**Access levels:**
- `public` — Ai cũng thấy (kể cả widget)
- `staff` — Chỉ nhân viên (mặc định)
- `manager` — Manager trở lên
- `admin` — Chỉ admin

---

### 7. Widget Embed

**Tạo client:**

1. Admin Panel → Tab "Widget Clients" → Nhập tên + domain → Nhấn "Tạo"
2. Copy **Embed code** và dán vào website khách hàng trước `</body>`

```html
<script
  src="https://chat.hotel-internal.com/widget.js"
  data-key="wk_xxxxxxxxxxxx"
  data-color="#534AB7">
</script>
```

**Crawl website:**
1. Nhập URL website vào ô "Crawl site"
2. Nhấn crawl → hệ thống tự thu thập nội dung (~50 trang)
3. Widget sẽ tự động trả lời dựa trên nội dung website đó

---

### 8. Vận hành hàng ngày

**Kiểm tra hệ thống:**
```bash
make check-health
```

**Xem chi phí API:**
```bash
make cost
```

**Xem logs:**
```bash
make logs-app        # Backend logs
docker logs hotelchat_ollama  # Ollama
```

**Backup thủ công:**
```bash
bash scripts/backup.sh
```

---

### 9. GitHub Secrets cần cấu hình

Vào `Settings → Secrets and variables → Actions`:

| Secret | Mô tả |
|---|---|
| `VPS_HOST` | IP hoặc domain VPS |
| `VPS_USER` | SSH username (thường là `root` hoặc `ubuntu`) |
| `VPS_SSH_KEY` | Private key SSH (nội dung file `~/.ssh/id_rsa`) |
| `VPS_PORT` | SSH port (mặc định 22) |
| `APP_BASE_URL` | URL production (VD: `https://chat.hotel.com`) |

---

### 10. Thêm nhân viên mới

1. Nhân viên tự đăng nhập bằng Google → tài khoản tự tạo với role `staff`
2. Admin vào **Admin Panel → Người dùng** → đổi role nếu cần
3. Nhân viên có thể dùng hệ thống ngay sau đó

---

## Hỗ trợ

Gặp lỗi? Liên hệ team Digital qua Zalo nhóm hoặc tạo issue trên GitHub.
