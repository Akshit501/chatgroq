import os
import io
import time
import streamlit as st
from dotenv import load_dotenv
from groq import Groq
from pypdf import PdfReader

# Load environment variables (.env)
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="GroqChat & Quota Monitor",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown("""
<style>
    .main-header {
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        color: #888;
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }
    .file-badge {
        display: inline-block;
        background-color: #2b313e;
        color: #e0e0e0;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 0.82rem;
        margin-bottom: 8px;
        border: 1px solid #444;
    }
    .metric-card {
        background: #1e212b;
        border: 1px solid #333846;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 14px;
    }
    .metric-title {
        font-size: 0.85rem;
        color: #9aa0a6;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
        margin-bottom: 8px;
    }
    .metric-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #ffffff;
    }
    .metric-sub {
        font-size: 0.8rem;
        color: #8ab4f8;
        margin-top: 4px;
    }
</style>
""", unsafe_allow_html=True)


def extract_file_content(uploaded_file) -> str:
    """Extract text from uploaded PDFs, code, data, and text files."""
    filename = uploaded_file.name.lower()
    
    # 1. PDF files
    if filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(uploaded_file.read()))
        pages_text = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages_text.append(f"[Page {i+1}]\n{text}")
        return "\n\n".join(pages_text)

    # 2. Text / Code / CSV / JSON files
    else:
        try:
            return uploaded_file.read().decode("utf-8")
        except UnicodeDecodeError:
            try:
                return uploaded_file.read().decode("latin-1")
            except Exception:
                return "⚠️ [Error: Could not decode file contents as text]"


def fetch_live_limits(api_key: str, model: str):
    """Pings Groq API to retrieve live rate limit headers."""
    try:
        client = Groq(api_key=api_key)
        raw = client.chat.completions.with_raw_response.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        headers = raw.headers
        st.session_state.rate_limits = {
            "limit_tokens": int(headers.get("x-ratelimit-limit-tokens", 0) or 0),
            "remaining_tokens": int(headers.get("x-ratelimit-remaining-tokens", 0) or 0),
            "limit_requests": int(headers.get("x-ratelimit-limit-requests", 0) or 0),
            "remaining_requests": int(headers.get("x-ratelimit-remaining-requests", 0) or 0),
            "reset_tokens": headers.get("x-ratelimit-reset-tokens", "N/A"),
            "reset_requests": headers.get("x-ratelimit-reset-requests", "N/A"),
        }
    except Exception as e:
        st.sidebar.error(f"Could not fetch limits: {e}")


# Initialize session state variables
if "messages" not in st.session_state:
    st.session_state.messages = []
if "session_tokens" not in st.session_state:
    st.session_state.session_tokens = 0
if "last_latency" not in st.session_state:
    st.session_state.last_latency = 0.0
if "rate_limits" not in st.session_state:
    st.session_state.rate_limits = {
        "limit_tokens": 8000,
        "remaining_tokens": 8000,
        "limit_requests": 1000,
        "remaining_requests": 1000,
        "reset_tokens": "0s",
        "reset_requests": "0s",
    }


# =============================================================================
# SIDEBAR
# =============================================================================
with st.sidebar:
    st.title("⚡ Groq Settings")

    default_key = os.getenv("GROQ_API_KEY", "")
    api_key = st.text_input(
        "Groq API Key",
        value=default_key,
        type="password",
        placeholder="gsk_...",
        help="Paste your Groq API key here (console.groq.com)",
    )

    st.divider()

    model_options = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "allam-2-7b",
    ]
    selected_model = st.selectbox(
        "Choose Model",
        options=model_options,
        index=0,
    )

    temperature = st.slider(
        "Creativity (Temperature)",
        min_value=0.0,
        max_value=1.0,
        value=0.7,
        step=0.05,
    )

    system_prompt = st.text_area(
        "System Prompt",
        value="You are a helpful, brilliant, and friendly AI assistant, like ChatGPT. Format your responses with clear markdown.",
        height=85,
    )

    st.divider()

    # File Attachment
    st.subheader("📎 Attach File")
    uploaded_file = st.file_uploader(
        "Upload document or code",
        type=["pdf", "txt", "md", "py", "csv", "json", "html", "js"],
        help="Upload a file to ask questions, summarize, or analyze its contents.",
    )

    attached_text = None
    if uploaded_file is not None:
        file_size_kb = uploaded_file.size / 1024
        st.success(f"📄 **{uploaded_file.name}** ({file_size_kb:.1f} KB) ready!")
        attached_text = extract_file_content(uploaded_file)
        with st.expander("👀 Preview attached content"):
            st.text(attached_text[:500] + ("..." if len(attached_text) > 500 else ""))

    st.divider()

    if st.button("🗑️ Clear Conversation", use_container_width=True):
        st.session_state.messages = []
        st.session_state.session_tokens = 0
        st.rerun()


# =============================================================================
# MAIN LAYOUT: Left = Chat (70%), Right = Live Quota & Limits (30%)
# =============================================================================
col_chat, col_stats = st.columns([7, 3], gap="large")

# -----------------------------------------------------------------------------
# RIGHT COLUMN: Live Rate Limits & Usage Monitor
# -----------------------------------------------------------------------------
with col_stats:
    st.markdown("### 📊 Quota & Limits")
    st.caption(f"Real-time limits for `{selected_model}`")

    limits = st.session_state.rate_limits
    limit_t = limits.get("limit_tokens", 8000) or 8000
    rem_t = limits.get("remaining_tokens", 8000) or 8000
    used_t = max(0, limit_t - rem_t)
    percent_t = min(1.0, max(0.0, used_t / limit_t)) if limit_t > 0 else 0.0

    limit_r = limits.get("limit_requests", 1000) or 1000
    rem_r = limits.get("remaining_requests", 1000) or 1000
    used_r = max(0, limit_r - rem_r)
    percent_r = min(1.0, max(0.0, used_r / limit_r)) if limit_r > 0 else 0.0

    # 1. Tokens Card
    with st.container():
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">🪙 Tokens Per Minute (TPM)</div>
            <div class="metric-value">{rem_t:,} <span style="font-size:0.9rem; color:#888;">/ {limit_t:,} left</span></div>
            <div class="metric-sub">Used: {used_t:,} tokens ({percent_t*100:.1f}%)</div>
        </div>
        """, unsafe_allow_html=True)
        st.progress(percent_t)
        st.caption(f"⏱️ Tokens quota resets in: **{limits.get('reset_tokens', 'N/A')}**")

    # 2. Requests Card
    with st.container():
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">📡 Request Quota (RPM/RPD)</div>
            <div class="metric-value">{rem_r:,} <span style="font-size:0.9rem; color:#888;">/ {limit_r:,} left</span></div>
            <div class="metric-sub">Used: {used_r:,} requests ({percent_r*100:.1f}%)</div>
        </div>
        """, unsafe_allow_html=True)
        st.progress(percent_r)
        st.caption(f"⏱️ Requests quota resets in: **{limits.get('reset_requests', 'N/A')}**")

    # 3. Session Statistics
    st.markdown("""
    <div class="metric-card">
        <div class="metric-title">⚡ Session Performance</div>
    """, unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        st.metric("Messages", len(st.session_state.messages))
    with c2:
        st.metric("Last Latency", f"{st.session_state.last_latency:.2f}s")
    st.metric("Est. Session Tokens", f"~{st.session_state.session_tokens:,}")
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("🔄 Refresh Live Limits", use_container_width=True):
        if api_key:
            with st.spinner("Fetching live stats from Groq..."):
                fetch_live_limits(api_key, selected_model)
                st.rerun()
        else:
            st.warning("Enter your API Key first.")


# -----------------------------------------------------------------------------
# LEFT COLUMN: ChatGPT Conversation Window
# -----------------------------------------------------------------------------
with col_chat:
    st.markdown('<div class="main-header">⚡ GroqChat</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="sub-header">Active Model: <code>{selected_model}</code> • Streamed from Groq LPU</div>', unsafe_allow_html=True)

    # Render previous messages
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            if msg.get("attachment"):
                st.markdown(f'<div class="file-badge">📎 Attached: {msg["attachment"]}</div>', unsafe_allow_html=True)
            st.markdown(msg["content"])

    # Chat Input Box
    user_input = st.chat_input("Ask a question, or ask about your attached file...")

    if user_input:
        if not api_key:
            st.error("⚠️ Please enter your Groq API Key in the sidebar to start chatting.")
            st.stop()

        # Handle attachment context
        attachment_name = uploaded_file.name if (uploaded_file is not None and attached_text) else None

        if attachment_name and attached_text:
            full_prompt = (
                f"The user has attached a file named `{attachment_name}`.\n\n"
                f"--- BEGIN FILE CONTENT ---\n"
                f"{attached_text}\n"
                f"--- END FILE CONTENT ---\n\n"
                f"User Question: {user_input}"
            )
        else:
            full_prompt = user_input

        # Save user message
        st.session_state.messages.append({
            "role": "user",
            "content": user_input,
            "attachment": attachment_name,
            "llm_prompt": full_prompt,
        })

        # Display user message immediately
        with st.chat_message("user"):
            if attachment_name:
                st.markdown(f'<div class="file-badge">📎 Attached: {attachment_name}</div>', unsafe_allow_html=True)
            st.markdown(user_input)

        # Build message history for Groq API
        groq_messages = [{"role": "system", "content": system_prompt}]
        for msg in st.session_state.messages:
            prompt_content = msg.get("llm_prompt", msg["content"])
            groq_messages.append({"role": msg["role"], "content": prompt_content})

        # Generate Assistant response with streaming + capture rate limits
        with st.chat_message("assistant"):
            try:
                client = Groq(api_key=api_key)
                start_time = time.time()

                # Call Groq with raw response to capture HTTP rate limit headers
                raw_response = client.chat.completions.with_raw_response.create(
                    model=selected_model,
                    messages=groq_messages,
                    temperature=temperature,
                    stream=True,
                )

                # Capture real-time rate limit headers
                headers = raw_response.headers
                st.session_state.rate_limits = {
                    "limit_tokens": int(headers.get("x-ratelimit-limit-tokens", 0) or 0),
                    "remaining_tokens": int(headers.get("x-ratelimit-remaining-tokens", 0) or 0),
                    "limit_requests": int(headers.get("x-ratelimit-limit-requests", 0) or 0),
                    "remaining_requests": int(headers.get("x-ratelimit-remaining-requests", 0) or 0),
                    "reset_tokens": headers.get("x-ratelimit-reset-tokens", "N/A"),
                    "reset_requests": headers.get("x-ratelimit-reset-requests", "N/A"),
                }

                # Stream tokens to screen
                def stream_chunks():
                    for chunk in raw_response.parse():
                        if chunk.choices and chunk.choices[0].delta.content:
                            yield chunk.choices[0].delta.content

                response_text = st.write_stream(stream_chunks())
                elapsed = time.time() - start_time

                # Update session stats
                st.session_state.last_latency = elapsed
                # Rough token estimate (4 chars per token)
                est_tokens = len(full_prompt) // 4 + len(response_text) // 4
                st.session_state.session_tokens += est_tokens

                # Save assistant message
                st.session_state.messages.append({"role": "assistant", "content": response_text})

                # Force a quick rerun so the right-side metrics update immediately!
                st.rerun()

            except Exception as e:
                st.error(f"❌ Error communicating with Groq: {str(e)}")
