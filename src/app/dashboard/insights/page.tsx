"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Bot,
  User,
  Send,
  Sparkles,
  Building2,
  Check,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Layers,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompetitorOption {
  id: string;
  name: string;
  domain: string;
  industry?: string | null;
  activePlanCount?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  groundedCompetitors?: Array<{
    id: string;
    name: string;
    domain: string;
  }>;
}

const SAMPLE_PROMPTS = [
  "Compare ChatGPT Plus vs Claude Pro: pricing, limits, and core features.",
  "What are Gemini's available subscription tiers in India and their limits?",
  "Which competitors offer custom enterprise tiers and what are their features?",
  "Summarize all recent pricing changes detected across our tracked competitors.",
  "Which tool gives the highest message quota or usage limits for under $30/month?",
];

export default function InsightsChatbotPage() {
  const [competitorsList, setCompetitorsList] = useState<CompetitorOption[]>([]);
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>(["all"]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCompetitors, setLoadingCompetitors] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load active competitors list
  useEffect(() => {
    async function loadCompetitors() {
      setLoadingCompetitors(true);
      try {
        const res = await fetch("/api/competitors");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const comps = json.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            domain: c.domain,
            industry: c.industry,
            activePlanCount: c.pricingPlans?.length || 0,
          }));
          setCompetitorsList(comps);
        }
      } catch (err) {
        console.error("Failed to load competitors:", err);
      } finally {
        setLoadingCompetitors(false);
      }
    }
    loadCompetitors();

    // Default welcome message
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: `👋 **Welcome to RivalScope Intelligence Assistant!**\n\nI have real-time access to your verified competitor database (plans, pricing, feature snapshots, usage limits, and recent pricing shifts). \n\nYou can select **any individual competitor, multiple competitors, or all competitors** above to focus the query. Ask me anything about their pricing strategy, feature tiers, or differences!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

  // Competitor selection toggles
  const handleSelectAll = () => {
    setSelectedCompetitorIds(["all"]);
  };

  const toggleCompetitor = (id: string) => {
    if (selectedCompetitorIds.includes("all")) {
      // Switching from all to single selection
      setSelectedCompetitorIds([id]);
      return;
    }

    if (selectedCompetitorIds.includes(id)) {
      const remaining = selectedCompetitorIds.filter((cId) => cId !== id);
      if (remaining.length === 0) {
        setSelectedCompetitorIds(["all"]);
      } else {
        setSelectedCompetitorIds(remaining);
      }
    } else {
      setSelectedCompetitorIds([...selectedCompetitorIds, id]);
    }
  };

  const isSelected = (id: string) => {
    return selectedCompetitorIds.includes(id);
  };

  const isAllSelected = selectedCompetitorIds.includes("all");

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Build conversation history for API
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          competitorIds: isAllSelected ? ["all"] : selectedCompetitorIds,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to get chatbot response");
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: json.data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        groundedCompetitors: json.data.groundedCompetitors,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Error retrieving intelligence:** ${err.message || "An unexpected error occurred. Please try again."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Selected competitor badge label
  const activeSelectionLabel = isAllSelected
    ? `All Tracked Competitors (${competitorsList.length})`
    : `${selectedCompetitorIds.length} Competitor${selectedCompetitorIds.length > 1 ? "s" : ""} Selected`;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-7xl mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Strategic Intelligence Chatbot
                </h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[11px]">
                  <ShieldCheck className="h-3 w-3" /> Grounded in Database
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Ask questions scoped to any single competitor, multiple competitors, or market-wide.
              </p>
            </div>
          </div>

          {/* Quick Clear Conversation Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMessages([
                {
                  id: "welcome-reset",
                  role: "assistant",
                  content: "Chat reset. Select your target competitor(s) and start asking questions!",
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ])
            }
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear Chat
          </Button>
        </div>

        {/* Competitor Selector Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mr-1">
            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
            Active Scope:
          </span>

          {/* Select All Pill */}
          <button
            onClick={handleSelectAll}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              isAllSelected
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {isAllSelected && <Check className="h-3 w-3" />}
            All Competitors ({competitorsList.length})
          </button>

          {/* Individual Competitors Toggle Pills */}
          {competitorsList.map((c) => {
            const active = isSelected(c.id) && !isAllSelected;
            return (
              <button
                key={c.id}
                onClick={() => toggleCompetitor(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : isAllSelected
                    ? "bg-slate-100/70 text-slate-600 hover:bg-slate-200"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                <span>{c.name}</span>
                {c.activePlanCount !== undefined && c.activePlanCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {c.activePlanCount} plans
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Container */}
      <Card className="flex-1 flex flex-col border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Messages Scroll View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar Icon */}
              <div
                className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-indigo-600 text-white shadow-xs"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              {/* Message Content Bubble */}
              <div
                className={`max-w-[82%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-tr-none"
                    : "bg-slate-50 border border-slate-200/90 text-slate-800 rounded-tl-none shadow-2xs"
                }`}
              >
                {/* Markdown content rendering */}
                <div className="whitespace-pre-wrap space-y-2">
                  {msg.content}
                </div>

                {/* Grounded Competitors Tags (if returned) */}
                {msg.groundedCompetitors && msg.groundedCompetitors.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-400">Grounded in:</span>
                    {msg.groundedCompetitors.map((gc) => (
                      <span
                        key={gc.id}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-700"
                      >
                        {gc.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`text-[10px] mt-2 flex items-center gap-1 ${
                    msg.role === "user" ? "text-slate-400 justify-end" : "text-slate-400"
                  }`}
                >
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white shrink-0 flex items-center justify-center shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none p-4 text-xs text-slate-600 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Consulting database records and analyzing competitive positioning...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts (when few messages) */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Suggested questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs text-left transition-colors flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask a question grounded in ${activeSelectionLabel}... (Press Enter to send, Shift+Enter for newline)`}
              className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden px-2 py-1 leading-relaxed max-h-32"
            />
            <Button
              size="sm"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 h-9 px-3.5 rounded-lg transition-all"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Powered by Groq LLM & verified Neon DB crawl history</span>
            <span>Selected scope: <strong className="text-slate-600">{activeSelectionLabel}</strong></span>
          </div>
        </div>
      </Card>
    </div>
  );
}
