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
  ShieldCheck,
  Plus,
  History,
  Trash2,
  Clock,
  Layers,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteAlert } from "@/components/ui/confirm-delete-alert";

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

interface ChatSessionItem {
  id: string;
  title: string;
  selectedCompetitors: string[];
  createdAt: string;
  updatedAt: string;
}

const SAMPLE_PROMPTS = [
  "Compare ChatGPT Plus vs Claude Pro: pricing, limits, and core features.",
  "What are Gemini's available subscription tiers in India and their limits?",
  "Which competitors offer custom enterprise tiers and what are their features?",
  "Summarize all recent pricing changes detected across our tracked competitors.",
  "Which tool gives the highest usage limits for under $30/month?",
];

export default function InsightsChatbotPage() {
  const [competitorsList, setCompetitorsList] = useState<CompetitorOption[]>([]);
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>(["all"]);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSessionItem | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load competitors & chat sessions on initial mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        // 1. Fetch competitors
        const compRes = await fetch("/api/competitors");
        const compJson = await compRes.json();
        if (compJson.success && Array.isArray(compJson.data)) {
          const comps = compJson.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            domain: c.domain,
            industry: c.industry,
            activePlanCount: c.pricingPlans?.length || 0,
          }));
          setCompetitorsList(comps);
        }

        // 2. Fetch past sessions
        const sessRes = await fetch("/api/insights/sessions");
        const sessJson = await sessRes.json();
        if (sessJson.success && Array.isArray(sessJson.data?.sessions)) {
          setSessions(sessJson.data.sessions);
          if (sessJson.data.sessions.length > 0) {
            // Load the most recent session
            loadSessionMessages(sessJson.data.sessions[0].id);
            return;
          }
        }

        // If no past sessions exist, start a default welcome state
        startNewChatSession();
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    }
    loadInitialData();
  }, []);

  // Fetch full message history for a chosen session
  const loadSessionMessages = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/insights/sessions/${sessionId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const { session, messages: loadedMessages } = json.data;

        // Restore active competitor scope from session
        if (Array.isArray(session.selectedCompetitors) && session.selectedCompetitors.length > 0) {
          setSelectedCompetitorIds(session.selectedCompetitors);
        }

        // Map messages
        const formatted: ChatMessage[] = loadedMessages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          groundedCompetitors: m.groundedCompetitorIds?.map((cId: string) => {
            const found = competitorsList.find((c) => c.id === cId);
            return { id: cId, name: found?.name || "Competitor", domain: found?.domain || "" };
          }),
        }));

        setMessages(formatted);
      }
    } catch (err) {
      console.error("Failed to load session messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Start fresh chat session
  const startNewChatSession = () => {
    setActiveSessionId(null);
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: `👋 **Welcome to RivalScope Intelligence Assistant!**\n\nI have real-time access to your verified competitor database (plans, pricing, feature snapshots, usage limits, and recent pricing shifts). \n\nYou can select **any individual competitor, multiple competitors, or all competitors** above to focus the query. Ask me anything about their pricing strategy, feature tiers, or differences!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Prompt delete chat session alert
  const promptDeleteSession = (e: React.MouseEvent, session: ChatSessionItem) => {
    e.stopPropagation();
    setSessionToDelete(session);
  };

  // Confirmed delete execution
  const executeDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);

    try {
      await fetch(`/api/insights/sessions/${sessionToDelete.id}`, { method: "DELETE" });
      const remaining = sessions.filter((s) => s.id !== sessionToDelete.id);
      setSessions(remaining);
      if (activeSessionId === sessionToDelete.id) {
        if (remaining.length > 0) {
          loadSessionMessages(remaining[0].id);
        } else {
          startNewChatSession();
        }
      }
      setSessionToDelete(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Competitor selection toggles
  const handleSelectAll = () => {
    setSelectedCompetitorIds(["all"]);
  };

  const toggleCompetitor = (id: string) => {
    if (selectedCompetitorIds.includes("all")) {
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

  const isSelected = (id: string) => selectedCompetitorIds.includes(id);
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
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId || undefined,
          messages: conversationHistory,
          competitorIds: isAllSelected ? ["all"] : selectedCompetitorIds,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to get chatbot response");
      }

      // Update active session ID
      if (json.data.sessionId && json.data.sessionId !== activeSessionId) {
        setActiveSessionId(json.data.sessionId);
        // Refresh session list in sidebar
        const sessRes = await fetch("/api/insights/sessions");
        const sessJson = await sessRes.json();
        if (sessJson.success) {
          setSessions(sessJson.data.sessions);
        }
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

  const activeSelectionLabel = isAllSelected
    ? `All Tracked Competitors (${competitorsList.length})`
    : `${selectedCompetitorIds.length} Competitor${selectedCompetitorIds.length > 1 ? "s" : ""} Selected`;

  return (
    <div className="flex h-[calc(100vh-80px)] max-w-7xl mx-auto gap-4">
      {/* Left Sidebar: Session History */}
      <div
        className={`${
          historySidebarOpen ? "w-64" : "w-12"
        } transition-all duration-200 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col shrink-0 overflow-hidden`}
      >
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          {historySidebarOpen ? (
            <>
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <History className="h-4 w-4 text-indigo-600" />
                <span>Chat History</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistorySidebarOpen(false)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                title="Collapse sidebar"
              >
                ✕
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistorySidebarOpen(true)}
              className="h-7 w-7 p-0 mx-auto text-slate-500 hover:text-slate-700"
              title="Expand history"
            >
              <History className="h-4 w-4" />
            </Button>
          )}
        </div>

        {historySidebarOpen && (
          <>
            {/* New Chat Button */}
            <div className="p-2.5">
              <Button
                onClick={startNewChatSession}
                size="sm"
                className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 justify-start gap-1.5 text-xs font-semibold h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Analysis</span>
              </Button>
            </div>

            {/* Past Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No previous sessions yet
                </div>
              ) : (
                sessions.map((sess) => {
                  const isActive = activeSessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => loadSessionMessages(sess.id)}
                      className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white font-medium shadow-xs"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                        <span className="truncate">{sess.title}</span>
                      </div>
                      <button
                        onClick={(e) => promptDeleteSession(e, sess)}
                        className={`opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity ${
                          isActive ? "text-white/80 hover:text-white" : "text-slate-400"
                        }`}
                        title="Delete session"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Main Right Area: Chat & Competitor Selector */}
      <div className="flex-1 flex flex-col min-w-0 space-y-3">
        {/* Top Scope & Controls Header */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">
                    Strategic Intelligence Assistant
                  </h1>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px] py-0">
                    <ShieldCheck className="h-3 w-3" /> Grounded in Database
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Real-time competitive analysis with structured, source-verified replies.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={startNewChatSession}
              className="text-xs h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Analysis</span>
            </Button>
          </div>

          {/* Competitor Filter Bar */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mr-1">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              Target Competitors:
            </span>

            {/* Select All */}
            <button
              onClick={handleSelectAll}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                isAllSelected
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAllSelected && <Check className="h-3 w-3" />}
              All ({competitorsList.length})
            </button>

            {/* Individual Pills */}
            {competitorsList.map((c) => {
              const active = isSelected(c.id) && !isAllSelected;
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCompetitor(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    active
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  <span>{c.name}</span>
                  {c.activePlanCount !== undefined && c.activePlanCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                      {c.activePlanCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Stream & Input Card */}
        <Card className="flex-1 flex flex-col border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Messages Scroll View */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-indigo-600 text-white shadow-xs"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : "bg-slate-50 border border-slate-200/90 text-slate-800 rounded-tl-none shadow-2xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap space-y-2">
                    {msg.content}
                  </div>

                  {msg.groundedCompetitors && msg.groundedCompetitors.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-400">Verified database ground truth:</span>
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

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white shrink-0 flex items-center justify-center shadow-xs">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none p-4 text-xs text-slate-600 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Synthesizing verified competitive data from database...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts Pill Bar */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Suggested Analysis Prompts:
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

          {/* Input Bar */}
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
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>All conversations and comparisons are automatically saved to database history</span>
              <span>Target: <strong className="text-slate-600">{activeSelectionLabel}</strong></span>
            </div>
          </div>
        </Card>
      </div>

      {/* Interactive Delete Alert Modal */}
      <ConfirmDeleteAlert
        isOpen={!!sessionToDelete}
        title="Delete Intelligence Session"
        description="Are you sure you want to delete this competitive intelligence session? All messages and analysis in this thread will be permanently erased from database records."
        itemName={sessionToDelete?.title}
        confirmText="Delete Session"
        isDeleting={isDeletingSession}
        onConfirm={executeDeleteSession}
        onClose={() => setSessionToDelete(null)}
      />
    </div>
  );
}
