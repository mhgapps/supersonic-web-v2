"use client";

import React, { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown';
import ConversationHistory, { Conversation } from './ConversationHistory';
import MessageInput from './MessageInput';

interface Message {
  role: 'user' | 'ali';
  text: string;
  options?: string[];
}

interface OptionButtonsProps {
  options: string[];
  onSelected: (option: string) => void;
}

// Reusable Option Buttons
const OptionButtons: React.FC<OptionButtonsProps> = ({ options, onSelected }) => {
  return (
    <div style={{ marginTop: 8 }}>
      {options.map((opt, index) => (
        <button
          key={index}
          onClick={() => onSelected(opt)}
          style={{
            marginRight: 8,
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid #ccc',
            backgroundColor: 'transparent',
            cursor: 'pointer'
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

const conversationApiUrl = "https://sem28c4rii.execute-api.us-east-1.amazonaws.com";

// Helpers
function trimTrailingAsterisks(text: string) {
  return text.replace(/\*+$/, "").trim();
}
function convertRelativeDates(text: string) {
  const now = new Date();
  if (text.toLowerCase().includes("yesterday")) {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const formatted = yesterday.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
    text = text.replace(/yesterday/gi, formatted);
  }
  if (text.toLowerCase().includes("last friday")) {
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
    const lastFriday = new Date();
    lastFriday.setDate(now.getDate() - daysToSubtract);
    const formatted = lastFriday.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
    text = text.replace(/last friday/gi, formatted);
  }
  return text;
}
function processAliResponse(response: string): { text: string; options: string[] } {
  let processed = response.replace("Thank you for providing the time.", "").trim();
  processed = convertRelativeDates(processed);
  if (processed.includes("OPTIONS:")) {
    const parts = processed.split("OPTIONS:");
    const mainMessage = parts[0].trim();
    const optionsPart = parts[1].trim();
    const options = optionsPart.split("|").map(opt => opt.trim());
    return { text: trimTrailingAsterisks(mainMessage), options };
  }
  return { text: trimTrailingAsterisks(processed), options: [] };
}

const AskAli: React.FC = () => {
  // Dark mode check
  const [darkMode, setDarkMode] = useState(false);

  // Conversation tracking
  const [conversationId, setConversationId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('conversationId');
      return stored || "";
    }
    return "";
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Conversation list
  const [conversationList, setConversationList] = useState<Conversation[]>([]);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load dark mode
  useEffect(() => {
    setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // ---------------------
  // API: Fetch conversation list
  // ---------------------
  const fetchConversations = async () => {
    try {
      const res = await fetch(`${conversationApiUrl}/conversations?tenantId=tenant-1&userId=user-guest`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setConversationList(data);
      }
    } catch {}
  };

  // ---------------------
  // API: Fetch messages for selected conversation
  // ---------------------
  const fetchMessagesForConversation = async (convId: string) => {
    try {
      const url = `${conversationApiUrl}/messages?conversationId=${encodeURIComponent(convId)}&tenantId=tenant-1&userId=user-guest`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        const fetchedMessages = Array.isArray(data) ? data : data.messages || [];
        const converted = fetchedMessages.map((item: any) => ({
          role: item.role === 'assistant' ? 'ali' : item.role,
          text: item.content || "",
          options: item.options || []
        }));
        setMessages(converted);
      } else if (res.status === 404) {
        setMessages([]);
      }
    } catch {}
  };

  // ---------------------
  // Conversation selection
  // ---------------------
  const handleConversationSelect = (conv: Conversation) => {
    setConversationId(conv.conversationId);
    localStorage.setItem('conversationId', conv.conversationId);
    setMessages([]);
    if (conv.conversationId.trim()) fetchMessagesForConversation(conv.conversationId);
  };

  // ---------------------
  // Send user message
  // ---------------------
  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    // Show user message locally
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsProcessing(true);

    try {
      const res = await fetch(`${conversationApiUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          text,
          tenantId: "tenant-1",
          userId: "user-guest"
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.conversationId && data.conversationId !== conversationId) {
          setConversationId(data.conversationId);
          localStorage.setItem('conversationId', data.conversationId);
          await fetchConversations();
        }
        const parsed = processAliResponse(data.reply || "");
        setMessages(prev => [...prev, { role: 'ali', text: parsed.text, options: parsed.options }]);
      }
    } catch {}

    setIsProcessing(false);
    setMessageText('');
  };

  // ---------------------
  // Stop the current AI request
  // ---------------------
  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  // ---------------------
  // UI Handlers
  // ---------------------
  const handleSend = () => {
    sendMessage(messageText);
  };
  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };

  // ---------------------
  // Conversation History Edits
  // ---------------------
  const handleEditingStart = (conv: Conversation) => {
    setEditingConversationId(conv.conversationId);
    setEditingTitle(conv.title);
  };
  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, convId: string) => {
    if (e.key === 'Enter') {
      renameConversation(convId, editingTitle);
      setEditingConversationId(null);
    }
  };
  const renameConversation = async (convId: string, newTitle: string) => {
    try {
      await fetch(`${conversationApiUrl}/conversations/${convId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          tenantId: "tenant-1",
          userId: "user-guest",
        }),
      });
      fetchConversations();
    } catch {}
  };
  const handleDeleteConversation = async (convId: string) => {
    try {
      await fetch(`${conversationApiUrl}/conversations/${convId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: "tenant-1",
          userId: "user-guest",
        }),
      });
      fetchConversations();
    } catch {}
  };

  // ---------------------
  // Category Buttons (first conversation prompt)
  // ---------------------
  const handleCategorySelection = (category: string) => {
    if (category === "Employee Discipline") {
      sendMessage("I need to start a new employee discipline incident.");
    } else if (category === "Harassment/Discrimination") {
      sendMessage("I need to start a new harassment or discrimination incident.");
    } else {
      sendMessage("I need some general HR consultation.");
    }
  };

  // UI styling
  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #ccc',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: darkMode ? '#fff' : '#171717'
  };

  return (
    <>
      <Head>
        <title>Ask ALI</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"
        />
      </Head>

      <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--background)' }}>
        {/* Left Pane: Conversation List */}
        <div style={{ width: 250, backgroundColor: 'var(--secondary-background-color)', overflowY: 'auto' }}>
          <ConversationHistory
            conversationList={conversationList}
            editingConversationId={editingConversationId}
            editingTitle={editingTitle}
            onSelect={handleConversationSelect}
            onEditingStart={handleEditingStart}
            onRename={renameConversation}
            onRenameKeyDown={handleRenameKeyDown}
            onTitleChange={setEditingTitle}
            onDelete={handleDeleteConversation}
          />
        </div>

        {/* Right Pane: Chat + Input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--right-pane-bg)' }}>
          {/* Chat display */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflowY: 'auto', padding: 16 }}>
            <div style={{ maxWidth: 800, width: '100%' }}>
              {/* If no messages, show category buttons */}
              {messages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>What can I help with?</h2>
                  <div style={{ display: 'inline-flex', gap: '1rem' }}>
                    <button onClick={() => handleCategorySelection("Employee Discipline")} style={buttonStyle}>
                      <i className="fa-solid fa-user-shield" style={{ marginRight: 8 }} />
                      Employee Discipline
                    </button>
                    <button onClick={() => handleCategorySelection("Harassment/Discrimination")} style={buttonStyle}>
                      <i className="fa-solid fa-user" style={{ marginRight: 8 }} />
                      Harassment/Discrimination
                    </button>
                    <button onClick={() => handleCategorySelection("General HR Consultation")} style={buttonStyle}>
                      <i className="fa-solid fa-comments" style={{ marginRight: 8 }} />
                      General HR Consultation
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, index) => (
                <div key={index} style={{ marginBottom: 12, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: msg.role === 'user'
                        ? (darkMode ? "#333" : "#f0f0f0")
                        : "transparent",
                      color: darkMode ? "#fff" : "#171717"
                    }}
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.options && msg.options.length > 0 && (
                    <OptionButtons options={msg.options} onSelected={handleOptionClick} />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <MessageInput
            messageText={messageText}
            setMessageText={setMessageText}
            isProcessing={isProcessing}
            onSend={handleSend}
            stop={stop}
          />
        </div>
      </div>
    </>
  );
};

export default AskAli;