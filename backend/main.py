import os
import io
import time
import json
import base64
import random
from urllib.parse import quote
from typing import List, Optional
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from pypdf import PdfReader

# Load .env
load_dotenv()

DEFAULT_GROQ_KEY = os.getenv("GROQ_API_KEY", "")
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()

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


class ImageRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    seed: Optional[int] = None
    enhance: bool = False


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Groq AI Chat API (FastAPI)"}


@app.get("/api/limits")
def get_limits(api_key: Optional[str] = None, model: str = "openai/gpt-oss-120b"):
    """Fetch live Groq rate limit metrics."""
    key = api_key or DEFAULT_GROQ_KEY
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
    key = req.api_key or DEFAULT_GROQ_KEY
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


@app.post("/api/generate-image")
async def generate_image(req: ImageRequest):
    """Generates an image URL using Groq prompt enhancement + free Flux (Pollinations.ai)."""
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Image prompt cannot be empty")

    start_time = time.time()
    enhanced_prompt = prompt

    # Enhance short user prompts into detailed visual prompts just like ChatGPT
    if req.enhance and DEFAULT_GROQ_KEY:
        try:
            client = Groq(api_key=DEFAULT_GROQ_KEY)
            res = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert visual prompt engineer. Rewrite the user's request "
                            "into a vivid, detailed image-generation prompt (style, lighting, composition) "
                            "in under 45 words. Return ONLY the prompt text with no quotes or preamble."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=100,
            )
            candidate = (res.choices[0].message.content or "").strip().strip('"')
            if candidate:
                enhanced_prompt = candidate
        except Exception:
            enhanced_prompt = prompt

    seed = req.seed if req.seed is not None else random.randint(1, 9999999)
    provider = "pollinations"
    image_url = ""

    # Primary: Cloudflare Workers AI (Leonardo Lucid Origin -> Phoenix 1.0 -> FLUX.1-schnell)
    if CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN:
        cf_models = [
            ("@cf/leonardo/lucid-origin", {"prompt": enhanced_prompt, "num_steps": 20}, "cloudflare-lucid-origin"),
            ("@cf/leonardo/phoenix-1.0", {"prompt": enhanced_prompt, "num_steps": 20}, "cloudflare-phoenix"),
            ("@cf/black-forest-labs/flux-1-schnell", {"prompt": enhanced_prompt, "steps": 8}, "cloudflare-flux"),
        ]
        async with httpx.AsyncClient(timeout=45.0) as http_client:
            for model_id, payload, provider_name in cf_models:
                try:
                    cf_url = (
                        f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}"
                        f"/ai/run/{model_id}"
                    )
                    cf_res = await http_client.post(
                        cf_url,
                        headers={"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"},
                        json=payload,
                    )
                    if cf_res.status_code != 200:
                        continue

                    content_type = cf_res.headers.get("content-type", "")
                    if "application/json" in content_type:
                        cf_json = cf_res.json()
                        b64_img = (cf_json.get("result") or {}).get("image")
                        if cf_json.get("success") and b64_img:
                            image_url = f"data:image/jpeg;base64,{b64_img}"
                            provider = provider_name
                            break
                    elif "image/" in content_type and cf_res.content:
                        mime = content_type.split(";")[0].strip()
                        b64_img = base64.b64encode(cf_res.content).decode("utf-8")
                        image_url = f"data:{mime};base64,{b64_img}"
                        provider = provider_name
                        break
                except Exception:
                    continue

    # Fallback: Zero-key Pollinations.ai
    if not image_url:
        encoded_prompt = quote(enhanced_prompt)
        image_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width={req.width}&height={req.height}&seed={seed}&model=flux&nologo=true"
        )

    elapsed = round(time.time() - start_time, 2)
    return {
        "image_url": image_url,
        "prompt": prompt,
        "enhanced_prompt": enhanced_prompt,
        "provider": provider,
        "seed": seed,
        "latency": elapsed,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

