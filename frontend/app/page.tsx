"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";
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
  Sparkles,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  FileDown,
  SlidersHorizontal,
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

// Production Render backend as default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://chatgroq.onrender.com";

const STARTER_PROMPTS = [
  {
    icon: "💡",
    title: "Explain Quantum Computing",
    desc: "Clear, intuitive analogy in 2 short paragraphs",
    prompt: "Explain quantum computing in two simple, intuitive paragraphs using clear analogies.",
  },
  {
    icon: "🐍",
    title: "Python Web Scraper",
    desc: "Clean script ready to download & run",
    prompt: "Write a clean, complete Python script using BeautifulSoup to scrape article titles from a website, with comments.",
  },
  {
    icon: "📄",
    title: "Draft Project Proposal",
    desc: "Structured document ready for PDF export",
    prompt: "Draft a concise 1-page Project Proposal for an AI Chat Assistant, structured with Executive Summary, Scope, Timeline, and Deliverables.",
  },
  {
    icon: "🌐",
    title: "Fast Multilingual Translation",
    desc: "Translate across 3 languages concisely",
    prompt: "Translate: 'Artificial Intelligence empowers human creativity and productivity' into Spanish, French, and Japanese.",
  },
];

const MODELS = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", desc: "Flagship Reasoning & Coding" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", desc: "Ultra-Fast Lightweight" },
  { id: "qwen/qwen3.8-27b", name: "Qwen 27B", desc: "High Quality Multilingual" },
  { id: "allam-2-7b", name: "Allam 7B", desc: "Fast General Purpose" },
];

const RESPONSE_LENGTH_OPTIONS = [
  {
    id: "short",
    label: "Short & Crisp",
    instruction:
      "CRITICAL: Keep your answer short, direct, and concise (1-2 brief paragraphs or bullet points). No unnecessary preamble or repetitive fluff.",
  },
  {
    id: "medium",
    label: "Medium (Recommended)",
    instruction:
      "CRITICAL: Provide a well-structured, medium-length response (2-3 concise paragraphs or clear bullet points). Be informative and direct without padding.",
  },
  {
    id: "detailed",
    label: "Detailed",
    instruction:
      "Provide a comprehensive, in-depth explanation with step-by-step breakdowns and examples.",
  },
];

// Helper to download code blocks as actual code files
const downloadCodeFile = (code: string, language: string) => {
  const extMap: Record<string, string> = {
    python: "py",
    py: "py",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    html: "html",
    css: "css",
    json: "json",
    sql: "sql",
    markdown: "md",
    md: "md",
    bash: "sh",
    sh: "sh",
    shell: "sh",
    c: "c",
    cpp: "cpp",
    java: "java",
    text: "txt",
  };
  const ext = extMap[language.toLowerCase()] || "txt";
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `script_${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};

// Custom CodeBlock Component for ReactMarkdown
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadCodeFile(code, language);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-200 bg-[#18181B] text-gray-100 text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#27272A] border-b border-gray-700/60 text-gray-300 text-[11px] font-mono select-none">
        <span className="font-semibold uppercase tracking-wider text-orange-400">{language || "code"}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors bg-gray-700/40 hover:bg-gray-700 px-2 py-0.5 rounded text-[11px]"
            title={`Download as .${language || "txt"}`}
          >
            <FileDown className="h-3 w-3 text-orange-300" />
            <span>Download .{language || "txt"}</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors bg-gray-700/40 hover:bg-gray-700 px-2 py-0.5 rounded text-[11px]"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-gray-200 bg-[#18181B]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-120b");
  const [temperature, setTemperature] = useState(0.7);
  const [responseLength, setResponseLength] = useState<"short" | "medium" | "detailed">("medium");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful, brilliant AI assistant, like ChatGPT. Provide direct, well-structured, short to medium-length answers. Be concise and eliminate unnecessary fluff. If code is requested, provide clean, runnable code with brief explanations."
  );
  const [attachment, setAttachment] = useState<{ name: string; text: string; size_kb: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);

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

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync limits on demand
  const syncLimits = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/limits?model=${selectedModel}`);
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

    // Attach response length instruction
    const lengthInstruction =
      RESPONSE_LENGTH_OPTIONS.find((opt) => opt.id === responseLength)?.instruction || "";
    const activeSystemPrompt = `${systemPrompt}\n\n${lengthInstruction}`;

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
        { role: "system", content: activeSystemPrompt },
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

  // Export full chat as markdown
  const exportChat = () => {
    const text = messages.map((m) => `### ${m.role.toUpperCase()}\n\n${m.content}\n`).join("\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `groq-chat-${Date.now()}.md`;
    a.click();
  };

  // Export single message as clean, styled PDF
  const exportAsPDF = (messageContent: string) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const maxLineWidth = pageWidth - margin * 2;

      // Header Banner
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, 22, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text("GroqChat Document", margin, 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString()} | Model: ${selectedModel}`, margin, 18);

      // Line below header
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 23, pageWidth - margin, 23);

      // Body text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);

      // Clean markdown tags for PDF rendering
      const cleanText = messageContent
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`{3}[\w]*\n?/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/#{1,6}\s?/g, "");

      const lines = doc.splitTextToSize(cleanText, maxLineWidth);
      let y = 31;
      const lineHeight = 5.8;

      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;
      }

      doc.save(`GroqChat-Document-${Date.now()}.pdf`);
    } catch (e) {
      alert("Could not generate PDF: " + e);
    }
  };

  // Export single message as Word / Doc file
  const exportAsDoc = (messageContent: string) => {
    try {
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>GroqChat Document</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; padding: 40px; }
            h1, h2, h3 { color: #0f172a; margin-top: 20px; margin-bottom: 8px; }
            p { margin-bottom: 12px; }
            pre { background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-family: Consolas, monospace; }
            code { font-family: Consolas, monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
            .meta { color: #64748b; font-size: 9pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>GroqChat Document</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()} &bull; Model: ${selectedModel}</div>
          <div>${messageContent
            .replace(/\n\n/g, "<p></p>")
            .replace(/\n/g, "<br/>")}</div>
        </body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GroqChat-Doc-${Date.now()}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Could not export Doc: " + e);
    }
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
    <div className="flex h-screen w-screen overflow-hidden bg-white text-[#0D0D0D]">
      {/* =====================================================================
          LEFT SIDEBAR: Modern ChatGPT Style Light Sidebar
      ===================================================================== */}
      {showLeftSidebar && (
        <aside className="w-72 flex-shrink-0 flex flex-col justify-between border-r border-[#E5E5E5] bg-[#F9F9F9] p-3.5 select-none transition-all duration-200">
          <div className="flex flex-col gap-4 overflow-y-auto">
            {/* Top: New Chat Button & Logo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[#FF6B4A] to-[#FF8A65] text-white shadow-sm">
                  <Zap className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <h1 className="font-semibold text-sm leading-tight text-[#0D0D0D]">GroqChat</h1>
                  <p className="text-[10px] text-[#71717A]">LPU High Speed</p>
                </div>
              </div>
              <button
                onClick={() => setShowLeftSidebar(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* "+ New Chat" Button */}
            <button
              onClick={() => {
                setMessages([]);
                setAttachment(null);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E5E5E5] bg-white hover:bg-gray-50 text-xs font-medium text-[#0D0D0D] shadow-xs transition-all"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-orange-500" /> New Chat
              </span>
              <span className="text-[10px] text-gray-400 font-mono">⌘K</span>
            </button>

            {/* Response Length Preset Selector (Short / Med / Detailed) */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1.5 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Response Length
              </label>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg border border-[#E5E5E5] bg-white">
                {RESPONSE_LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setResponseLength(opt.id as "short" | "medium" | "detailed")}
                    className={`py-1.5 text-[11px] font-medium rounded-md transition-all ${
                      responseLength === opt.id
                        ? "bg-[#0D0D0D] text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {opt.id === "short" ? "Short" : opt.id === "medium" ? "Medium" : "Detailed"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {responseLength === "short"
                  ? "Crisp, concise answers with key points"
                  : responseLength === "medium"
                  ? "Balanced, short-to-medium length"
                  : "Comprehensive deep dives"}
              </p>
            </div>

            {/* Model Selector */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1.5 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Model Engine
              </label>
              <div className="space-y-1">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                      selectedModel === m.id
                        ? "border-[#FF6B4A] bg-orange-50/70 text-[#0D0D0D] font-semibold shadow-xs"
                        : "border-[#E5E5E5] bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="text-xs">{m.name}</div>
                    <div className="text-[10px] text-gray-500 font-normal">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" /> Temperature
                </span>
                <span className="text-gray-900 font-mono">{temperature}</span>
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
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>Direct (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>

            {/* System Persona Customization */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1.5 block">
                System Persona
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white p-2 text-xs text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none resize-none"
              />
            </div>

            {/* File Attachment */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1.5 flex items-center gap-1.5">
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
                <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span className="truncate font-medium">{attachment.name}</span>
                    <span className="text-[10px] text-blue-600">({attachment.size_kb} KB)</span>
                  </div>
                  <button onClick={() => setAttachment(null)} className="text-blue-500 hover:text-blue-700">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-dashed border-[#D1D5DB] bg-white hover:bg-gray-50 py-2.5 text-xs text-gray-600 hover:text-gray-900 transition-all flex items-center justify-center gap-2 shadow-2xs"
                >
                  <Paperclip className="h-3.5 w-3.5 text-orange-500" />
                  {isUploading ? "Extracting text..." : "Upload PDF, Code, or Text"}
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Footer Actions */}
          <div className="border-t border-[#E5E5E5] pt-3 flex gap-2">
            <button
              onClick={() => setMessages([])}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              onClick={exportChat}
              disabled={messages.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-all"
            >
              <Download className="h-3.5 w-3.5" /> Export All
            </button>
          </div>
        </aside>
      )}

      {/* =====================================================================
          CENTER: ChatGPT Conversation Area (White Theme)
      ===================================================================== */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden relative bg-white">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[#E5E5E5] bg-white/90 backdrop-blur-md px-4 md:px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            {!showLeftSidebar && (
              <button
                onClick={() => setShowLeftSidebar(true)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Open sidebar"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0D0D0D]">
                {MODELS.find((m) => m.id === selectedModel)?.name}
              </span>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 font-mono">
                Groq LPU
              </span>
              <span className="hidden sm:inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                {responseLength === "short" ? "Crisp Short" : responseLength === "medium" ? "Med Length" : "Detailed"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastLatency !== null && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-orange-500" />
                {lastLatency.toFixed(2)}s latency
              </span>
            )}
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Toggle Live Quota Monitor"
            >
              {showRightPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 ? (
            /* Welcome / Starter View */
            <div className="max-w-2xl mx-auto pt-12 md:pt-16 text-center select-none">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF6B4A] to-[#FF8A65] text-white shadow-lg shadow-orange-500/10 mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-[#0D0D0D] tracking-tight mb-2">
                What can I help you with today?
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-8">
                Fast responses powered by Groq LPUs. Easily build code, generate documents, and export to PDF.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                {STARTER_PROMPTS.map((card, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(card.prompt)}
                    className="p-3.5 rounded-xl border border-[#E5E5E5] bg-white hover:bg-gray-50 hover:border-gray-300 shadow-2xs transition-all text-left group"
                  >
                    <div className="text-xl mb-1.5">{card.icon}</div>
                    <div className="text-xs font-semibold text-[#0D0D0D] group-hover:text-orange-600 transition-colors">
                      {card.title}
                    </div>
                    <div className="text-[11px] text-gray-500">{card.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Bubbles */
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl mx-auto ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF6B4A] to-[#FF8A65] text-white shadow-xs mt-1">
                    <Zap className="h-3.5 w-3.5 fill-current" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#F4F4F4] text-[#0D0D0D] rounded-br-sm"
                      : "bg-white border border-[#E5E5E5] text-[#0D0D0D] rounded-bl-sm shadow-xs"
                  }`}
                >
                  {m.attachment && (
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                      <Paperclip className="h-3 w-3" />
                      <span>{m.attachment}</span>
                    </div>
                  )}

                  {/* Clean Markdown Display with Custom CodeBlock */}
                  <div className="prose prose-slate prose-sm max-w-none break-words">
                    <ReactMarkdown
                      components={{
                        // Custom Code Renderer with 1-click Download & Copy
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        code({ inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || "");
                          const codeString = String(children).replace(/\n$/, "");
                          if (!inline && match) {
                            return <CodeBlock language={match[1]} code={codeString} />;
                          } else if (!inline && codeString.includes("\n")) {
                            return <CodeBlock language="text" code={codeString} />;
                          } else {
                            return (
                              <code
                                className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono font-medium"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          }
                        },
                        h1: ({ ...props }) => <h1 className="text-lg font-bold mt-3 mb-1 text-gray-900" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-base font-bold mt-2.5 mb-1 text-gray-900" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-800" {...props} />,
                        p: ({ ...props }) => <p className="mb-2 leading-relaxed text-gray-800" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-800" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-800" {...props} />,
                        li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                        strong: ({ ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                        blockquote: ({ ...props }) => (
                          <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 my-2" {...props} />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>

                  {/* Document & File Building Action Bar on Assistant Messages */}
                  {m.role === "assistant" && m.content && (
                    <div className="mt-3 flex flex-wrap items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-600">⚡ {m.latency ? `${m.latency.toFixed(2)}s` : "Groq LPU"}</span>
                      </div>

                      {/* File Generation / Export Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Export as PDF */}
                        <button
                          onClick={() => exportAsPDF(m.content)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors shadow-2xs"
                          title="Generate and download formatted PDF"
                        >
                          <FileDown className="h-3 w-3 text-red-500" />
                          <span>PDF</span>
                        </button>

                        {/* Export as Word / Doc */}
                        <button
                          onClick={() => exportAsDoc(m.content)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors shadow-2xs"
                          title="Generate and download Word Document (.doc)"
                        >
                          <FileText className="h-3 w-3 text-blue-500" />
                          <span>Doc</span>
                        </button>

                        {/* Copy Text */}
                        <button
                          onClick={() => copyToClipboard(m.content, m.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors shadow-2xs"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating ChatGPT Style Rounded Pill Input Bar */}
        <div className="p-4 bg-gradient-to-t from-white via-white/95 to-transparent">
          <div className="max-w-3xl mx-auto">
            {attachment && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-800">
                <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  Attached file: <b>{attachment.name}</b> ({attachment.size_kb} KB)
                </span>
                <button onClick={() => setAttachment(null)} className="text-blue-600 hover:text-blue-900 ml-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="relative flex items-center rounded-3xl border border-[#D1D5DB] bg-[#F4F4F4] focus-within:bg-white focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-200/50 shadow-xs transition-all">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-2.5 p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                title="Attach PDF, code, or text document"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask anything, write code, or create a document..."
                className="w-full bg-transparent px-3 py-3.5 text-sm text-[#0D0D0D] placeholder-gray-500 focus:outline-none pr-14"
              />

              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D0D0D] text-white hover:bg-gray-800 disabled:opacity-20 disabled:hover:bg-[#0D0D0D] transition-all shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-2">
              GroqChat may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </main>

      {/* =====================================================================
          RIGHT PANEL: Live Quota & Rate Limit Dashboard (Clean Light Design)
      ===================================================================== */}
      {showRightPanel && (
        <aside className="w-72 flex-shrink-0 border-l border-[#E5E5E5] bg-[#F9F9F9] p-4 flex flex-col justify-between overflow-y-auto select-none transition-all duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Live Quota Monitor
              </h2>
              <button
                onClick={syncLimits}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                title="Sync with Groq servers"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Active limits for <code className="text-gray-800 font-semibold">{selectedModel}</code>
            </p>

            {/* Tokens Per Minute Card */}
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                <span>Tokens / Min (TPM)</span>
                <span className="text-gray-900 font-mono">{limits.remaining_tokens.toLocaleString()} left</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${tokensPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>{limits.limit_tokens - limits.remaining_tokens} used</span>
                <span>Limit: {limits.limit_tokens.toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-emerald-700 pt-1 border-t border-gray-100">
                ⏱️ Quota resets in: <b>{limits.reset_tokens}</b>
              </div>
            </div>

            {/* Requests Card */}
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                <span>Requests (RPM/RPD)</span>
                <span className="text-gray-900 font-mono">{limits.remaining_requests.toLocaleString()} left</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${reqPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>{limits.limit_requests - limits.remaining_requests} used</span>
                <span>Limit: {limits.limit_requests.toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-blue-700 pt-1 border-t border-gray-100">
                ⏱️ Quota resets in: <b>{limits.reset_requests}</b>
              </div>
            </div>

            {/* Session Stats */}
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-3.5 space-y-3 shadow-2xs">
              <div className="text-xs font-semibold text-gray-700">⚡ Session Analytics</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 p-2 border border-gray-200">
                  <div className="text-lg font-bold text-gray-900">{messages.length}</div>
                  <div className="text-[10px] text-gray-500">Messages</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 border border-gray-200">
                  <div className="text-lg font-bold text-gray-900">
                    {lastLatency ? `${lastLatency.toFixed(2)}s` : "0s"}
                  </div>
                  <div className="text-[10px] text-gray-500">Avg Speed</div>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 text-center pt-1 border-t border-gray-100">
                Est. Session Usage: <b className="text-gray-900">~{sessionTokens.toLocaleString()} tokens</b>
              </div>
            </div>
          </div>

          <button
            onClick={syncLimits}
            className="w-full py-2 rounded-lg bg-white hover:bg-gray-100 border border-[#E5E5E5] text-xs font-medium text-gray-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Server Limits
          </button>
        </aside>
      )}
    </div>
  );
}
