import os
import io
import time
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from pypdf import PdfReader

# Load .env
load_dotenv()

app = FastAPI(title="Groq AI Chat Backend", version="1.0.0")

# Enable CORS so Next.js frontend (running on localhost:3000) can talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MessageItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[MessageItem]
    model: str = "openai/gpt-oss-120b"
    temperature: float = 0.7
    api_key: Optional[str] = None


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Groq AI Chat API (FastAPI)"}


@app.get("/api/limits")
def get_limits(api_key: Optional[str] = None, model: str = "openai/gpt-oss-120b"):
    """Fetch live Groq rate limit metrics."""
    key = api_key or os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=400, detail="Groq API key not provided")

    try:
        client = Groq(api_key=key)
        raw = client.chat.completions.with_raw_response.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        h = raw.headers
        return {
            "limit_tokens": int(h.get("x-ratelimit-limit-tokens", 0) or 8000),
            "remaining_tokens": int(h.get("x-ratelimit-remaining-tokens", 0) or 8000),
            "limit_requests": int(h.get("x-ratelimit-limit-requests", 0) or 1000),
            "remaining_requests": int(h.get("x-ratelimit-remaining-requests", 0) or 1000),
            "reset_tokens": h.get("x-ratelimit-reset-tokens", "0s"),
            "reset_requests": h.get("x-ratelimit-reset-requests", "0s"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Extract text from uploaded documents (PDF, code, text, CSV)."""
    filename = file.filename.lower()
    content = await file.read()
    size_kb = round(len(content) / 1024, 1)

    extracted_text = ""
    if filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages.append(f"[Page {i+1}]\n{text}")
        extracted_text = "\n\n".join(pages)
    else:
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                extracted_text = content.decode("latin-1")
            except Exception:
                extracted_text = "[Error: Could not decode text file]"

    return {
        "filename": file.filename,
        "size_kb": size_kb,
        "text": extracted_text,
    }


@app.post("/api/chat")
async def chat_stream(req: ChatRequest):
    """Streams response from Groq using Server-Sent Events (SSE)."""
    key = req.api_key or os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=400, detail="Groq API key required")

    client = Groq(api_key=key)
    formatted_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    def event_stream():
        start_time = time.time()
        try:
            raw_response = client.chat.completions.with_raw_response.create(
                model=req.model,
                messages=formatted_messages,
                temperature=req.temperature,
                stream=True,
            )

            # Send initial rate limit metadata
            h = raw_response.headers
            limits = {
                "limit_tokens": int(h.get("x-ratelimit-limit-tokens", 0) or 8000),
                "remaining_tokens": int(h.get("x-ratelimit-remaining-tokens", 0) or 8000),
                "limit_requests": int(h.get("x-ratelimit-limit-requests", 0) or 1000),
                "remaining_requests": int(h.get("x-ratelimit-remaining-requests", 0) or 1000),
                "reset_tokens": h.get("x-ratelimit-reset-tokens", "0s"),
                "reset_requests": h.get("x-ratelimit-reset-requests", "0s"),
            }
            yield f"data: {json.dumps({'type': 'limits', 'data': limits})}\n\n"

            # Stream chunks
            for chunk in raw_response.parse():
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'type': 'chunk', 'data': token})}\n\n"

            elapsed = round(time.time() - start_time, 2)
            yield f"data: {json.dumps({'type': 'done', 'latency': elapsed})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

