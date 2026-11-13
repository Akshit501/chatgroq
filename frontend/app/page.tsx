"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Zap,
  Paperclip,
  Trash2,
  Download,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Sliders,
  FileText,
  X,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachment?: string;
  latency?: number;
}

interface Limits {
  limit_tokens: number;
  remaining_tokens: number;
  limit_requests: number;
  remaining_requests: number;
  reset_tokens: string;
  reset_requests: string;
}

// Use production API URL if set in environment, otherwise fallback to local
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STARTER_PROMPTS = [
  {
    icon: "💡",
    title: "Explain Quantum Computing",
    desc: "Intuitive explanation with analogies",
    prompt: "Explain quantum computing in two simple, intuitive sentences using clear analogies.",
  },
  {
    icon: "🐍",
    title: "Python Web Scraper",
    desc: "Complete script using BeautifulSoup",
    prompt: "Write a clean, robust Python script to fetch and parse headlines from a news website using BeautifulSoup.",
  },
  {
    icon: "📄",
    title: "Document Analysis",
    desc: "Extract key takeaways & action items",
    prompt: "Summarize the key takeaways, strengths, and risks of the attached content.",
  },
  {
    icon: "🌐",
    title: "Multilingual Translation",
    desc: "Translate across 3 languages",
    prompt: "Translate: 'Artificial Intelligence is transforming how humanity builds and creates' into Spanish, French, and Japanese.",
  },
];

const MODELS = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", desc: "Flagship Reasoning & Coding" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", desc: "Ultra-Fast Lightweight" },
  { id: "qwen/qwen3.8-27b", name: "Qwen 27B", desc: "High Quality Multilingual" },
  { id: "allam-2-7b", name: "Allam 7B", desc: "Fast General Purpose" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-120b");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful, brilliant, and friendly AI assistant, like ChatGPT. Format your responses with clean markdown."
  );
  const [attachment, setAttachment] = useState<{ name: string; text: string; size_kb: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);

  const [limits, setLimits] = useState<Limits>({
    limit_tokens: 8000,
    remaining_tokens: 8000,
    limit_requests: 1000,
    remaining_requests: 1000,
    reset_tokens: "0s",
    reset_requests: "0s",
  });
  const [sessionTokens, setSessionTokens] = useState(0);
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("groq_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem("groq_api_key", val);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync limits on demand
  const syncLimits = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/limits?model=${selectedModel}&api_key=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        setLimits(data);
      }
    } catch (err) {
      console.error("Failed to sync limits", err);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setAttachment({
        name: data.filename,
        text: data.text,
        size_kb: data.size_kb,
      });
    } catch (err) {
      alert("Error uploading file: " + err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Send Message & Stream Response
  const sendMessage = async (promptText?: string) => {
    const textToSend = promptText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessageId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString();

    // Build full prompt if file is attached
    let promptWithContext = textToSend;
    if (attachment) {
      promptWithContext = `The user has attached file \`${attachment.name}\`:\n\n--- BEGIN FILE CONTENT ---\n${attachment.text}\n--- END FILE CONTENT ---\n\nUser Question: ${textToSend}`;
    }

    const newMessages: Message[] = [
      ...messages,
      {
        id: userMessageId,
        role: "user",
        content: textToSend,
        attachment: attachment ? attachment.name : undefined,
      },
    ];

    setMessages(newMessages);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    // Placeholder assistant message
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    const startTime = performance.now();

    try {
      // Build API request payload
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.map((m) => ({
          role: m.role,
          content: m.id === userMessageId ? promptWithContext : m.content,
        })),
      ];

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          temperature,
          api_key: apiKey || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Server error");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.replace("data: ", ""));
                if (parsed.type === "chunk") {
                  assistantText += parsed.data;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMessageId ? { ...m, content: assistantText } : m))
                  );
                } else if (parsed.type === "limits") {
                  setLimits(parsed.data);
                } else if (parsed.type === "done") {
                  const elapsed = (performance.now() - startTime) / 1000;
                  setLastLatency(elapsed);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, latency: parsed.latency || elapsed } : m
                    )
                  );
                } else if (parsed.type === "error") {
                  throw new Error(parsed.data);
                }
              } catch {
                // Ignore partial JSON chunks
              }
            }
          }
        }
      }

      // Update estimated tokens
      const estTokens = Math.round((promptWithContext.length + assistantText.length) / 4);
      setSessionTokens((prev) => prev + estTokens);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to communicate with Groq backend.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: `❌ Error: ${errorMessage}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportChat = () => {
    const text = messages.map((m) => `### ${m.role.toUpperCase()}\n\n${m.content}\n`).join("\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `groq-chat-${Date.now()}.md`;
    a.click();
  };

  const tokensPercent =
    limits.limit_tokens > 0
      ? Math.min(100, Math.max(0, ((limits.limit_tokens - limits.remaining_tokens) / limits.limit_tokens) * 100))
      : 0;
  const reqPercent =
    limits.limit_requests > 0
      ? Math.min(100, Math.max(0, ((limits.limit_requests - limits.remaining_requests) / limits.limit_requests) * 100))
      : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0E14] text-[#E6EDF3]">
      {/* =====================================================================
          LEFT SIDEBAR: Settings, API Key, Model & Attachment
      ===================================================================== */}
      <aside className="w-80 flex-shrink-0 flex flex-col justify-between border-r border-[#21262D] bg-[#0E121A] p-4 select-none">
        <div className="flex flex-col gap-5 overflow-y-auto">
          {/* Logo & Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF6B4A] to-[#FF9068] text-white shadow-lg shadow-orange-500/20">
                <Zap className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight tracking-tight text-white">GroqChat Studio</h1>
                <p className="text-[11px] text-[#8B949E]">Fast LPU Inference</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-[#00DF89]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00DF89] border border-[#00DF89]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00DF89] animate-pulse" />
              Live
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] mb-1.5 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> Model Engine
            </label>
            <div className="space-y-1.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${selectedModel === m.id
                      ? "border-[#FF6B4A] bg-[#FF6B4A]/10 text-white"
                      : "border-[#21262D] bg-[#161B22]/50 hover:bg-[#161B22] text-[#8B949E] hover:text-[#C9D1D9]"
                    }`}
                >
                  <div className="text-xs font-semibold">{m.name}</div>
                  <div className="text-[10px] opacity-75">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] mb-1.5 flex items-center justify-between">
              <span>Groq API Key</span>
              <span className="text-[10px] text-orange-400/90 font-normal">Optional if set in .env</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="gsk_..."
                className="w-full rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-2 pr-9 text-xs text-white placeholder-[#484F58] focus:border-[#FF6B4A] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-white"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Temperature
              </span>
              <span className="text-white font-mono">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#FF6B4A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#6E7681] mt-0.5">
              <span>Factual (0.0)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>

          {/* System Prompt Customization */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] mb-1.5 block">
              System Persona
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#30363D] bg-[#161B22] p-2 text-xs text-white placeholder-[#484F58] focus:border-[#FF6B4A] focus:outline-none resize-none"
            />
          </div>

          {/* File Attachment */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8B949E] mb-1.5 flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Attach Document
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.py,.md,.csv,.json,.html"
              className="hidden"
            />
            {attachment ? (
              <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                  <span className="text-[10px] opacity-75">({attachment.size_kb} KB)</span>
                </div>
                <button onClick={() => setAttachment(null)} className="hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full rounded-lg border border-dashed border-[#30363D] bg-[#161B22]/50 hover:bg-[#161B22] hover:border-[#8B949E] py-2.5 text-xs text-[#8B949E] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {isUploading ? "Extracting text..." : "Upload PDF, Code, CSV or Text"}
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="border-t border-[#21262D] pt-3 flex gap-2">
          <button
            onClick={() => setMessages([])}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#30363D] bg-[#161B22] py-2 text-xs font-medium text-[#8B949E] hover:bg-[#21262D] hover:text-white transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
          <button
            onClick={exportChat}
            disabled={messages.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#30363D] bg-[#161B22] py-2 text-xs font-medium text-[#8B949E] hover:bg-[#21262D] hover:text-white disabled:opacity-40 transition-all"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </aside>

      {/* =====================================================================
          CENTER: ChatGPT Conversation Area
      ===================================================================== */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[#21262D] bg-[#0E121A]/70 backdrop-blur-md px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {MODELS.find((m) => m.id === selectedModel)?.name}
            </span>
            <span className="rounded-md bg-[#21262D] px-2 py-0.5 text-[10px] text-[#8B949E] font-mono">
              Groq LPU
            </span>
          </div>

          <div className="flex items-center gap-3">
            {lastLatency !== null && (
              <span className="text-xs text-[#8B949E] flex items-center gap-1">
                <Zap className="h-3 w-3 text-orange-400" />
                {lastLatency.toFixed(2)}s latency
              </span>
            )}
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-1.5 rounded-lg text-[#8B949E] hover:text-white hover:bg-[#21262D] transition-colors"
              title="Toggle Live Quota Monitor"
            >
              {showRightPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-6">
          {messages.length === 0 ? (
            /* Welcome / Starter View */
            <div className="max-w-2xl mx-auto pt-16 text-center select-none">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF6B4A] to-[#FFA07A] text-white shadow-xl shadow-orange-500/20 mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                What would you like to explore today?
              </h2>
              <p className="text-sm text-[#8B949E] max-w-md mx-auto mb-8">
                Powered by Groq&apos;s high-speed Language Processing Unit (LPU) with real-time streaming.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                {STARTER_PROMPTS.map((card, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(card.prompt)}
                    className="p-3.5 rounded-xl border border-[#21262D] bg-[#161B22]/70 hover:bg-[#1C212B] hover:border-[#FF6B4A]/50 transition-all text-left group"
                  >
                    <div className="text-xl mb-1.5">{card.icon}</div>
                    <div className="text-xs font-semibold text-white group-hover:text-orange-400 transition-colors">
                      {card.title}
                    </div>
                    <div className="text-[11px] text-[#8B949E]">{card.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Bubbles */
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl mx-auto ${m.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#FF6B4A] to-[#FF8A65] text-white shadow-md shadow-orange-500/10 mt-1">
                    <Zap className="h-4 w-4 fill-current" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user"
                      ? "bg-[#2563EB] text-white rounded-tr-sm"
                      : "bg-[#161B22] border border-[#2B313E] text-[#E6EDF3] rounded-tl-sm shadow-sm"
                    }`}
                >
                  {m.attachment && (
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-blue-400/20 px-2 py-0.5 text-xs text-blue-200">
                      <Paperclip className="h-3 w-3" />
                      <span>{m.attachment}</span>
                    </div>
                  )}

                  <div className="prose prose-invert prose-sm max-w-none break-words">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {m.role === "assistant" && (
                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-[#262C36] text-[11px] text-[#8B949E]">
                      {m.latency ? (
                        <span>⚡ {m.latency.toFixed(2)}s</span>
                      ) : (
                        <span>⚡ Groq LPU</span>
                      )}
                      <button
                        onClick={() => copyToClipboard(m.content, m.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity flex items-center gap-1"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="h-3 w-3 text-green-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Chat Input */}
        <div className="p-4 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/90 to-transparent">
          <div className="max-w-3xl mx-auto">
            {attachment && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs text-blue-300">
                <Paperclip className="h-3.5 w-3.5" />
                <span>
                  Ready to send with: <b>{attachment.name}</b>
                </span>
                <button onClick={() => setAttachment(null)} className="hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="relative flex items-center rounded-xl border border-[#30363D] bg-[#161B22] shadow-2xl focus-within:border-[#FF6B4A] transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask anything, or ask about attached documents..."
                className="w-full bg-transparent px-4 py-3.5 text-sm text-white placeholder-[#6E7681] focus:outline-none pr-24"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-[#8B949E] hover:text-white hover:bg-[#21262D] transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B4A] text-white hover:bg-[#FF8A65] disabled:opacity-30 disabled:hover:bg-[#FF6B4A] transition-all shadow-md shadow-orange-500/20"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-[#6E7681] mt-2">
              GroqChat may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </main>

      {/* =====================================================================
          RIGHT PANEL: Live Quota & Rate Limit Dashboard
      ===================================================================== */}
      {showRightPanel && (
        <aside className="w-80 flex-shrink-0 border-l border-[#21262D] bg-[#0E121A] p-5 flex flex-col justify-between overflow-y-auto select-none">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Live Quota Monitor
              </h2>
              <button
                onClick={syncLimits}
                className="p-1 rounded-md text-[#8B949E] hover:text-white hover:bg-[#21262D]"
                title="Sync with Groq servers"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-[#8B949E]">
              Real-time limits for <code className="text-white">{selectedModel}</code>
            </p>

            {/* Tokens Per Minute Card */}
            <div className="rounded-xl border border-[#21262D] bg-[#161B22] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8B949E]">
                <span>Tokens / Min (TPM)</span>
                <span className="text-white font-mono">{limits.remaining_tokens.toLocaleString()} left</span>
              </div>
              <div className="w-full bg-[#21262D] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-orange-400 to-red-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${tokensPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#8B949E]">
                <span>
                  {limits.limit_tokens - limits.remaining_tokens} used ({tokensPercent.toFixed(1)}%)
                </span>
                <span>Limit: {limits.limit_tokens.toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-emerald-400/90 pt-1 border-t border-[#21262D]">
                ⏱️ Quota resets in: <b>{limits.reset_tokens}</b>
              </div>
            </div>

            {/* Requests Card */}
            <div className="rounded-xl border border-[#21262D] bg-[#161B22] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8B949E]">
                <span>Requests (RPM/RPD)</span>
                <span className="text-white font-mono">{limits.remaining_requests.toLocaleString()} left</span>
              </div>
              <div className="w-full bg-[#21262D] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${reqPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#8B949E]">
                <span>
                  {limits.limit_requests - limits.remaining_requests} used ({reqPercent.toFixed(1)}%)
                </span>
                <span>Limit: {limits.limit_requests.toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-blue-400/90 pt-1 border-t border-[#21262D]">
                ⏱️ Quota resets in: <b>{limits.reset_requests}</b>
              </div>
            </div>

            {/* Session Stats */}
            <div className="rounded-xl border border-[#21262D] bg-[#161B22] p-3.5 space-y-3">
              <div className="text-xs font-semibold text-[#8B949E]">⚡ Session Analytics</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-[#0E121A] p-2 border border-[#21262D]">
                  <div className="text-lg font-bold text-white">{messages.length}</div>
                  <div className="text-[10px] text-[#8B949E]">Messages</div>
                </div>
                <div className="rounded-lg bg-[#0E121A] p-2 border border-[#21262D]">
                  <div className="text-lg font-bold text-white">
                    {lastLatency ? `${lastLatency.toFixed(2)}s` : "0s"}
                  </div>
                  <div className="text-[10px] text-[#8B949E]">Avg Speed</div>
                </div>
              </div>
              <div className="text-[11px] text-[#8B949E] text-center pt-1 border-t border-[#21262D]">
                Est. Session Usage: <b className="text-white">~{sessionTokens.toLocaleString()} tokens</b>
              </div>
            </div>
          </div>

          <button
            onClick={syncLimits}
            className="w-full py-2 rounded-lg bg-[#161B22] hover:bg-[#21262D] border border-[#30363D] text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Server Limits
          </button>
        </aside>
      )}
    </div>
  );
}
