"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";
import {
  Send,
  Paperclip,
  Trash2,
  Download,
  Copy,
  Check,
  RefreshCw,
  FileText,
  X,
  Sparkles,
  Plus,
  FileDown,
  LogOut,
  User,
  Shield,
  ArrowRight,
  Mail,
  MessageSquare,
  Loader2,
  Image as ImageIcon,
  Menu,
  ChevronDown,
  SlidersHorizontal,
  Cpu,
  Search,
  Pencil,
  Share2,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

interface Conversation {
  id: string;
  user_email: string;
  title: string;
  model?: string;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  name: string;
  email: string;
  image?: string | null;
}

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

interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  prompt: string;
  isCustom?: boolean;
}

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: "p1",
    title: "Senior Code Reviewer",
    category: "Coding",
    prompt:
      "Review the following code for bugs, security risks, edge cases, and performance improvements. Give concise, actionable fixes:\n\n",
  },
  {
    id: "p2",
    title: "SQL Query Builder",
    category: "Coding",
    prompt:
      "Write an optimized PostgreSQL query with indexes and a brief explanation for the following requirement:\n\n",
  },
  {
    id: "p3",
    title: "Executive Email Polisher",
    category: "Writing",
    prompt:
      "Rewrite this draft into a clear, confident, concise email with a strong subject line:\n\n",
  },
  {
    id: "p4",
    title: "1-Page Study Cheat Sheet",
    category: "Study",
    prompt:
      "Create a crisp 1-page study cheat sheet with key definitions, formulas/rules, and 3 quick examples for:\n\n",
  },
  {
    id: "p5",
    title: "Startup Pitch & GTM",
    category: "Business",
    prompt:
      "Break down the value proposition, target audience, pricing model, and 30-day launch plan for:\n\n",
  },
  {
    id: "p6",
    title: "Cinematic Concept Art",
    category: "Image Art",
    prompt:
      "Generate an image of a futuristic minimalist studio overlooking snowy mountains at golden hour, soft volumetric lighting, ultra-detailed",
  },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://chatgroq.onrender.com";

const STARTER_IDEAS = [
  {
    icon: "💡",
    title: "Explain Quantum Computing",
    desc: "Clear, intuitive analogy",
    prompt: "Explain quantum computing in two simple, intuitive paragraphs using clear analogies.",
  },
  {
    icon: "🐍",
    title: "Python Web Scraper",
    desc: "Clean script ready to run",
    prompt:
      "Write a clean, complete Python script using BeautifulSoup to scrape article titles from a website, with comments.",
  },
  {
    icon: "🎨",
    title: "Generate an AI Image",
    desc: "Powered by Leonardo Lucid",
    prompt: "Generate an image of a futuristic glass library floating above clouds at golden hour",
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
    label: "Short",
    instruction:
      "CRITICAL: Keep your answer short, direct, and concise (1-2 brief paragraphs or bullet points). No unnecessary preamble or repetitive fluff.",
  },
  {
    id: "medium",
    label: "Medium",
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

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

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

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-[#E6E8F2] bg-[#12131A] text-gray-100 text-xs shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#1B1D28] border-b border-white/10 text-gray-300 text-[11px] font-mono select-none">
        <span className="font-semibold uppercase tracking-wider text-[#B06BFF]">
          {language || "code"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCodeFile(code, language)}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded-md text-[11px]"
            title={`Download as .${language || "txt"}`}
          >
            <Download className="h-3 w-3 text-[#B06BFF]" />
            <span>.{language || "txt"}</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded-md text-[11px]"
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
      <pre className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-gray-200 bg-[#12131A]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function GeneratedImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(src.startsWith("data:image/"));
  const [hasError, setHasError] = useState(!src);
  const [downloading, setDownloading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src) {
      setHasError(true);
      return;
    }
    setHasError(false);
    if (src.startsWith("data:image/") || imgRef.current?.complete) {
      setLoaded(true);
    }
  }, [src]);

  const handleDownload = async () => {
    if (!src) return;
    setDownloading(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `groqchat_image_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="my-3 max-w-md rounded-2xl overflow-hidden border border-[#E6E8F2] bg-[#F5F6FB] shadow-sm">
      {!loaded && !hasError && (
        <div className="h-64 w-full flex flex-col items-center justify-center gap-2 text-xs text-[#7A7E92] animate-pulse bg-[#F5F6FB]">
          <Loader2 className="h-5 w-5 animate-spin text-[#5B5BFF]" />
          <span>Rendering image...</span>
        </div>
      )}
      {hasError ? (
        <div className="h-40 w-full flex items-center justify-center text-xs text-red-500 bg-red-50 px-4 text-center">
          Could not render image. Please try another prompt.
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={imgRef}
          src={src}
          alt={alt || "Generated AI Image"}
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-auto object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 h-0"
            }`}
        />
      )}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-t border-[#E6E8F2] text-[11px] text-[#7A7E92]">
        <span className="truncate pr-2 font-medium text-[#12131A]">{alt || "AI Generated Image"}</span>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F5F6FB] hover:bg-[#EEEEFF] text-[#12131A] hover:text-[#5B5BFF] font-medium transition-colors flex-shrink-0"
        >
          <Download className="h-3 w-3 text-[#5B5BFF]" />
          <span>{downloading ? "Saving..." : "Download"}</span>
        </button>
      </div>
    </div>
  );
}

function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="flex-shrink-0 drop-shadow-[0_8px_14px_rgba(91,91,255,0.35)]"
    >
      <defs>
        <linearGradient id="groqBrandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B5BFF" />
          <stop offset="100%" stopColor="#B06BFF" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="13" fill="url(#groqBrandGrad)" />
      <path
        d="M28.5 13.5A10 10 0 1 0 30 21"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M21.5 11.5 14.5 21h4.5l-1.5 7.5 7-9.5H20z" fill="#fff" />
    </svg>
  );
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Email / Name login state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  // Supabase conversation history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

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
  const [isImageMode, setIsImageMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Layout popovers & drawers
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showResponseMenu, setShowResponseMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Search, Rename, Share & Prompt Library states
  const [searchQuery, setSearchQuery] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [promptCategoryFilter, setPromptCategoryFilter] = useState("All");
  const [customPrompts, setCustomPrompts] = useState<PromptTemplate[]>([]);
  const [showNewPromptForm, setShowNewPromptForm] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptCategory, setNewPromptCategory] = useState("Coding");
  const [newPromptText, setNewPromptText] = useState("");

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insightsRef = useRef<HTMLDivElement>(null);

  // 1. Load saved user from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("groqchat_user");
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch {
      localStorage.removeItem("groqchat_user");
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // 1b. Load user's past conversations from Supabase
  const loadConversations = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_email", email)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setConversations(data as Conversation[]);
      }
    } catch (err) {
      console.error("Failed to load conversations from Supabase", err);
    }
  };

  useEffect(() => {
    if (currentUser?.email) {
      loadConversations(currentUser.email);
    } else {
      setConversations([]);
      setCurrentConversationId(null);
    }
  }, [currentUser]);

  // Keyboard shortcuts (Ctrl/Cmd + K for New Chat, Esc to close popovers)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCurrentConversationId(null);
        setMessages([]);
        setAttachment(null);
        textareaRef.current?.focus();
      } else if (e.key === "Escape") {
        setShowInsights(false);
        setShowModelMenu(false);
        setShowResponseMenu(false);
        setShowSettingsModal(false);
        setShowPromptLibrary(false);
        setEditingConvId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (insightsRef.current && !insightsRef.current.contains(e.target as Node)) {
        const btn = document.getElementById("usageToggleBtn");
        if (btn && !btn.contains(e.target as Node)) {
          setShowInsights(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectConversation = async (conv: Conversation) => {
    if (conv.id === currentConversationId || isLoading) return;
    setIsLoadingConversation(true);
    setCurrentConversationId(conv.id);
    setMobileSidebarOpen(false);
    if (conv.model) setSelectedModel(conv.model);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            attachment: m.attachment_name || undefined,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load conversation messages", err);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setAttachment(null);
    setInput("");
    setMobileSidebarOpen(false);
    textareaRef.current?.focus();
  };

  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await supabase.from("conversations").delete().eq("id", convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (currentConversationId === convId) {
        startNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const startRenaming = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || "");
  };

  const saveRename = async (convId: string) => {
    const trimmed = editingTitle.trim();
    setEditingConvId(null);
    if (!trimmed) return;
    try {
      await supabase.from("conversations").update({ title: trimmed }).eq("id", convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c))
      );
    } catch (err) {
      console.error("Failed to rename conversation", err);
    }
  };

  const shareConversation = (convId?: string | null) => {
    const targetId = convId || currentConversationId;
    if (!targetId || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/share/${targetId}`;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  // Load & save custom prompts in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("groqchat_prompts");
      if (saved) setCustomPrompts(JSON.parse(saved));
    } catch {
      localStorage.removeItem("groqchat_prompts");
    }
  }, []);

  const saveCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptTitle.trim() || !newPromptText.trim()) return;
    const created: PromptTemplate = {
      id: `custom_${Date.now()}`,
      title: newPromptTitle.trim(),
      category: newPromptCategory,
      prompt: newPromptText.trim(),
      isCustom: true,
    };
    const next = [created, ...customPrompts];
    setCustomPrompts(next);
    localStorage.setItem("groqchat_prompts", JSON.stringify(next));
    setNewPromptTitle("");
    setNewPromptText("");
    setShowNewPromptForm(false);
  };

  const deleteCustomPrompt = (id: string) => {
    const next = customPrompts.filter((p) => p.id !== id);
    setCustomPrompts(next);
    localStorage.setItem("groqchat_prompts", JSON.stringify(next));
  };

  const applyPromptTemplate = (promptText: string) => {
    setInput(promptText);
    setShowPromptLibrary(false);
    setMobileSidebarOpen(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
      }
    }, 50);
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || "Untitled Chat").toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const allPrompts = [...customPrompts, ...DEFAULT_PROMPTS];
  const promptCategories = ["All", "Coding", "Writing", "Business", "Study", "Image Art"];
  const visiblePrompts = allPrompts.filter(
    (p) => promptCategoryFilter === "All" || p.category === promptCategoryFilter
  );

  // 2. Initialize Google Identity Services (GIS)
  useEffect(() => {
    if (currentUser || isInitializing) return;

    const setupGoogleGSI = () => {
      const activeClientId =
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        "1022221568103-bt0duq03hqn0q4i9mn4pnp9qakc3q81t.apps.googleusercontent.com";

      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: activeClientId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (response: any) => {
            if (response.credential) {
              const payload = parseJwt(response.credential);
              if (payload?.email) {
                const user: UserProfile = {
                  name: payload.name || payload.email.split("@")[0],
                  email: payload.email,
                  image: payload.picture || null,
                };
                setCurrentUser(user);
                localStorage.setItem("groqchat_user", JSON.stringify(user));
              }
            }
          },
        });

        const btnDiv = document.getElementById("googleSignInContainer");
        if (btnDiv) {
          btnDiv.innerHTML = "";
          window.google.accounts.id.renderButton(btnDiv, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            shape: "pill",
          });
        }
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogleGSI();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = setupGoogleGSI;
      document.body.appendChild(script);
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, [currentUser, isInitializing, showEmailForm]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
  }, [messages, isLoading]);

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

  const sendMessage = async (promptText?: string) => {
    const textToSend = promptText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessageId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString();

    const lengthInstruction =
      RESPONSE_LENGTH_OPTIONS.find((opt) => opt.id === responseLength)?.instruction || "";
    const activeSystemPrompt = `${systemPrompt}\n\n${lengthInstruction}`;

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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setAttachment(null);
    setIsLoading(true);

    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    let activeConvId = currentConversationId;
    if (!activeConvId && currentUser?.email) {
      try {
        const title =
          textToSend.length > 32 ? textToSend.slice(0, 32).trim() + "..." : textToSend.trim();
        const { data: convData, error: convErr } = await supabase
          .from("conversations")
          .insert({
            user_email: currentUser.email,
            title: title,
            model: selectedModel,
          })
          .select()
          .single();

        if (!convErr && convData) {
          activeConvId = convData.id;
          setCurrentConversationId(convData.id);
          setConversations((prev) => [convData as Conversation, ...prev]);
        }
      } catch (err) {
        console.error("Error creating conversation in Supabase", err);
      }
    }

    if (activeConvId) {
      try {
        await supabase.from("messages").insert({
          conversation_id: activeConvId,
          role: "user",
          content: textToSend,
          attachment_name: attachment ? attachment.name : null,
        });
      } catch (err) {
        console.error("Error saving user message to Supabase", err);
      }
    }

    const startTime = performance.now();

    const trimmedText = textToSend.trim();
    const isImagineCmd = /^\/(imagine|image)\s+/i.test(trimmedText);
    const isNaturalImageRequest =
      /^(please\s+|can you\s+|could you\s+)?(generate|create|make|draw|paint|design|render|illustrate|show me)\s+(an?\s+)?(image|picture|photo|illustration|art|artwork|logo|icon|wallpaper|poster|sketch)\b/i.test(
        trimmedText
      ) || /^(draw|paint|sketch)\s+(me\s+)?(an?\s+)?/i.test(trimmedText);
    const shouldGenerateImage = isImageMode || isImagineCmd || isNaturalImageRequest;

    if (shouldGenerateImage) {
      const cleanPrompt =
        trimmedText
          .replace(/^\/(imagine|image)\s+/i, "")
          .replace(
            /^(please\s+|can you\s+|could you\s+)?(generate|create|make|draw|paint|design|render|illustrate|show me)\s+(me\s+)?(an?\s+)?(image|picture|photo|illustration|art|artwork|wallpaper|poster|sketch)\s+(of\s+)?/i,
            ""
          )
          .trim() || trimmedText;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, content: "🎨 *Creating image...*" } : m
        )
      );

      try {
        let imageUrl = "";
        let enhancedPrompt = cleanPrompt;
        let latency = 0;

        try {
          const imgRes = await fetch(`${API_BASE_URL}/api/generate-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: cleanPrompt, enhance: false }),
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            imageUrl = imgData.image_url;
            enhancedPrompt = imgData.enhanced_prompt || cleanPrompt;
            latency = imgData.latency || (performance.now() - startTime) / 1000;
          }
        } catch {
          // Fallback directly to zero-key Pollinations endpoint
        }

        if (!imageUrl) {
          const seed = Math.floor(Math.random() * 9999999) + 1;
          imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
          latency = (performance.now() - startTime) / 1000;
        }

        const assistantText = `![${cleanPrompt}](${imageUrl})\n\n*Prompt:* ${enhancedPrompt}`;
        setLastLatency(latency);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: assistantText, latency } : m
          )
        );

        if (activeConvId) {
          try {
            await supabase.from("messages").insert({
              conversation_id: activeConvId,
              role: "assistant",
              content: assistantText,
            });
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", activeConvId);
            if (currentUser?.email) {
              loadConversations(currentUser.email);
            }
          } catch (err) {
            console.error("Error saving image message to Supabase", err);
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to generate image.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: `❌ Error: ${errorMessage}` } : m
          )
        );
      } finally {
        setIsLoading(false);
        setIsImageMode(false);
      }
      return;
    }

    try {
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
      let displayedLength = 0;
      let streamDone = false;
      let finalLatency: number | undefined = undefined;
      let streamTimer: ReturnType<typeof setInterval> | null = null;

      // Smooth ChatGPT-style pacing so Groq bursts render calmly word-by-word
      const drainPromise = new Promise<void>((resolve) => {
        streamTimer = setInterval(() => {
          if (displayedLength < assistantText.length) {
            const remaining = assistantText.length - displayedLength;
            const step = Math.max(2, Math.min(8, Math.ceil(remaining / 40)));
            displayedLength = Math.min(assistantText.length, displayedLength + step);
            const slice = assistantText.slice(0, displayedLength);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessageId ? { ...m, content: slice } : m))
            );
          } else if (streamDone) {
            if (streamTimer) clearInterval(streamTimer);
            resolve();
          }
        }, 22);
      });

      try {
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
                  } else if (parsed.type === "limits") {
                    setLimits(parsed.data);
                  } else if (parsed.type === "done") {
                    const elapsed = (performance.now() - startTime) / 1000;
                    setLastLatency(elapsed);
                    finalLatency = parsed.latency || elapsed;
                  } else if (parsed.type === "error") {
                    throw new Error(parsed.data);
                  }
                } catch (parseErr) {
                  if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
                    throw parseErr;
                  }
                }
              }
            }
          }
        }

        streamDone = true;
        await drainPromise;
      } finally {
        if (streamTimer) clearInterval(streamTimer);
      }

      if (finalLatency !== undefined) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: assistantText, latency: finalLatency }
              : m
          )
        );
      }

      if (activeConvId && assistantText.trim()) {
        try {
          await supabase.from("messages").insert({
            conversation_id: activeConvId,
            role: "assistant",
            content: assistantText,
          });
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", activeConvId);

          if (currentUser?.email) {
            loadConversations(currentUser.email);
          }
        } catch (err) {
          console.error("Error saving assistant message to Supabase", err);
        }
      }

      const estTokens = Math.round((promptWithContext.length + assistantText.length) / 4);
      setSessionTokens((prev) => prev + estTokens);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to communicate with Groq backend.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, content: `❌ Error: ${errorMessage}` } : m
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

  const exportAsPDF = (content: string, title = "GroqChat_Response") => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxLineWidth = pageWidth - margin * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(91, 91, 255);
    doc.text("GroqChat AI", margin, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(122, 126, 146);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 25);

    doc.setDrawColor(230, 232, 242);
    doc.line(margin, 29, pageWidth - margin, 29);

    const cleanText = content
      .replace(/```[\s\S]*?```/g, (match) => {
        return "\n[Code Block]\n" + match.replace(/```\w*\n?/g, "") + "\n";
      })
      .replace(/!\[.*?\]\(.*?\)/g, "[Generated Image]")
      .replace(/#+\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(18, 19, 26);

    const lines = doc.splitTextToSize(cleanText, maxLineWidth);
    let y = 38;
    const lineHeight = 6;
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[i], margin, y);
      y += lineHeight;
    }

    doc.save(`${title}_${Date.now()}.pdf`);
  };

  const exportAsDoc = (content: string, filename = "GroqChat_Document") => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Document</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #5B5BFF;">GroqChat Document</h2>
        <p style="color: #7A7E92; font-size: 12px;">Generated: ${new Date().toLocaleString()}</p>
        <hr/>
        <div>${content.replace(/\n/g, "<br/>")}</div>
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff", htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const user: UserProfile = {
      name: nameInput.trim() || emailInput.split("@")[0],
      email: emailInput.trim(),
      image: null,
    };
    setCurrentUser(user);
    localStorage.setItem("groqchat_user", JSON.stringify(user));
  };

  const handleGuestLogin = () => {
    const user: UserProfile = {
      name: "Guest User",
      email: "guest@groqchat.app",
      image: null,
    };
    setCurrentUser(user);
    localStorage.setItem("groqchat_user", JSON.stringify(user));
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem("groqchat_user");
    setMessages([]);
    setConversations([]);
    setCurrentConversationId(null);
  };

  const usedTokens = Math.max(limits.limit_tokens - limits.remaining_tokens, 0);
  const tokensUsedPct = Math.min(
    100,
    Math.max(1, Math.round((usedTokens / Math.max(limits.limit_tokens, 1)) * 100))
  );

  const userInitials = (currentUser?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // 1. Loading Session State
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#EDEFF7] select-none">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo size={48} />
          <p className="text-xs text-[#7A7E92] font-medium tracking-wide">Starting GroqChat...</p>
        </div>
      </div>
    );
  }

  // 2. Authentication Gate (Matching Indigo Canvas Design)
  if (!currentUser) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-[#EDEFF7] px-4 select-none">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-[0_1px_2px_rgba(30,30,80,.05),0_24px_48px_-24px_rgba(40,40,120,.22)] text-center">
          <div className="flex justify-center mb-5">
            <BrandLogo size={54} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#12131A]">Welcome to GroqChat</h1>
          <p className="text-xs text-[#7A7E92] mt-2 mb-6 leading-relaxed">
            Ultra-fast Groq LPU workspace with AI image generation, code tools, and PDF export.
          </p>

          {!showEmailForm ? (
            <div className="space-y-3">
              <div className="flex justify-center min-h-[44px]">
                <div id="googleSignInContainer" />
              </div>

              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E6E8F2]" />
                <span className="text-[11px] uppercase tracking-wider text-[#7A7E92] font-medium">
                  or
                </span>
                <div className="flex-1 h-px bg-[#E6E8F2]" />
              </div>

              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-[#E6E8F2] bg-white hover:bg-[#F5F6FB] text-[#12131A] font-semibold text-xs py-3 px-4 transition-all"
              >
                <Mail className="h-4 w-4 text-[#5B5BFF]" />
                <span>Continue with Email &amp; Name</span>
              </button>

              <button
                onClick={handleGuestLogin}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#F5F6FB] hover:bg-[#EEEEFF] text-[#12131A] font-medium text-xs py-2.5 px-4 transition-colors"
              >
                <User className="h-3.5 w-3.5 text-[#7A7E92]" />
                <span>Continue as Guest (Instant Preview)</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-3 text-left">
              <div>
                <label className="text-xs font-semibold text-[#12131A] block mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Akshit Negi"
                  className="w-full rounded-xl border border-[#E6E8F2] bg-[#F5F6FB] px-3.5 py-2.5 text-xs text-[#12131A] focus:bg-white focus:border-[#5B5BFF] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#12131A] block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-[#E6E8F2] bg-[#F5F6FB] px-3.5 py-2.5 text-xs text-[#12131A] focus:bg-white focus:border-[#5B5BFF] focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white font-semibold text-xs py-3 px-4 shadow-md transition-opacity hover:opacity-95"
              >
                <span>Enter GroqChat</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full text-center text-xs text-[#7A7E92] hover:text-[#12131A] pt-1"
              >
                ← Back to all options
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-[#E6E8F2] grid grid-cols-2 gap-3 text-left">
            <div className="flex items-center gap-2 text-[11px] text-[#7A7E92]">
              <Shield className="h-3.5 w-3.5 text-[#14A06B] flex-shrink-0" />
              <span>Private Workspace</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7A7E92]">
              <Sparkles className="h-3.5 w-3.5 text-[#5B5BFF] flex-shrink-0" />
              <span>Groq + Flux Images</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Authenticated Workspace
  const activeModelObj = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  return (
    <div className="relative flex md:grid md:grid-cols-[252px_minmax(0,1fr)] gap-5 h-screen w-screen bg-[#EDEFF7] md:p-3.5 md:pl-1.5 overflow-hidden text-[#12131A]">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/25 z-20 md:hidden"
        />
      )}

      {/* =====================================================================
          LEFT SIDEBAR (Canvas Floating Navigation + Recent Chats + Profile)
      ===================================================================== */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-[268px] md:w-auto flex flex-col gap-5 p-4 md:p-3 md:pl-3.5 bg-[#EDEFF7] transition-transform duration-200 select-none overflow-y-auto ${mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
          }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} />
            <div>
              <b className="block text-[17px] font-bold tracking-tight leading-tight text-[#12131A]">
                GroqChat
              </b>
              <small className="text-[12px] text-[#7A7E92]">AI workspace</small>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#7A7E92] hover:text-[#12131A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Conversation Button */}
        <button
          onClick={startNewChat}
          className="flex items-center gap-2.5 bg-[#12131A] text-white font-semibold text-sm rounded-[14px] px-3.5 py-3 hover:-translate-y-0.5 transition-transform shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New conversation</span>
          <kbd className="ml-auto text-[11px] font-normal opacity-60">Ctrl K</kbd>
        </button>

        {/* Workspace Nav */}
        <nav className="flex flex-col gap-0.5 text-sm">
          <button
            onClick={startNewChat}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white text-[#12131A] font-medium shadow-[0_1px_2px_rgba(30,30,80,.08)] text-left"
          >
            <MessageSquare className="h-4 w-4 text-[#5B5BFF]" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setIsImageMode(!isImageMode)}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium transition-colors text-left ${isImageMode
              ? "bg-[#EEEEFF] text-[#5B5BFF]"
              : "text-[#7A7E92] hover:bg-white/70 hover:text-[#12131A]"
              }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Image Studio</span>
          </button>
          <button
            onClick={() => {
              setShowPromptLibrary(true);
              setMobileSidebarOpen(false);
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#7A7E92] hover:bg-white/70 hover:text-[#12131A] font-medium transition-colors text-left"
          >
            <BookOpen className="h-4 w-4 text-[#5B5BFF]" />
            <span>Prompt Library</span>
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#7A7E92] hover:bg-white/70 hover:text-[#12131A] font-medium transition-colors text-left"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Persona &amp; Temp</span>
          </button>
        </nav>

        {/* Recent Conversations (Supabase: Search, Rename, Share, Delete) */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-3 pb-1.5">
            <h2 className="text-[12px] font-medium text-[#7A7E92] opacity-85">Recent</h2>
            <span className="text-[11px] font-semibold text-[#5B5BFF] bg-[#EEEEFF] px-2 py-0.5 rounded-full">
              {conversations.length}
            </span>
          </div>

          {/* Search Input */}
          <div className="px-1 pb-2">
            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 text-[#7A7E92] absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full rounded-xl bg-white/80 focus:bg-white border border-transparent focus:border-[#5B5BFF] pl-8 pr-7 py-1.5 text-xs text-[#12131A] placeholder:text-[#7A7E92] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-[#7A7E92] hover:text-[#12131A]"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {filteredConversations.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#7A7E92]">
                {searchQuery ? "No matching chats" : "No saved chats yet"}
              </div>
            ) : (
              filteredConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => editingConvId !== c.id && selectConversation(c)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-[13.5px] transition-colors ${currentConversationId === c.id
                    ? "bg-white text-[#12131A] font-medium shadow-[0_1px_2px_rgba(30,30,80,.06)]"
                    : "text-[#7A7E92] hover:bg-white/70 hover:text-[#12131A]"
                    }`}
                >
                  {editingConvId === c.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => saveRename(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(c.id);
                        if (e.key === "Escape") setEditingConvId(null);
                      }}
                      className="w-full bg-[#F5F6FB] border border-[#5B5BFF] rounded-lg px-2 py-0.5 text-xs text-[#12131A] focus:outline-none"
                    />
                  ) : (
                    <>
                      <span className="truncate">{c.title || "Untitled Chat"}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
                        <button
                          onClick={(e) => startRenaming(e, c)}
                          className="p-1 text-[#7A7E92] hover:text-[#5B5BFF] rounded"
                          title="Rename chat"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareConversation(c.id);
                          }}
                          className="p-1 text-[#7A7E92] hover:text-[#5B5BFF] rounded"
                          title="Copy share link"
                        >
                          <Share2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => deleteConversation(e, c.id)}
                          className="p-1 text-[#7A7E92] hover:text-red-500 rounded"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* User Profile Card */}
        <div className="mt-auto flex items-center gap-2.5 p-2.5 rounded-2xl bg-white shadow-[0_1px_2px_rgba(30,30,80,.06)]">
          {currentUser?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.image}
              alt={currentUser.name}
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#EEEEFF] text-[#5B5BFF] grid place-items-center font-semibold text-xs flex-shrink-0">
              {userInitials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <b className="block text-[13.5px] font-semibold leading-tight truncate text-[#12131A]">
              {currentUser?.name}
            </b>
            <small className="block text-[11.5px] text-[#7A7E92] truncate">
              {currentUser?.email}
            </small>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-[#7A7E92] hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN FLOATING WHITE PANEL
      ===================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 h-full bg-white md:rounded-[28px] shadow-[0_1px_2px_rgba(30,30,80,.05),0_24px_48px_-24px_rgba(40,40,120,.22)] overflow-hidden relative">
        {/* Top Bar */}
        <header className="flex items-center gap-2.5 px-4 md:px-6 py-4 select-none border-b border-[#E6E8F2]/60">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden w-9 h-9 rounded-xl grid place-items-center text-[#7A7E92] hover:bg-[#F5F6FB]"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Model Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowModelMenu(!showModelMenu);
                setShowResponseMenu(false);
              }}
              className="flex items-center gap-2 font-semibold text-[15px] px-3 py-1.5 rounded-xl hover:bg-[#F5F6FB] transition-colors text-[#12131A]"
            >
              <span>{activeModelObj.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#7A7E92]" />
            </button>

            {showModelMenu && (
              <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-[#E6E8F2] bg-white p-1.5 shadow-xl z-40">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${selectedModel === m.id
                      ? "bg-[#EEEEFF] text-[#5B5BFF]"
                      : "hover:bg-[#F5F6FB] text-[#12131A]"
                      }`}
                  >
                    <div className="text-xs font-semibold">{m.name}</div>
                    <div className="text-[11px] text-[#7A7E92]">{m.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F6FB] text-[#7A7E92]">
            Groq LPU
          </span>
          <span className="hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-[#E3F6EE] text-[#14A06B]">
            Fast
          </span>

          <div className="flex-1" />

          {/* Usage & Speed Pill (Toggles Floating Insights Popover) */}
          <button
            id="usageToggleBtn"
            onClick={() => setShowInsights(!showInsights)}
            aria-expanded={showInsights}
            className={`flex items-center gap-2 bg-[#F5F6FB] px-3 py-1.5 rounded-full text-xs font-medium transition-all ${showInsights ? "ring-2 ring-[#5B5BFF]" : "hover:ring-1 hover:ring-[#5B5BFF]"
              }`}
          >
            <span
              className="w-5 h-5 rounded-full relative flex-shrink-0"
              style={{
                background: `conic-gradient(#5B5BFF, #B06BFF ${tokensUsedPct}%, #E6E8F2 0)`,
              }}
            >
              <span className="absolute inset-[4px] rounded-full bg-[#F5F6FB]" />
            </span>
            <span className="hidden sm:inline text-[#12131A]">
              {limits.remaining_tokens.toLocaleString()} left
            </span>
          </button>

          {currentConversationId && (
            <button
              onClick={() => shareConversation(currentConversationId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${shareCopied
                ? "bg-[#E3F6EE] text-[#14A06B]"
                : "bg-[#F5F6FB] text-[#7A7E92] hover:text-[#5B5BFF] hover:bg-[#EEEEFF]"
                }`}
              title="Copy public share link"
            >
              {shareCopied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Link copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={() => exportAsDoc(messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n"), "GroqChat_Transcript")}
              className="w-9 h-9 rounded-xl grid place-items-center text-[#7A7E92] hover:bg-[#F5F6FB] hover:text-[#12131A] transition-colors"
              title="Export Full Chat"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </header>

        {/* Scrollable Thread */}
        <div className="flex-1 overflow-y-auto px-4 md:px-7 pt-7 pb-3">
          <div className="max-w-[720px] mx-auto flex flex-col gap-8">
            {isLoadingConversation ? (
              <div className="flex flex-col items-center justify-center pt-24 text-[#7A7E92] gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-[#5B5BFF]" />
                <p className="text-xs font-medium">Loading conversation...</p>
              </div>
            ) : messages.length === 0 ? (
              /* Welcome / Starter Thread */
              <>
                <div className="flex gap-3.5 items-start">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white grid place-items-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(91,91,255,0.6)]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-semibold tracking-tight leading-snug text-[#12131A] mb-2">
                      Hello, {currentUser?.name?.split(" ")[0] || "there"}.
                    </h1>
                    <p className="text-[#4A4D5E] text-[15px] leading-relaxed mb-4 max-w-[60ch]">
                      Ask anything, write and download code, export formatted PDFs, or describe an
                      image to generate it with <b className="font-medium text-[#12131A]">Leonardo Lucid</b>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:pl-[50px]">
                  {STARTER_IDEAS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(item.prompt)}
                      className="flex flex-col items-start gap-3 text-left p-4 rounded-[18px] bg-[#F5F6FB] hover:bg-white hover:-translate-y-0.5 hover:ring-2 hover:ring-[#5B5BFF] transition-all"
                    >
                      <span className="w-8 h-8 rounded-[11px] bg-white grid place-items-center text-base shadow-2xs">
                        {item.icon}
                      </span>
                      <div>
                        <b className="block font-medium text-sm text-[#12131A] leading-snug">
                          {item.title}
                        </b>
                        <small className="block text-[#7A7E92] text-xs mt-0.5 font-normal">
                          {item.desc}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    className="self-end max-w-[85%] bg-[#12131A] text-white px-5 py-3 rounded-[22px_22px_6px_22px] text-[15px] leading-relaxed shadow-xs"
                  >
                    {m.attachment && (
                      <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] text-white/90">
                        <Paperclip className="h-3 w-3" />
                        <span>{m.attachment}</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3.5 items-start">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white grid place-items-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(91,91,255,0.6)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {!m.content && isLoading ? (
                        <div className="flex gap-1.5 py-3.5">
                          <i className="w-2 h-2 rounded-full bg-[#5B5BFF] animate-bounce" />
                          <i className="w-2 h-2 rounded-full bg-[#5B5BFF] animate-bounce [animation-delay:0.15s]" />
                          <i className="w-2 h-2 rounded-full bg-[#B06BFF] animate-bounce [animation-delay:0.3s]" />
                        </div>
                      ) : (
                        <>
                          <div className="prose prose-slate prose-sm max-w-none break-words text-[15px] text-[#4A4D5E]">
                            <ReactMarkdown
                              urlTransform={(url) => {
                                if (url.startsWith("data:image/")) return url;
                                if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url;
                                return "";
                              }}
                              components={{
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
                                        className="bg-[#F5F6FB] text-[#5B5BFF] px-1.5 py-0.5 rounded text-xs font-mono font-medium"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    );
                                  }
                                },
                                h1: ({ ...props }) => (
                                  <h1
                                    className="text-xl font-semibold tracking-tight mt-2 mb-2 text-[#12131A]"
                                    {...props}
                                  />
                                ),
                                h2: ({ ...props }) => (
                                  <h2
                                    className="text-lg font-semibold mt-2.5 mb-1.5 text-[#12131A]"
                                    {...props}
                                  />
                                ),
                                h3: ({ ...props }) => (
                                  <h3
                                    className="text-base font-semibold mt-2 mb-1 text-[#12131A]"
                                    {...props}
                                  />
                                ),
                                p: ({ ...props }) => (
                                  <p className="mb-2.5 leading-relaxed text-[#4A4D5E]" {...props} />
                                ),
                                ul: ({ ...props }) => (
                                  <ul
                                    className="list-disc list-inside mb-2.5 space-y-1 text-[#4A4D5E]"
                                    {...props}
                                  />
                                ),
                                ol: ({ ...props }) => (
                                  <ol
                                    className="list-decimal list-inside mb-2.5 space-y-1 text-[#4A4D5E]"
                                    {...props}
                                  />
                                ),
                                strong: ({ ...props }) => (
                                  <strong className="font-medium text-[#12131A]" {...props} />
                                ),
                                blockquote: ({ ...props }) => (
                                  <blockquote
                                    className="border-l-4 border-[#5B5BFF]/40 pl-3 italic text-[#7A7E92] my-2"
                                    {...props}
                                  />
                                ),
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                img: ({ src, alt }: any) => (
                                  <GeneratedImage src={src || ""} alt={alt || "Generated Image"} />
                                ),
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                          </div>

                          {m.content && (
                            <div className="mt-2">
                              <div className="text-[12px] text-[#7A7E92] mb-1.5">
                                {activeModelObj.name} ·{" "}
                                {m.latency ? `${m.latency.toFixed(2)}s` : "Groq LPU"}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 -ml-2">
                                <button
                                  onClick={() => copyToClipboard(m.content, m.id)}
                                  className="flex items-center gap-1.5 text-xs text-[#7A7E92] hover:bg-[#F5F6FB] hover:text-[#12131A] px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  {copiedId === m.id ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-[#14A06B]" />
                                      <span className="text-[#14A06B] font-medium">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => exportAsPDF(m.content)}
                                  className="flex items-center gap-1.5 text-xs text-[#7A7E92] hover:bg-[#F5F6FB] hover:text-[#12131A] px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  <FileDown className="h-3.5 w-3.5 text-[#5B5BFF]" />
                                  <span>PDF</span>
                                </button>
                                <button
                                  onClick={() => exportAsDoc(m.content)}
                                  className="flex items-center gap-1.5 text-xs text-[#7A7E92] hover:bg-[#F5F6FB] hover:text-[#12131A] px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  <FileText className="h-3.5 w-3.5 text-[#B06BFF]" />
                                  <span>Doc</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Docked Composer */}
        <div className="px-4 md:px-7 pt-2 pb-5">
          <div className="max-w-[720px] mx-auto">
            {attachment && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#EEEEFF] px-3 py-1 text-xs text-[#5B5BFF] font-medium">
                <Paperclip className="h-3.5 w-3.5" />
                <span>
                  {attachment.name} ({attachment.size_kb} KB)
                </span>
                <button
                  onClick={() => setAttachment(null)}
                  className="hover:text-[#12131A] ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.py,.md,.csv,.json,.html"
              className="hidden"
            />

            <div className="bg-[#F5F6FB] focus-within:bg-white rounded-[22px] p-3.5 pl-5 pb-2.5 transition-all focus-within:ring-2 focus-within:ring-[#5B5BFF] focus-within:shadow-[0_12px_28px_-16px_rgba(91,91,255,0.45)]">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading) sendMessage();
                  }
                }}
                placeholder={
                  isImageMode
                    ? "Describe the image you want to generate…"
                    : "Ask anything, write code, or generate an image…"
                }
                className="w-full border-0 outline-none bg-transparent resize-none text-[15px] text-[#12131A] placeholder:text-[#9A9DB0] py-1 pb-2 max-h-[140px]"
              />

              <div className="flex items-center gap-1.5 -ml-2 relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 text-[13px] text-[#7A7E92] hover:bg-[#5B5BFF]/10 hover:text-[#5B5BFF] px-3 py-1.5 rounded-full transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{isUploading ? "Reading..." : "Attach"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImageMode(!isImageMode)}
                  className={`flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full transition-colors ${isImageMode
                    ? "bg-[#EEEEFF] text-[#5B5BFF] font-medium"
                    : "text-[#7A7E92] hover:bg-[#5B5BFF]/10 hover:text-[#5B5BFF]"
                    }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{isImageMode ? "Image ON" : "Image"}</span>
                </button>

                {/* Quick Response Length Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResponseMenu(!showResponseMenu);
                      setShowModelMenu(false);
                    }}
                    className="hidden sm:flex items-center gap-1.5 text-[13px] text-[#7A7E92] hover:bg-[#5B5BFF]/10 hover:text-[#5B5BFF] px-3 py-1.5 rounded-full transition-colors"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    <span className="capitalize">{responseLength}</span>
                  </button>

                  {showResponseMenu && (
                    <div className="absolute bottom-11 left-0 w-40 rounded-2xl border border-[#E6E8F2] bg-white p-1.5 shadow-xl z-40">
                      {RESPONSE_LENGTH_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setResponseLength(opt.id as "short" | "medium" | "detailed");
                            setShowResponseMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium ${responseLength === opt.id
                            ? "bg-[#EEEEFF] text-[#5B5BFF]"
                            : "text-[#12131A] hover:bg-[#F5F6FB]"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  aria-label="Send"
                  className="ml-auto w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white grid place-items-center shadow-[0_8px_16px_-8px_rgba(91,91,255,0.7)] hover:-translate-y-0.5 disabled:opacity-35 disabled:hover:translate-y-0 transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="text-center text-[12px] text-[#7A7E92] mt-2.5">
              GroqChat may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </main>

      {/* =====================================================================
          FLOATING INSIGHTS POPOVER (Quota Ring + Speed Sparkline + Quick Tools)
      ===================================================================== */}
      {showInsights && (
        <aside
          ref={insightsRef}
          className="fixed top-[72px] right-4 md:right-7 w-[330px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-96px)] z-40 flex flex-col overflow-y-auto bg-white rounded-[22px] px-4.5 py-2 shadow-[0_0_0_1px_#E6E8F2,0_28px_60px_-20px_rgba(40,40,120,.35)]"
        >
          <div className="p-4 border-b border-[#E6E8F2]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-[#7A7E92]">
                Live quota · {activeModelObj.name}
              </h2>
              <button
                onClick={syncLimits}
                className="p-1 rounded-lg text-[#7A7E92] hover:bg-[#F5F6FB] hover:text-[#12131A]"
                title="Refresh limits"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="w-[84px] h-[84px] rounded-full flex-none grid place-items-center"
                style={{
                  background: `conic-gradient(#5B5BFF, #B06BFF ${tokensUsedPct}%, #E6E8F2 0)`,
                }}
              >
                <div className="w-[66px] h-[66px] rounded-full bg-white grid place-items-center font-semibold text-sm text-[#12131A]">
                  {tokensUsedPct}%
                </div>
              </div>
              <div>
                <b className="block text-2xl font-bold tracking-tight leading-tight text-[#12131A]">
                  {limits.remaining_tokens.toLocaleString()}
                </b>
                <small className="block text-xs text-[#7A7E92] mt-0.5">
                  tokens left · {usedTokens.toLocaleString()} of{" "}
                  {limits.limit_tokens.toLocaleString()} used
                </small>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-[#E6E8F2]">
            <h2 className="text-[13px] font-semibold text-[#7A7E92] mb-2">Speed</h2>
            <div className="flex items-end justify-between gap-3">
              <div>
                <b className="text-2xl font-bold tracking-tight text-[#14A06B] leading-none">
                  {lastLatency ? `${lastLatency.toFixed(2)}s` : "—"}
                </b>
                <small className="block text-xs text-[#7A7E92] mt-1.5">
                  Est. session: ~{sessionTokens.toLocaleString()} tokens
                </small>
              </div>
              <svg viewBox="0 0 130 44" fill="none" className="w-[120px] h-[40px]">
                <defs>
                  <linearGradient id="sparkLineGrad" x1="0" x2="1">
                    <stop offset="0%" stopColor="#5B5BFF" />
                    <stop offset="100%" stopColor="#B06BFF" />
                  </linearGradient>
                </defs>
                <path
                  d="M2 34 C14 30 18 14 30 20 S48 38 60 26 S78 6 92 16 S112 30 128 8"
                  stroke="url(#sparkLineGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <div className="p-3 space-y-1">
            <button
              onClick={() => {
                setShowSettingsModal(true);
                setShowInsights(false);
              }}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-[#F5F6FB] text-sm font-medium text-[#12131A] text-left"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#5B5BFF]" />
              <span>Persona &amp; Temperature</span>
            </button>
            <button
              onClick={() => {
                exportAsDoc(
                  messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n"),
                  "GroqChat_Transcript"
                );
                setShowInsights(false);
              }}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-[#F5F6FB] text-sm font-medium text-[#12131A] text-left"
            >
              <Download className="h-4 w-4 text-[#5B5BFF]" />
              <span>Export conversation</span>
            </button>
            <button
              onClick={() => {
                startNewChat();
                setShowInsights(false);
              }}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-red-50 text-sm font-medium text-red-600 text-left"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear current thread</span>
            </button>
          </div>
        </aside>
      )}

      {/* =====================================================================
          PROMPT LIBRARY MODAL
      ===================================================================== */}
      {showPromptLibrary && (
        <div
          onClick={() => setShowPromptLibrary(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-[24px] p-6 shadow-2xl border border-[#E6E8F2]"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F2]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EEEEFF] text-[#5B5BFF] grid place-items-center">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#12131A]">Prompt Library</h3>
                  <p className="text-xs text-[#7A7E92]">
                    1-click templates &amp; your saved custom prompts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewPromptForm(!showNewPromptForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white text-xs font-semibold hover:opacity-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showNewPromptForm ? "Cancel" : "Save Prompt"}</span>
                </button>
                <button
                  onClick={() => setShowPromptLibrary(false)}
                  className="p-1.5 rounded-lg text-[#7A7E92] hover:bg-[#F5F6FB]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showNewPromptForm && (
              <form
                onSubmit={saveCustomPrompt}
                className="my-4 p-4 rounded-2xl bg-[#F5F6FB] border border-[#E6E8F2] space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newPromptTitle}
                    onChange={(e) => setNewPromptTitle(e.target.value)}
                    placeholder="Prompt title (e.g. LinkedIn Post)"
                    className="rounded-xl border border-[#E6E8F2] bg-white px-3 py-2 text-xs text-[#12131A] focus:border-[#5B5BFF] focus:outline-none"
                  />
                  <select
                    value={newPromptCategory}
                    onChange={(e) => setNewPromptCategory(e.target.value)}
                    className="rounded-xl border border-[#E6E8F2] bg-white px-3 py-2 text-xs text-[#12131A] focus:border-[#5B5BFF] focus:outline-none"
                  >
                    {promptCategories
                      .filter((c) => c !== "All")
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>
                <textarea
                  required
                  rows={3}
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder="Write your reusable prompt template..."
                  className="w-full rounded-xl border border-[#E6E8F2] bg-white p-3 text-xs text-[#12131A] focus:border-[#5B5BFF] focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#12131A] text-white text-xs font-semibold hover:opacity-90"
                >
                  Add to Library
                </button>
              </form>
            )}

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-1.5 py-3">
              {promptCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPromptCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${promptCategoryFilter === cat
                    ? "bg-[#12131A] text-white"
                    : "bg-[#F5F6FB] text-[#7A7E92] hover:text-[#12131A]"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Prompt Cards Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
              {visiblePrompts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => applyPromptTemplate(p.prompt)}
                  className="group flex flex-col justify-between p-4 rounded-2xl bg-[#F5F6FB] hover:bg-white border border-transparent hover:border-[#5B5BFF] cursor-pointer transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EEEEFF] text-[#5B5BFF]">
                        {p.category}
                      </span>
                      {p.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomPrompt(p.id);
                          }}
                          className="p-1 text-[#7A7E92] hover:text-red-500 rounded"
                          title="Delete custom prompt"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-[#12131A] mb-1">{p.title}</h4>
                    <p className="text-xs text-[#7A7E92] line-clamp-3">{p.prompt}</p>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold text-[#5B5BFF] flex items-center gap-1">
                    <span>Use template</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PERSONA & TEMPERATURE MODAL
      ===================================================================== */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl border border-[#E6E8F2] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#12131A]">Workspace Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg text-[#7A7E92] hover:bg-[#F5F6FB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#7A7E92] mb-1.5">
                <span>Temperature</span>
                <span className="font-mono text-[#12131A]">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#5B5BFF] cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#7A7E92] block mb-1.5">
                System Persona
              </label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-xl border border-[#E6E8F2] bg-[#F5F6FB] p-3 text-xs text-[#12131A] focus:bg-white focus:border-[#5B5BFF] focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
