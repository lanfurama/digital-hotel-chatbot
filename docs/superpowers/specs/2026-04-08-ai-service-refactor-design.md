# AI Service Refactoring — Design Spec

## Problem

`services/ai.py` (377 lines) handles prompt building, model routing, context management, and streaming for 2 providers — all in one file. This makes it hard to:
- Iterate on prompts without risking streaming logic
- Add new AI providers
- Test individual concerns
- The system prompt is too vague, leading to poor responses (off-topic answers, hallucination, inconsistent tone)

## Goals

1. **Modular architecture**: Split `ai.py` into single-responsibility modules
2. **Better system prompt**: Clearer persona, guardrails, formatting rules, tool instructions
3. **Provider abstraction**: Interface-based pattern so adding providers is plug-and-play
4. **Backward compatibility**: `from app.services.ai import build_system_prompt, stream_chat` still works

## Non-goals

- Changing the SSE transport or chat API endpoints
- Modifying tool definitions or executors (`tools.py` stays as-is)
- Changing the RAG pipeline (`knowledge.py` stays as-is)
- Adding new features (only restructuring existing functionality)

---

## Architecture

### Directory Structure

```
services/
├── ai/
│   ├── __init__.py          # Re-exports: build_system_prompt, stream_chat, chat_once, maybe_summarize, route_model
│   ├── prompts.py           # System prompt templates + builder
│   ├── router.py            # Model routing (complexity detection)
│   ├── context.py           # Context window management + summarization
│   └── providers/
│       ├── __init__.py      # Provider factory: get_provider()
│       ├── base.py          # Abstract BaseProvider
│       ├── anthropic.py     # Anthropic streaming + non-streaming
│       └── ollama.py        # Ollama streaming + non-streaming
```

### Module Responsibilities

**`prompts.py`**
- `_SYSTEM_BASE` template with improved prompt
- `_RAG_SECTION` template
- `_TOOL_INSTRUCTIONS` section
- `build_system_prompt(user_name, user_role, department, rag_chunks)` — public API

**`router.py`**
- `_COMPLEX_KEYWORDS` regex
- `route_model(user_message)` — returns model string

**`context.py`**
- `MAX_CONTEXT_MESSAGES = 20`
- `maybe_summarize(context_window, model?)` — trims + summarizes old messages
- Uses provider internally for summarization call

**`providers/base.py`**
```python
class BaseProvider(ABC):
    @abstractmethod
    async def stream(self, system_prompt, messages, model, tools?) -> AsyncGenerator[tuple[str, str], None]: ...

    @abstractmethod
    async def complete(self, system_prompt, messages, model, max_tokens) -> str: ...
```

**`providers/anthropic.py`**
- `AnthropicProvider(BaseProvider)` — wraps current `_stream_anthropic` + Anthropic `chat_once` logic

**`providers/ollama.py`**
- `OllamaProvider(BaseProvider)` — wraps current `_stream_ollama` + Ollama `chat_once` logic

**`providers/__init__.py`**
- `get_provider() -> BaseProvider` — factory based on `settings.AI_PROVIDER`

**`__init__.py`**
- Re-exports all public functions
- `stream_chat()` and `chat_once()` delegate to `get_provider()`

### Data Flow (unchanged externally)

```
chat.py → build_system_prompt()  [from ai/prompts.py]
        → maybe_summarize()      [from ai/context.py]
        → route_model()          [from ai/router.py]
        → stream_chat()          [from ai/__init__.py → provider.stream()]
```

---

## System Prompt Improvements

### Current issues:
- Too brief, no clear boundaries
- No formatting instructions
- No guardrails for off-topic or hallucination
- No guidance on when to use tools

### New prompt structure:

```
1. PERSONA — Name, role, personality, language
2. CAPABILITIES — What the bot can do (with tools listed)
3. RULES — Output formatting, brevity, Vietnamese, no hallucination
4. GUARDRAILS — Off-topic handling, sensitive data, what NOT to do
5. TOOL USAGE — When to use each tool, when not to
6. USER CONTEXT — Name, role, department (injected)
7. RAG CONTEXT — Retrieved documents (injected when available)
```

Key additions:
- "Nếu câu hỏi không liên quan đến công việc khách sạn hoặc hỗ trợ nhân viên, hãy từ chối lịch sự và hướng người dùng quay lại chủ đề công việc."
- "Không bịa thông tin. Nếu không biết, hãy nói rõ."
- "Trả lời ngắn gọn, dùng bullet points khi liệt kê. Tối đa 3-5 câu cho câu hỏi đơn giản."
- "Chỉ dùng tool khi người dùng rõ ràng yêu cầu hành động (tạo task, đặt nhắc nhở, gửi email). Không tự ý gọi tool khi chỉ đang trò chuyện."

---

## Migration Strategy

1. Create `services/ai/` directory with all new modules
2. Move logic from `ai.py` into respective modules
3. `__init__.py` re-exports same public API
4. Delete old `services/ai.py`
5. No changes needed in `chat.py` or any other consumer

---

## Testing Approach

- Verify existing chat flow works unchanged after refactor
- Test prompt builder with various inputs (with/without RAG, different roles)
- Test model routing logic
- Test provider factory returns correct provider
