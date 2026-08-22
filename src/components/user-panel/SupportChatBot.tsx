"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, X, Bot, UserRound } from "lucide-react";

type ChatRole = "bot" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

const FAQ: Array<{ match: RegExp; answer: string }> = [
  {
    match: /upload|glb|model|3d/i,
    answer:
      "Go to Products → Upload 3D Model, then drop a .glb, .obj, or .fbx file. After upload you can edit materials and publish.",
  },
  {
    match: /qr|scan/i,
    answer:
      "Publish a product first. QR Center then shows its permanent Main QR automatically — one QR per published product.",
  },
  {
    match: /share|link/i,
    answer:
      "Open Share Center → Create Share Link, pick a published product, then copy the link for clients.",
  },
  {
    match: /plan|billing|upgrade|subscription|price/i,
    answer:
      "Open Subscription to compare plans, or Billing for invoices. Upgrades are GST-inclusive and activate after payment.",
  },
  {
    match: /trial|limit|storage/i,
    answer:
      "Trial includes limited products and storage. Upgrade from Subscription when you need more capacity.",
  },
  {
    match: /login|password|account/i,
    answer:
      "Use Forgot password on the login page, or open Settings → Security to change password / enable 2FA.",
  },
];

const QUICK_PROMPTS = [
  "How do I upload a GLB?",
  "How do QR codes work?",
  "How do I share a product?",
  "Talk to support",
];

function botReply(input: string): string {
  const hit = FAQ.find((item) => item.match.test(input));
  if (hit) return hit.answer;
  if (/support|human|agent|ticket|help me/i.test(input)) {
    return "I can open a support ticket for you. Type: ticket: your issue (example: ticket: QR not scanning on Android).";
  }
  return "I can help with upload, QR, share links, billing, and account basics. Or type ticket: your message to reach the support team.";
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SupportChatBot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Hi — I’m the AR360 help bot. Ask about upload, QR, share, or billing. For a human, type ticket: your message.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hidden = useMemo(
    () =>
      pathname.startsWith("/dashboard/products/") &&
      pathname !== "/dashboard/products" &&
      pathname !== "/dashboard/products/new",
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function createTicketFromText(raw: string) {
    const description = raw.replace(/^ticket:\s*/i, "").trim();
    if (!description) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "bot",
          text: "Please add details after ticket: so our team knows how to help.",
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: description.slice(0, 80),
          description,
          category: "other",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not create ticket.");
      }
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "bot",
          text: `Ticket created${data.ticket?.ticketUid ? ` (${data.ticket.ticketUid})` : ""}. Our team will reply in Support.`,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "bot",
          text: error instanceof Error ? error.message : "Ticket creation failed. Try Support → Create New Ticket.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleSend(text: string) {
    const cleaned = text.trim();
    if (!cleaned || sending) return;

    setMessages((prev) => [...prev, { id: newId(), role: "user", text: cleaned }]);
    setInput("");

    if (/^ticket:/i.test(cleaned) || /talk to support/i.test(cleaned)) {
      if (/talk to support/i.test(cleaned)) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "bot",
            text: "Sure — reply with ticket: followed by your issue and I’ll create a support ticket.",
          },
        ]);
        return;
      }
      await createTicketFromText(cleaned);
      return;
    }

    setMessages((prev) => [...prev, { id: newId(), role: "bot", text: botReply(cleaned) }]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void handleSend(input);
  }

  if (hidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-4 z-[80] hidden flex-col items-end gap-3 md:flex md:right-6">
      {open ? (
        <div className="pointer-events-auto flex h-[min(520px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-[#E5E5E5] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between bg-[#111416] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#B6FF38] text-[#102000]">
                <Bot size={16} />
              </span>
              <div>
                <p className="text-sm font-bold">AR360 Help Bot</p>
                <p className="text-[11px] text-white/70">Instant answers · ticket to humans</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 hover:bg-white/10"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={sending}
                onClick={() => void handleSend(prompt)}
                className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#333] hover:border-[#B6FF38]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "bot" ? (
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EEF9E0] text-[#5FA800]">
                    <Bot size={14} />
                  </span>
                ) : null}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-5 ${
                    message.role === "user"
                      ? "bg-[#111416] text-white"
                      : "bg-[#F4F4F5] text-[#171717]"
                  }`}
                >
                  {message.text}
                </div>
                {message.role === "user" ? (
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F4F4F5] text-[#525252]">
                    <UserRound size={14} />
                  </span>
                ) : null}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-[#F0F0F0] p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything… or ticket: issue"
              className="h-11 flex-1 rounded-xl border border-[#E5E5E5] bg-white px-3 text-sm outline-none focus:border-[#84D400]"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#B6FF38] text-[#102000] disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto inline-flex h-14 items-center gap-2 rounded-full bg-[#111416] px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)] hover:bg-[#1c1f24]"
        aria-label={open ? "Close help chat" : "Open help chat"}
      >
        <MessageCircle size={18} className="text-[#B6FF38]" />
        {open ? "Close" : "Live help"}
      </button>
    </div>
  );
}
