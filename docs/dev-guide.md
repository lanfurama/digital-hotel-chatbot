# Hướng dẫn Lập trình

## 1. Cấu trúc thư mục

```
hotel-chatbot/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── knowledge.py
│   │   │   ├── tasks.py
│   │   │   ├── admin.py
│   │   │   ├── widget.py
│   │   │   └── webhooks/
│   │   │       ├── zalo.py
│   │   │       └── whatsapp.py
│   │   ├── core/
│   │   │   ├── config.py       # Settings từ env vars
│   │   │   ├── database.py     # AsyncPG connection pool
│   │   │   └── security.py     # JWT, RBAC decorators
│   │   ├── services/
│   │   │   ├── ai_service.py       # Orchestrator chính
│   │   │   ├── rag_service.py      # Vector search
│   │   │   ├── tool_service.py     # Tool definitions + executor
│   │   │   ├── doc_processor.py    # Upload → chunk → embed
│   │   │   ├── crawler_service.py  # Website crawler (widget mode)
│   │   │   └── reminder_service.py # APScheduler jobs
│   │   ├── models/             # SQLAlchemy models
│   │   └── schemas/            # Pydantic schemas
│   ├── migrations/             # Alembic migrations
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── chat/               # Chat UI
│   │   └── admin/              # Admin panel
│   └── components/
├── widget/
│   ├── src/
│   │   └── widget.ts           # Widget source
│   └── dist/
│       └── widget.js           # Built bundle (served by backend)
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

---

## 2. Core Services

### 2.1 AI Service — Orchestrator chính

```python
# backend/app/services/ai_service.py
import anthropic

class AIService:
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.rag = RAGService()
        self.tools = ToolService()

    async def chat_stream(self, message: str, session, user):
        # 1. Load conversation history
        history = session.context_window  # max 20 messages

        # 2. RAG: tìm chunks liên quan
        chunks = await self.rag.search(
            query=message,
            access_level=user.role,
            client_id=session.client_id
        )

        # 3. Build system prompt
        system = self.build_system_prompt(chunks, user)

        # 4. Route model: Haiku vs Sonnet
        model = self.route_model(message)

        # 5. Stream với tool calling
        with self.client.messages.stream(
            model=model,
            system=system,
            messages=history + [{"role": "user", "content": message}],
            tools=self.tools.get_definitions(),
            max_tokens=2048,
        ) as stream:
            for event in stream:
                yield self.process_event(event)

    def route_model(self, message: str) -> str:
        # Sonnet cho các yêu cầu phức tạp
        complex_keywords = ["lập kế hoạch", "phân tích", "báo cáo", "chiến lược"]
        if any(kw in message.lower() for kw in complex_keywords):
            return "claude-sonnet-4-6"
        return "claude-haiku-4-5-20251001"

    def build_system_prompt(self, chunks: list, user) -> str:
        rag_context = "\n\n".join([
            f"[{c['doc_title']}]\n{c['chunk_text']}"
            for c in chunks
        ])
        return SYSTEM_PROMPT.format(
            user_name=user.name,
            department=user.department or "Chưa xác định",
            role=user.role,
            rag_context=rag_context or "Không có tài liệu liên quan."
        )
```

### 2.2 RAG Service

```python
# backend/app/services/rag_service.py
import httpx

class RAGService:
    async def search(self, query: str, top_k=5, access_level="staff", client_id=None):
        # 1. Embed query qua Ollama
        embedding = await self.embed(query)

        # 2. Cosine similarity search
        results = await db.fetch("""
            SELECT dc.chunk_text, kd.title, kd.category,
                   1 - (dc.embedding <=> $1) AS score
            FROM doc_chunks dc
            JOIN knowledge_docs kd ON dc.doc_id = kd.id
            WHERE kd.is_active = TRUE
              AND kd.access_level = ANY($2)
              AND ($3::uuid IS NULL OR kd.client_id = $3 OR kd.client_id IS NULL)
            ORDER BY dc.embedding <=> $1
            LIMIT $4
        """, embedding, self._allowed_levels(access_level), client_id, top_k)

        return [r for r in results if r["score"] > 0.7]

    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "http://ollama:11434/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text}
            )
            return res.json()["embedding"]

    def _allowed_levels(self, role: str) -> list[str]:
        levels = {"admin": ["public","staff","manager","admin"],
                  "manager": ["public","staff","manager"],
                  "staff": ["public","staff"]}
        return levels.get(role, ["public"])
```

### 2.3 Tool Service

```python
# backend/app/services/tool_service.py

TOOL_DEFINITIONS = [
    {
        "name": "search_knowledge",
        "description": "Tìm kiếm thông tin trong tài liệu nội bộ",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Câu hỏi cần tra cứu"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "create_task",
        "description": "Tạo task mới cho thành viên team",
        "input_schema": {
            "type": "object",
            "properties": {
                "title":       {"type": "string"},
                "assigned_to": {"type": "string", "description": "Email người nhận"},
                "due_date":    {"type": "string", "format": "date"},
                "priority":    {"type": "string", "enum": ["low","medium","high","urgent"]}
            },
            "required": ["title"]
        }
    },
    {
        "name": "set_reminder",
        "description": "Đặt nhắc lịch",
        "input_schema": {
            "type": "object",
            "properties": {
                "title":     {"type": "string"},
                "remind_at": {"type": "string", "format": "date-time"},
                "channels":  {"type": "array", "items": {"type": "string"}}
            },
            "required": ["title", "remind_at"]
        }
    },
    {"name": "read_calendar",          "description": "Xem lịch Google Calendar", ...},
    {"name": "send_email",             "description": "Soạn và gửi email qua Gmail", ...},
    {"name": "create_spreadsheet",     "description": "Tạo báo cáo Excel trên Google Sheets", ...},
]
```

### 2.4 Document Processor

```python
# backend/app/services/doc_processor.py

async def process_document(doc_id: str, file_content: bytes, file_type: str):
    # 1. Extract text
    if file_type == "pdf":
        text = extract_pdf(file_content)       # pypdf2
    elif file_type == "docx":
        text = extract_docx(file_content)      # python-docx
    elif file_type == "xlsx":
        text = extract_xlsx(file_content)      # openpyxl
    elif file_type == "url":
        text = await crawl_url(file_content)   # httpx + readability

    # 2. Chunk
    chunks = chunk_text(text, size=512, overlap=64)

    # 3. Embed (batch)
    rag = RAGService()
    embeddings = [await rag.embed(chunk) for chunk in chunks]

    # 4. Insert vào DB
    await db.executemany(
        """INSERT INTO doc_chunks (doc_id, chunk_index, chunk_text, embedding)
           VALUES ($1, $2, $3, $4)""",
        [(doc_id, i, chunk, emb) for i, (chunk, emb) in enumerate(zip(chunks, embeddings))]
    )

    await db.execute(
        "UPDATE knowledge_docs SET is_active = TRUE WHERE id = $1", doc_id
    )
```

### 2.5 Response Guard

```python
# backend/app/core/security.py
import re

SENSITIVE_PATTERNS = [
    r'\b\d{9,12}\b',                      # CCCD / số điện thoại dài
    r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',  # Số thẻ tín dụng
    r'password\s*[:=]\s*\S+',             # Mật khẩu dạng key=value
    r'api[_-]?key\s*[:=]\s*\S+',
]

def guard_response(text: str) -> str:
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "[Phản hồi bị chặn vì chứa thông tin nhạy cảm. Vui lòng liên hệ admin.]"
    return text
```

### 2.6 Frontend — Chat Streaming

```typescript
// frontend/app/chat/page.tsx
async function sendMessage(message: string) {
  const response = await fetch("/api/v1/chat/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ message, session_id: sessionId, channel: "web" })
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));

      if (event.type === "token")      appendToken(event.content);
      if (event.type === "tool_start") showToolBadge(event.tool);
      if (event.type === "tool_end")   hideToolBadge();
      if (event.type === "done")       finalizeMessage(event);
    }
  }
}
```

---

## 3. System Prompt

```python
SYSTEM_PROMPT = """
Bạn là trợ lý AI nội bộ của team Digital khách sạn.

VAI TRÒ:
- Trả lời câu hỏi dựa trên tài liệu nội bộ được cung cấp bên dưới
- Hỗ trợ lập kế hoạch, tạo task, nhắc lịch, soạn email
- Theo dõi và nhắc nhở tiến độ công việc

QUY TẮC:
- Chỉ trả lời dựa trên TÀI LIỆU LIÊN QUAN bên dưới, không tự bịa thông tin
- Nếu không tìm thấy thông tin, nói rõ "Tôi không tìm thấy thông tin này trong tài liệu"
- KHÔNG tiết lộ thông tin khách hàng, số thẻ, mật khẩu, dữ liệu tài chính
- Trả lời ngắn gọn, rõ ràng, dùng tiếng Việt

NGƯỜI DÙNG: {user_name} | Phòng ban: {department} | Quyền: {role}

TÀI LIỆU LIÊN QUAN:
{rag_context}
"""
```

---

## 4. Docker Compose

```yaml
# docker-compose.yml
version: '3.9'

services:
  app:
    build: ./backend
    env_file: .env
    depends_on: [db, ollama]
    restart: unless-stopped

  next:
    build: ./frontend
    env_file: .env
    restart: unless-stopped

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: hotelchat
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    # Pull model khi khởi động lần đầu:
    # docker exec ollama ollama pull nomic-embed-text

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/letsencrypt
    depends_on: [app, next]
    restart: unless-stopped

volumes:
  pgdata:
  ollama_data:
```

---

## 5. Security Checklist

- [ ] Không log API key, DB password trong console
- [ ] Mọi input từ Zalo/WhatsApp phải sanitize trước khi đưa vào LLM
- [ ] Dùng parameterized queries, không string concatenation trong SQL
- [ ] Kiểm tra `access_level` và `client_id` trong mọi query knowledge
- [ ] Response Guard chạy trước khi stream output về client
- [ ] Rate limit theo `user_id`, không theo IP (dễ bypass)
- [ ] Widget API key: validate `Origin` header khớp với `client.domain`
- [ ] Webhook: verify HMAC signature trước khi xử lý bất kỳ payload nào
