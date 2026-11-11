"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Bot,
  User,
  Send,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Plus,
  History,
  Trash2,
  MessageSquare,
  Building2,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteAlert } from "@/components/ui/confirm-delete-alert";
import { FormattedChatContent } from "@/components/ui/formatted-chat-content";
import { normalizeChatError } from "@/lib/intelligence/chat-intent";

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
  "Compare pricing, billing intervals, and limits across all active competitors.",
  "Which plan gives the highest usage limits and features?",
  "What recent pricing or packaging changes were detected?",
  "What are Claude's pricing tiers and quotas?",
];

export default function InsightsChatbotPage() {
  const [competitorsList, setCompetitorsList] = useState<CompetitorOption[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("all");
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSessionItem | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userHasScrolledUpRef = useRef<boolean>(false);

  // Auto-scroll logic: only auto-scroll if user has not scrolled up to read older messages
  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current) return;
    if (force || !userHasScrolledUpRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // If user is more than 80px away from bottom, mark as scrolled up
    userHasScrolledUpRef.current = distanceFromBottom > 80;
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
          const comps: CompetitorOption[] = compJson.data.map((c: any) => ({
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
    userHasScrolledUpRef.current = false;
    try {
      const res = await fetch(`/api/insights/sessions/${sessionId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const { session, messages: loadedMessages } = json.data;

        // Restore active competitor scope from session
        if (Array.isArray(session.selectedCompetitors) && session.selectedCompetitors.length > 0) {
          const first = session.selectedCompetitors[0];
          setSelectedCompetitorId(first === "all" ? "all" : first);
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
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (err) {
      console.error("Failed to load session messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a fresh analysis session
  const startNewChatSession = () => {
    setActiveSessionId(null);
    userHasScrolledUpRef.current = false;
    const initialGreeting: ChatMessage = {
      id: "welcome-msg",
      role: "assistant",
      content:
        "Hello! I am ready to assist with your competitive intelligence queries.\n\nAsk about pricing tiers, packaging models, feature entitlements, quotas, or recent historical changes across your tracked competitors.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([initialGreeting]);
    setTimeout(() => {
      inputRef.current?.focus();
      scrollToBottom(true);
    }, 50);
  };

  // Prompt confirmation to delete session
  const promptDeleteSession = (e: React.MouseEvent, sess: ChatSessionItem) => {
    e.stopPropagation();
    setSessionToDelete(sess);
  };

  const executeDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const res = await fetch(`/api/insights/sessions/${sessionToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        const remaining = sessions.filter((s) => s.id !== sessionToDelete.id);
        setSessions(remaining);
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

  // Calculate competitor option labels for dropdown
  const totalCompetitorsCount = competitorsList.length;
  const currentCompetitor = competitorsList.find((c) => c.id === selectedCompetitorId);

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    userHasScrolledUpRef.current = false;

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
    setTimeout(() => scrollToBottom(true), 20);

    try {
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const targetCompetitorIds = selectedCompetitorId === "all" ? ["all"] : [selectedCompetitorId];

      const res = await fetch("/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId || undefined,
          messages: conversationHistory,
          competitorIds: targetCompetitorIds,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || !json.success) {
        const errorDetail = json?.error || (typeof json === "string" ? json : null);
        throw new Error(errorDetail || `Request failed with status ${res.status}`);
      }

      // Update active session ID
      if (json.data?.sessionId && json.data.sessionId !== activeSessionId) {
        setActiveSessionId(json.data.sessionId);
        // Refresh session list in sidebar
        const sessRes = await fetch("/api/insights/sessions");
        const sessJson = await sessRes.json().catch(() => null);
        if (sessJson?.success && Array.isArray(sessJson.data?.sessions)) {
          setSessions(sessJson.data.sessions);
        }
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: json.data?.reply || "Analysis complete.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        groundedCompetitors: json.data?.groundedCompetitors,
      };

      setMessages((prev) => [...prev, botMsg]);
      setTimeout(() => scrollToBottom(true), 20);
    } catch (err: unknown) {
      const normalized = normalizeChatError(err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: normalized.friendlyMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setTimeout(() => scrollToBottom(true), 20);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      {/* Compact Header */}
      <div className="shrink-0 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Insights</h1>
      </div>

      {/* Main Workspace: History Sidebar + Chat Panel */}
      <div className="flex-1 flex min-h-0 gap-3 sm:gap-4 overflow-hidden">
        {/* Left Sidebar: Session History */}
        <div
          className={`${
            historySidebarOpen ? "w-60 lg:w-64" : "w-11"
          } transition-all duration-200 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col shrink-0 min-h-0 overflow-hidden`}
        >
          <div className="p-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            {historySidebarOpen ? (
              <>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-700">
                  <History className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Chat History</span>
                </div>
                <button
                  onClick={() => setHistorySidebarOpen(false)}
                  className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs transition-colors"
                  title="Collapse history"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                onClick={() => setHistorySidebarOpen(true)}
                className="h-6 w-6 mx-auto rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Expand history"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {historySidebarOpen && (
            <>
              {/* New Analysis Button in History Panel */}
              <div className="p-2 shrink-0">
                <Button
                  onClick={startNewChatSession}
                  size="sm"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white justify-start gap-1.5 text-xs font-medium h-8 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Analysis</span>
                </Button>
              </div>

              {/* Past Sessions List with Independent Vertical Scrolling */}
              <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
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
                        className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isActive
                            ? "bg-indigo-600 text-white font-medium shadow-2xs"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                          <MessageSquare
                            className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}
                          />
                          <span className="truncate">{sess.title}</span>
                        </div>
                        <button
                          onClick={(e) => promptDeleteSession(e, sess)}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded-md hover:text-rose-500 transition-all ${
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

        {/* Main Chat Panel: Full Height, Message Area Scrolls, Composer Fixed at Bottom */}
        <Card className="flex-1 flex flex-col min-h-0 min-w-0 bg-white border border-slate-200/90 shadow-2xs rounded-xl overflow-hidden">
          {/* Conversation Messages Container: Independent Scroll Area */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Role Icon */}
                <div
                  className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold shadow-2xs ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-indigo-600 text-white"
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
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : "bg-slate-50/80 border border-slate-200/90 text-slate-800 rounded-tl-none shadow-2xs"
                  }`}
                >
                  <FormattedChatContent content={msg.content} isUser={msg.role === "user"} />

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
                <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white shrink-0 flex items-center justify-center shadow-2xs">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-600 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  <span>Analyzing competitive database records...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar (when conversation is fresh) */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Suggested Analysis Prompts
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs text-left transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Composer: Integrated Competitor Dropdown + Textarea + Send Button */}
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
              {/* Dynamic Competitor Scope Dropdown */}
              <div className="relative shrink-0 sm:self-center">
                <div className="relative">
                  <select
                    value={selectedCompetitorId}
                    onChange={(e) => setSelectedCompetitorId(e.target.value)}
                    aria-label="Select target competitor"
                    className="w-full sm:w-auto appearance-none bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-lg pl-3 pr-8 py-2 hover:bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs transition-colors"
                  >
                    <option value="all">
                      All Competitors ({totalCompetitorsCount})
                    </option>
                    {competitorsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.activePlanCount ?? 0})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Textarea Input */}
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question"
                className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden px-2 py-1.5 leading-relaxed min-h-[38px] max-h-32"
              />

              {/* Send Button */}
              <Button
                size="sm"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 h-9 px-4 rounded-lg font-medium shadow-2xs transition-all"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span>Send</span>
                    <Send className="h-3.5 w-3.5" />
                  </div>
                )}
              </Button>
            </div>

            {/* Subtle Status Line */}
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Conversations are persisted to database</span>
              <span>
                Target:{" "}
                <strong className="text-slate-600 font-medium">
                  {selectedCompetitorId === "all"
                    ? `All Competitors (${totalCompetitorsCount})`
                    : `${currentCompetitor?.name || "Competitor"} (${currentCompetitor?.activePlanCount ?? 0} plans)`}
                </strong>
              </span>
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
