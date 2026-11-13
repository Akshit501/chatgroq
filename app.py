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
    page_title="GroqChat Pro",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =============================================================================
# CUSTOM CSS: Modern ChatGPT / Linear / Glassmorphism Aesthetic
# =============================================================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Top Hero Header */
    .hero-container {
        padding: 1.5rem 0 1rem 0;
        text-align: center;
        margin-bottom: 1.5rem;
    }
    .hero-title {
        font-size: 2.2rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #FF6B4A 0%, #FFA07A 50%, #4E80EE 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.3rem;
    }
    .hero-subtitle {
        color: #9AA0A6;
        font-size: 0.95rem;
        font-weight: 400;
    }

    /* Live Status Pulse Badge */
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 223, 137, 0.1);
        border: 1px solid rgba(0, 223, 137, 0.3);
        color: #00DF89;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 20px;
        margin-top: 6px;
    }
    .status-dot {
        width: 7px;
        height: 7px;
        background-color: #00DF89;
        border-radius: 50%;
        box-shadow: 0 0 8px #00DF89;
        animation: pulse 2s infinite;
    }
    @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
    }

    /* Starter Suggestion Cards */
    .starter-card {
        background: #181B22;
        border: 1px solid #2B313E;
        border-radius: 12px;
        padding: 14px 16px;
        transition: all 0.2s ease;
        cursor: pointer;
        min-height: 90px;
    }
    .starter-card:hover {
        border-color: #FF6B4A;
        background: #1F2430;
        transform: translateY(-2px);
    }
    .starter-icon {
        font-size: 1.3rem;
        margin-bottom: 6px;
    }
    .starter-title {
        font-weight: 600;
        font-size: 0.88rem;
        color: #E6EDF3;
        margin-bottom: 2px;
    }
    .starter-desc {
        font-size: 0.78rem;
        color: #8B949E;
    }

    /* Metric Cards on Right Panel */
    .metric-card {
        background: #161B22;
        border: 1px solid #30363D;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .metric-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #8B949E;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
    }
    .metric-main-value {
        font-size: 1.6rem;
        font-weight: 700;
        color: #F0F6FC;
        letter-spacing: -0.5px;
    }
    .metric-secondary {
        font-size: 0.8rem;
        color: #58A6FF;
        margin-top: 4px;
    }
    .metric-reset {
        font-size: 0.75rem;
        color: #8B949E;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Attachment Chip */
    .attachment-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(78, 128, 238, 0.12);
        border: 1px solid rgba(78, 128, 238, 0.35);
        color: #8AB4F8;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 0.82rem;
        margin-bottom: 8px;
    }

    /* Response Time Pill */
    .latency-pill {
        font-size: 0.72rem;
        color: #6E7681;
        margin-top: 4px;
        display: inline-block;
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
        st.sidebar.error(f"Could not refresh limits: {e}")


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
if "pending_prompt" not in st.session_state:
    st.session_state.pending_prompt = None


# =============================================================================
# SIDEBAR
# =============================================================================
with st.sidebar:
    st.markdown("### ⚡ **Groq Console**")
    st.caption("LPU Inference Configuration")

    # API Key Input
    default_key = os.getenv("GROQ_API_KEY", "")
    api_key = st.text_input(
        "Groq API Key",
        value=default_key,
        type="password",
        placeholder="gsk_...",
        help="Paste your Groq API key here (console.groq.com)",
    )

    st.divider()

    # Model Selection
    model_options = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "allam-2-7b",
    ]
    selected_model = st.selectbox(
        "Model Architecture",
        options=model_options,
        index=0,
        help="Select which AI model to query on Groq LPU",
    )

    # Temperature Slider
    temperature = st.slider(
        "Temperature (Creativity)",
        min_value=0.0,
        max_value=1.0,
        value=0.7,
        step=0.05,
        help="Higher values = creative and diverse; lower values = focused and deterministic",
    )

    # System Instructions
    with st.expander("⚙️ System Persona", expanded=False):
        system_prompt = st.text_area(
            "Instructions",
            value="You are a helpful, brilliant, and friendly AI assistant, like ChatGPT. Format your responses with clear markdown.",
            height=100,
        )

    st.divider()

    # File Attachment
    st.markdown("### 📎 **Attach Document**")
    uploaded_file = st.file_uploader(
        "Upload file for AI analysis",
        type=["pdf", "txt", "md", "py", "csv", "json", "html", "js"],
        help="Supported: PDF, Code files, CSV, Text, JSON",
    )

    attached_text = None
    if uploaded_file is not None:
        file_size_kb = uploaded_file.size / 1024
        st.success(f"📄 **{uploaded_file.name}** ({file_size_kb:.1f} KB)")
        attached_text = extract_file_content(uploaded_file)
        with st.expander("👀 View Extracted Text"):
            st.text(attached_text[:600] + ("..." if len(attached_text) > 600 else ""))

    st.divider()

    # Action Buttons
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button("🗑️ Clear Chat", use_container_width=True):
            st.session_state.messages = []
            st.session_state.session_tokens = 0
            st.session_state.last_latency = 0.0
            st.rerun()
    with col_btn2:
        # Download Chat History as Markdown
        if st.session_state.messages:
            chat_export = "\n\n".join([f"**{m['role'].upper()}:**\n{m['content']}" for m in st.session_state.messages])
            st.download_button(
                "📥 Export",
                data=chat_export,
                file_name=f"groq_chat_{int(time.time())}.md",
                mime="text/markdown",
                use_container_width=True,
            )


# =============================================================================
# MAIN LAYOUT: Left (70%) Chat, Right (30%) Quota Monitor
# =============================================================================
col_chat, col_stats = st.columns([7, 3], gap="large")

# -----------------------------------------------------------------------------
# RIGHT COLUMN: Live Quota & Usage Monitor
# -----------------------------------------------------------------------------
with col_stats:
    st.markdown("### 📊 **Live Quota Monitor**")
    st.markdown("""
        <div class="status-badge">
            <span class="status-dot"></span> Groq LPU Engine Active
        </div>
    """, unsafe_allow_html=True)

    st.write("")

    limits = st.session_state.rate_limits
    limit_t = limits.get("limit_tokens", 8000) or 8000
    rem_t = limits.get("remaining_tokens", 8000) or 8000
    used_t = max(0, limit_t - rem_t)
    percent_t = min(1.0, max(0.0, used_t / limit_t)) if limit_t > 0 else 0.0

    limit_r = limits.get("limit_requests", 1000) or 1000
    rem_r = limits.get("remaining_requests", 1000) or 1000
    used_r = max(0, limit_r - rem_r)
    percent_r = min(1.0, max(0.0, used_r / limit_r)) if limit_r > 0 else 0.0

    # 1. Tokens Per Minute Card
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">🪙 Tokens / Minute (TPM)</div>
            <div class="metric-main-value">{rem_t:,} <span style="font-size:0.85rem; font-weight:400; color:#8B949E;">left</span></div>
            <div class="metric-secondary">{used_t:,} of {limit_t:,} used ({percent_t*100:.1f}%)</div>
            <div class="metric-reset">⏱️ Resets in: <b>{limits.get('reset_tokens', 'N/A')}</b></div>
        </div>
    """, unsafe_allow_html=True)
    st.progress(percent_t)

    # 2. Requests Quota Card
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">📡 Request Quota (RPM/RPD)</div>
            <div class="metric-main-value">{rem_r:,} <span style="font-size:0.85rem; font-weight:400; color:#8B949E;">left</span></div>
            <div class="metric-secondary">{used_r:,} of {limit_r:,} used ({percent_r*100:.1f}%)</div>
            <div class="metric-reset">⏱️ Resets in: <b>{limits.get('reset_requests', 'N/A')}</b></div>
        </div>
    """, unsafe_allow_html=True)
    st.progress(percent_r)

    # 3. Session Statistics Card
    st.markdown("""
        <div class="metric-card">
            <div class="metric-label">⚡ Session Performance</div>
    """, unsafe_allow_html=True)
    p1, p2 = st.columns(2)
    with p1:
        st.metric("Messages", len(st.session_state.messages))
    with p2:
        st.metric("Speed", f"{st.session_state.last_latency:.2f}s" if st.session_state.last_latency else "Instant")
    st.caption(f"Estimated Session Usage: **~{st.session_state.session_tokens:,} tokens**")
    st.markdown("</div>", unsafe_allow_html=True)

    # Live refresh button
    if st.button("🔄 Sync Live Limits", use_container_width=True):
        if api_key:
            with st.spinner("Pinging Groq servers..."):
                fetch_live_limits(api_key, selected_model)
                st.rerun()
        else:
            st.warning("Please provide your API key.")


# -----------------------------------------------------------------------------
# LEFT COLUMN: ChatGPT Conversation Window
# -----------------------------------------------------------------------------
with col_chat:
    # Header
    st.markdown(f"""
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #21262D; padding-bottom:0.8rem;">
            <div>
                <span style="font-size:1.6rem; font-weight:800; color:#F0F6FC;">⚡ GroqChat</span>
                <span style="background:#21262D; color:#8B949E; font-size:0.75rem; padding:3px 8px; border-radius:12px; margin-left:8px; font-family:monospace;">{selected_model}</span>
            </div>
            <div style="font-size:0.8rem; color:#8B949E;">
                Fast LPU Inference
            </div>
        </div>
    """, unsafe_allow_html=True)

    # -------------------------------------------------------------------------
    # WELCOME / EMPTY STATE: Show suggestion prompt cards if no messages yet
    # -------------------------------------------------------------------------
    if len(st.session_state.messages) == 0:
        st.markdown("""
            <div class="hero-container">
                <div class="hero-title">What can I help you discover?</div>
                <div class="hero-subtitle">Ask anything, analyze documents, or pick a starter below.</div>
            </div>
        """, unsafe_allow_html=True)

        sc1, sc2 = st.columns(2)
        with sc1:
            if st.button("💡 Explain Quantum Computing\nSimple 2-sentence breakdown", use_container_width=True):
                st.session_state.pending_prompt = "Explain quantum computing in two simple, intuitive sentences."
                st.rerun()
            if st.button("🐍 Python Data Science Helper\nScript to analyze CSV files", use_container_width=True):
                st.session_state.pending_prompt = "Write a complete Python script to load a CSV and calculate summary statistics."
                st.rerun()
        with sc2:
            if st.button("📄 Document Summarizer\nExtract key insights and takeaways", use_container_width=True):
                st.session_state.pending_prompt = "What are the 3 most important takeaways from the attached document?"
                st.rerun()
            if st.button("🌐 Multilingual Translator\nTranslate to Spanish, French & German", use_container_width=True):
                st.session_state.pending_prompt = "Translate 'Welcome to the future of AI acceleration' into Spanish, French, and German."
                st.rerun()

    # Render previous conversation history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            if msg.get("attachment"):
                st.markdown(f'<div class="attachment-chip">📎 Attached: <b>{msg["attachment"]}</b></div>', unsafe_allow_html=True)
            st.markdown(msg["content"])
            if msg.get("latency"):
                st.markdown(f'<span class="latency-pill">⚡ Generated in {msg["latency"]:.2f}s</span>', unsafe_allow_html=True)

    # Handle input: either from bottom input box OR from starter card click
    user_input = st.chat_input("Ask a question, or ask about your attached file...")
    if not user_input and st.session_state.pending_prompt:
        user_input = st.session_state.pending_prompt
        st.session_state.pending_prompt = None

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

        # Render user message
        with st.chat_message("user"):
            if attachment_name:
                st.markdown(f'<div class="attachment-chip">📎 Attached: <b>{attachment_name}</b></div>', unsafe_allow_html=True)
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

                # Stream response from Groq
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

                # Stream tokens
                def stream_chunks():
                    for chunk in raw_response.parse():
                        if chunk.choices and chunk.choices[0].delta.content:
                            yield chunk.choices[0].delta.content

                response_text = st.write_stream(stream_chunks())
                elapsed = time.time() - start_time

                # Update session stats
                st.session_state.last_latency = elapsed
                est_tokens = len(full_prompt) // 4 + len(response_text) // 4
                st.session_state.session_tokens += est_tokens

                # Display latency pill
                st.markdown(f'<span class="latency-pill">⚡ Generated in {elapsed:.2f}s</span>', unsafe_allow_html=True)

                # Save assistant message
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": response_text,
                    "latency": elapsed,
                })

                # Force a quick rerun to refresh right panel statistics
                st.rerun()

            except Exception as e:
                st.error(f"❌ Error communicating with Groq: {str(e)}")
