"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Sparkles, ArrowLeft, Loader2, Copy, Check, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SharedConversation {
  id: string;
  title: string;
  model?: string;
  created_at: string;
}

interface SharedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachment_name?: string | null;
}

export default function SharedChatPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const loadShared = async () => {
      setLoading(true);
      try {
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .select("id, title, model, created_at")
          .eq("id", id)
          .single();

        if (convErr || !conv) {
          setNotFound(true);
          return;
        }
        setConversation(conv as SharedConversation);

        const { data: msgs } = await supabase
          .from("messages")
          .select("id, role, content, attachment_name")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        if (msgs) {
          setMessages(msgs as SharedMessage[]);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    loadShared();
  }, [id]);

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadImg = async (src: string) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `groqchat_shared_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEFF7] p-3 md:p-6 text-[#12131A]">
      <div className="max-w-4xl mx-auto bg-white rounded-[28px] shadow-[0_1px_2px_rgba(30,30,80,.05),0_24px_48px_-24px_rgba(40,40,120,.22)] overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8F2]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white grid place-items-center flex-shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate text-[#12131A]">
                {conversation?.title || "Shared Conversation"}
              </h1>
              <p className="text-[11px] text-[#7A7E92]">
                Shared via GroqChat
                {conversation?.created_at
                  ? ` · ${new Date(conversation.created_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#12131A] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Open GroqChat</span>
          </Link>
        </header>

        <div className="p-6 md:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#7A7E92]">
              <Loader2 className="h-6 w-6 animate-spin text-[#5B5BFF]" />
              <span className="text-xs font-medium">Loading shared conversation...</span>
            </div>
          ) : notFound ? (
            <div className="text-center py-20">
              <h2 className="text-lg font-semibold text-[#12131A]">Conversation not found</h2>
              <p className="text-xs text-[#7A7E92] mt-1 mb-5">
                This shared chat link may have been deleted or does not exist.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white text-xs font-semibold"
              >
                Start your own chat
              </Link>
            </div>
          ) : (
            <div className="max-w-[720px] mx-auto flex flex-col gap-7">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    className="self-end max-w-[85%] bg-[#12131A] text-white px-5 py-3 rounded-[22px_22px_6px_22px] text-[15px] leading-relaxed"
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3.5 items-start">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B5BFF] to-[#B06BFF] text-white grid place-items-center flex-shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="prose prose-slate prose-sm max-w-none break-words text-[15px] text-[#4A4D5E]">
                        <ReactMarkdown
                          urlTransform={(url) => {
                            if (url.startsWith("data:image/")) return url;
                            if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url;
                            return "";
                          }}
                          components={{
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            img: ({ src, alt }: any) => (
                              <div className="my-3 max-w-md rounded-2xl overflow-hidden border border-[#E6E8F2] bg-[#F5F6FB]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src || ""}
                                  alt={alt || "Shared Image"}
                                  className="w-full h-auto object-cover"
                                />
                                <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-[#E6E8F2] text-[11px]">
                                  <span className="truncate font-medium text-[#12131A]">
                                    {alt || "Generated Image"}
                                  </span>
                                  <button
                                    onClick={() => handleDownloadImg(src || "")}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5F6FB] hover:bg-[#EEEEFF] text-[#5B5BFF] font-medium"
                                  >
                                    <Download className="h-3 w-3" /> Download
                                  </button>
                                </div>
                              </div>
                            ),
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#7A7E92] hover:text-[#12131A] px-2 py-1 rounded-lg hover:bg-[#F5F6FB]"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#14A06B]" />
                            <span className="text-[#14A06B]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
