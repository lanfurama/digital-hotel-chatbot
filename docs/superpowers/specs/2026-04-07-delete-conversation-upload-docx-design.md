# Design: Delete Conversation & Upload DOCX

**Date:** 2026-04-07
**Status:** Approved

---

## Overview

Thêm 2 tính năng vào giao diện chat:
1. **Delete Conversation** — xóa session từ sidebar
2. **Upload .docx** — đính kèm file Word, trích xuất text và gửi kèm message vào Claude

---

## Feature 1: Delete Conversation

### Context

Backend endpoint `DELETE /chat/sessions/{session_id}` đã có (soft delete `is_active = False`).
`api.ts` cũng đã có `chat.deleteSession()`.
Chỉ cần thêm UI.

### UI Behavior (`SessionSidebar.tsx`)

- Hover vào session item → hiện nút ✕ nhỏ (absolute, góc phải)
- Click ✕ → inline confirm trong chính item đó: 2 nút "Hủy" và "Xóa đỏ"
- Không dùng `window.confirm` hay modal riêng
- Sau khi xóa thành công:
  - Xóa session khỏi local state (`setSessions`)
  - Nếu session đang active (`id === currentSessionId`) → gọi `onNewChat()`

### Props thêm vào `SessionSidebar`

```ts
onDeleteSession: (id: string) => void
```

`chat/page.tsx` truyền handler gọi `chatApi.deleteSession(id)` và reset nếu cần.

---

## Feature 2: Upload .docx

### Backend: `POST /chat/upload`

- **File:** `backend/app/api/v1/chat.py` — thêm endpoint mới
- **Input:** `multipart/form-data` với field `file`
- **Validation:** chỉ `.docx`, tối đa 5MB
- **Processing:** dùng `python-docx` để trích xuất toàn bộ paragraph text
- **Output:**
  ```json
  { "filename": "report.docx", "text": "...", "char_count": 3420 }
  ```
- **Dependency:** thêm `python-docx` vào `requirements.txt`
- **Auth:** yêu cầu JWT như các endpoint khác

### Frontend: `ChatInput.tsx`

**State mới:**
```ts
const [attachment, setAttachment] = useState<{ filename: string; text: string; char_count: number } | null>(null)
const [uploading, setUploading] = useState(false)
```

**UI thêm:**
- Nút 📎 bên trái textarea
- Hidden `<input type="file" accept=".docx" />`
- Sau khi chọn file → gọi `POST /chat/upload` (multipart)
- Hiện chip preview: `📄 filename.docx · 3,420 ký tự` với nút ✕ để bỏ
- Khi submit với attachment: ghép content gửi lên là:

```
[Tài liệu đính kèm: filename.docx]
{extracted_text}

---
{user_message}
```

**Props `ChatInput`:**
```ts
interface Props {
  onSend: (message: string) => void
  disabled: boolean
}
```
Không thay đổi signature — xử lý upload và ghép text hoàn toàn bên trong component.

### `api.ts` — thêm hàm upload

```ts
export function uploadFile(file: File): Promise<{ filename: string; text: string; char_count: number }> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE}/chat/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  }).then(r => r.json())
}
```

---

## Files Changed

| File | Thay đổi |
|------|----------|
| `backend/app/api/v1/chat.py` | Thêm `POST /chat/upload` |
| `backend/requirements.txt` | Thêm `python-docx` |
| `frontend/src/lib/api.ts` | Thêm `uploadFile()` |
| `frontend/src/components/sidebar/SessionSidebar.tsx` | Thêm delete UX |
| `frontend/src/components/chat/ChatInput.tsx` | Thêm upload button + chip preview |
| `frontend/src/app/chat/page.tsx` | Truyền `onDeleteSession` prop |

---

## Out of Scope

- Upload ảnh (jpg/png) — không làm
- Lưu file lên disk/S3
- Preview nội dung docx trước khi gửi
