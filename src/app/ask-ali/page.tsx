"use client";

import React, {
  useState,
  useEffect,
  useRef,
  KeyboardEvent
} from "react";
import Head from "next/head";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import ConversationHistory, { Conversation } from "./ConversationHistory";
import MessageInput from "./MessageInput";
import OptionButtons from "./OptionButtons";
import EmployeeSelector from "./EmployeeSelector";

//
// TYPES
//
interface Message {
  role: "user" | "ali";
  text: string;
  options?: string[];
}

//
// API ENDPOINT
//
const conversationApiUrl = "https://sem28c4rii.execute-api.us-east-1.amazonaws.com";

//
// HELPER FUNCTIONS
//
function trimTrailingAsterisks(text: string): string {
  return text.replace(/\*+$/, "").trim();
}

function convertRelativeDates(text: string): string {
  const now = new Date();
  if (text.toLowerCase().includes("yesterday")) {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const formatted = yesterday.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
    text = text.replace(/yesterday/gi, formatted);
  }
  if (text.toLowerCase().includes("last friday")) {
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
    const lastFriday = new Date();
    lastFriday.setDate(now.getDate() - daysToSubtract);
    const formatted = lastFriday.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
    text = text.replace(/last friday/gi, formatted);
  }
  return text;
}

/**
 * Parses ALI's response. If it contains "OPTIONS:EMPLOYEELIST",
 * we'll treat that as a special inline employee selector.
 * Otherwise, we do normal "OPTIONS:" logic or no options at all.
 */
function processAliResponse(response: string) {
  let processed = response.replace("Thank you for providing the time.", "").trim();
  processed = convertRelativeDates(processed);

  // 1) Special check for employee-list request
  if (processed.includes("EMPLOYEELIST")) {
    const parts = processed.split("EMPLOYEELIST");
    const mainMessage = parts[0].trim();
    return {
      text: trimTrailingAsterisks(mainMessage),
      // We'll store a single "EMPLOYEELIST" in the options
      options: ["EMPLOYEELIST"]
    };
  }

  // 2) Normal "OPTIONS:" logic
  if (processed.includes("OPTIONS:")) {
    const [main, rawOpts] = processed.split("OPTIONS:");
    const optionsArr = rawOpts.split("|").map((o) => o.trim());
    return {
      text: trimTrailingAsterisks(main),
      options: optionsArr,
    };
  }

  // 3) No special marker => no options
  return { text: trimTrailingAsterisks(processed), options: [] };
}

//
// MAIN COMPONENT
//
export default function AskAli() {
  const [darkMode, setDarkMode] = useState(false);

  // Track conversation
  const [conversationId, setConversationId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("conversationId") || "";
    }
    return "";
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Conversation list
  const [conversationList, setConversationList] = useState<Conversation[]>([]);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // For auto-scroll
  const chatEndRef = useRef<HTMLDivElement>(null);
  // For aborting fetch
  const abortControllerRef = useRef<AbortController | null>(null);

  //
  // On mount
  //
  useEffect(() => {
    // Detect dark mode
    setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    // Load conversation list
    fetchConversations();
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  //
  // Fetch conversation list
  //
  const fetchConversations = async () => {
    try {
      const res = await fetch(`${conversationApiUrl}/conversations?tenantId=tenant-1&userId=user-guest`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversationList(data);
        }
      }
    } catch (err) {
      console.error("Error fetching conversation list:", err);
    }
  };

  //
  // Fetch messages for a given conversation
  //
  const fetchMessagesForConversation = async (convId: string) => {
    try {
      const url = `${conversationApiUrl}/messages?conversationId=${encodeURIComponent(convId)}&tenantId=tenant-1&userId=user-guest`;
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        const fetched = Array.isArray(data) ? data : [];
        const converted = fetched.map((item: any) => ({
          role: item.role === "assistant" ? "ali" : item.role,
          text: item.content || "",
          options: item.options || [],
        }));
        setMessages(converted);
      } else if (res.status === 404) {
        setMessages([]);
      } else {
        console.error("Error fetching messages, status:", res.status);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  //
  // Selecting a conversation from left sidebar
  //
  const handleConversationSelect = (conv: Conversation) => {
    setConversationId(conv.conversationId);
    if (typeof window !== "undefined") {
      localStorage.setItem("conversationId", conv.conversationId);
    }
    setMessages([]);
    if (conv.conversationId.trim()) {
      fetchMessagesForConversation(conv.conversationId);
    }
  };

  //
  // Send user message
  //
  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    // Add user message locally
    setMessages((prev) => [...prev, { role: "user", text }]);
    setIsProcessing(true);

    try {
      const res = await fetch(`${conversationApiUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          text,
          tenantId: "tenant-1",
          userId: "user-guest",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // If new conversation was created, update state & reload list
        if (data.conversationId && data.conversationId !== conversationId) {
          setConversationId(data.conversationId);
          localStorage.setItem("conversationId", data.conversationId);
          fetchConversations();
        }
        // Parse AI response
        const parsed = processAliResponse(data.reply || "");
        setMessages((prev) => [
          ...prev,
          { role: "ali", text: parsed.text, options: parsed.options }
        ]);
      } else {
        const errText = await res.text();
        console.error("Error from ALI:", errText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
    setIsProcessing(false);
    setMessageText("");
  };

  const handleSend = () => {
    sendMessage(messageText);
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  //
  // Handling user clicks on AI-provided options
  //
  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };

  //
  // Conversation rename logic
  //
  const handleEditingStart = (conv: Conversation) => {
    setEditingConversationId(conv.conversationId);
    setEditingTitle(conv.title);
  };
  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, convId: string) => {
    if (e.key === "Enter") {
      renameConversation(convId, editingTitle);
      setEditingConversationId(null);
    }
  };
  const renameConversation = async (convId: string, newTitle: string) => {
    try {
      await fetch(`${conversationApiUrl}/conversations/${convId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          tenantId: "tenant-1",
          userId: "user-guest",
        }),
      });
      fetchConversations();
    } catch (err) {
      console.error("Error renaming conversation:", err);
    }
  };
  const handleDeleteConversation = async (convId: string) => {
    try {
      await fetch(`${conversationApiUrl}/conversations/${convId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-1",
          userId: "user-guest",
        }),
      });
      fetchConversations();
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  //
  // RENDER
  //
  return (
    <>
      <Head>
        <title>Ask ALI</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"
        />
      </Head>

      <div style={{ display: "flex", height: "100vh" }}>
        {/* LEFT SIDEBAR: Conversation History */}
        <div
          style={{
            width: 250,
            backgroundColor: "var(--secondary-background-color)",
            overflowY: "auto",
          }}
        >
          <ConversationHistory
            conversationList={conversationList}
            editingConversationId={editingConversationId}
            editingTitle={editingTitle}
            onSelect={handleConversationSelect}
            onEditingStart={handleEditingStart}
            onRename={renameConversation}
            onRenameKeyDown={handleRenameKeyDown}
            onTitleChange={(newTitle: string) => setEditingTitle(newTitle)}
            onDelete={handleDeleteConversation}
          />
        </div>

        {/* RIGHT PANE: Chat Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: darkMode ? "#222" : "#f7f7f7",
          }}
        >
          {/* If no messages, show initial category selection */}
          {messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    marginBottom: 16,
                    color: darkMode ? "#fff" : "#000",
                  }}
                >
                  What can I help with?
                </h2>
                <div style={{ display: "inline-flex", gap: "1rem" }}>
                  <button
                    onClick={() => sendMessage("I need to start a new employee discipline incident.")}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: darkMode ? "1px solid #666" : "1px solid #ccc",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: darkMode ? "#fff" : "#171717",
                    }}
                  >
                    <i className="fa-solid fa-user-shield" style={{ marginRight: 8 }} />
                    Employee Discipline
                  </button>
                  <button
                    onClick={() => sendMessage("I need to start a new harassment or discrimination incident.")}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: darkMode ? "1px solid #666" : "1px solid #ccc",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: darkMode ? "#fff" : "#171717",
                    }}
                  >
                    <i className="fa-solid fa-user" style={{ marginRight: 8 }} />
                    Harassment/Discrimination
                  </button>
                  <button
                    onClick={() => sendMessage("I need some general HR consultation.")}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: darkMode ? "1px solid #666" : "1px solid #ccc",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: darkMode ? "#fff" : "#171717",
                    }}
                  >
                    <i className="fa-solid fa-comments" style={{ marginRight: 8 }} />
                    General HR Consultation
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Chat messages
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}
            >
              <div style={{ maxWidth: 800, width: "100%" }}>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: 12,
                      textAlign: msg.role === "user" ? "right" : "left"
                    }}
                  >
                    <div
                      style={{
                        display: "inline-block",
                        padding: 12,
                        borderRadius: 8,
                        backgroundColor:
                          msg.role === "user"
                            ? darkMode
                              ? "#333"
                              : "#e0e0e0"
                            : "transparent",
                        color: darkMode ? "#fff" : "#000",
                      }}
                    >
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>

                    {/* If we have options */}
                    {msg.options && msg.options.length > 0 && (
                      msg.options.includes("EMPLOYEELIST") ? (
                        // Inline employee selector
                        <EmployeeSelector
                          darkMode={darkMode}
                          onSelect={(empName: string) => {
                            // user picks an employee -> treat as user message
                            handleOptionClick(empName);
                          } } onClose={function (): void {
                            throw new Error("Function not implemented.");
                          } }                        />
                      ) : (
                        // Normal OptionButtons
                        <OptionButtons
                          options={msg.options}
                          onSelected={handleOptionClick}
                          darkMode={darkMode}
                        />
                      )
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          {/* Message Input Field */}
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
}