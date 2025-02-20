// src/app/ask-ali/ConversationHistory.tsx

import React, { ChangeEvent, KeyboardEvent, useState, useEffect, useRef } from 'react';
import ConversationOptionsDropdown from './ConversationOptionsDropdown';
import RenamePopup from './RenamePopup';

export interface Conversation {
  conversationId: string;
  title: string;
  createdAt?: string; // Optional: timestamp from the backend
}

export interface ConversationHistoryProps {
  conversationList: Conversation[];
  editingConversationId: string | null;
  editingTitle: string;
  onSelect: (conv: Conversation) => void;
  onEditingStart: (conv: Conversation) => void;
  onRename: (convId: string, newTitle: string) => void;
  onRenameKeyDown: (e: KeyboardEvent<HTMLInputElement>, convId: string) => void;
  onTitleChange: (newTitle: string) => void;
  onDelete: (convId: string) => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  conversationList,
  editingConversationId,
  editingTitle,
  onSelect,
  onEditingStart,
  onRename,
  onRenameKeyDown,
  onTitleChange,
  onDelete,
}) => {
  // State to control the dropdown for options.
  const [openDropdownFor, setOpenDropdownFor] = useState<string | null>(null);
  // State to control the rename popup and store which conversation is being renamed.
  const [renamePopupOpen, setRenamePopupOpen] = useState<boolean>(false);
  const [conversationToRename, setConversationToRename] = useState<Conversation | null>(null);
  // Ref for the dropdown container.
  const dropdownRef = useRef<HTMLDivElement>(null);
  // State for filtering conversations.
  const [searchTerm, setSearchTerm] = useState<string>("");
  // State to control the visibility of the search popup.
  const [searchPopupOpen, setSearchPopupOpen] = useState<boolean>(false);
  // State to control how many conversations are visible.
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // When the search term changes, reset the visible count to 10.
  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdownFor && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownFor(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownFor]);

  const toggleDropdown = (convId: string) => {
    setOpenDropdownFor(prev => (prev === convId ? null : convId));
  };

  const handleRenameClick = (conv: Conversation) => {
    setConversationToRename(conv);
    setRenamePopupOpen(true);
    setOpenDropdownFor(null);
  };

  // Sort the conversation list by createdAt (newest first) if available.
  const sortedConversations = [...conversationList].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  // Filter the sorted list based on the search term.
  const filteredConversations = sortedConversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Limit the displayed conversations to visibleCount.
  const visibleConversations = filteredConversations.slice(0, visibleCount);

  return (
    <div style={{ padding: 16, color: 'var(--foreground)', height: '100%', overflowY: 'auto', position: 'relative' }}>
      {/* Vertical Navigation Menu */}
      <div style={{ marginBottom: 16 }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Incidents</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <i className="fa-solid fa-chart-line"></i>
            <span>Reports</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <i className="fa-solid fa-gear"></i>
            <span>Settings</span>
          </div>
        </nav>
      </div>

      {/* Header Row: Incident Chats with New Conversation and Search buttons */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Incident Chats</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // When New Conversation is clicked, pass an empty conversation to the parent.
              onSelect({ conversationId: "", title: "" });
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--foreground)'
            }}
            title="New Conversation"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSearchPopupOpen(!searchPopupOpen);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--foreground)'
            }}
            title="Search Chats"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          {searchTerm && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm("");
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--foreground)'
              }}
              title="Reset Search"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          )}
        </div>
      </div>

      {/* Inline Search Popup: rendered as part of the normal flow so it pushes down the conversation list */}
      {searchPopupOpen && (
        <div
          style={{
            marginBottom: 16,
            padding: 8,
            border: '1px solid var(--secondary-background-color)',
            borderRadius: 4,
            backgroundColor: 'var(--background)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--secondary-background-color)',
              fontSize: 14,
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              flex: 1,
            }}
          />
          <button
            onClick={() => setSearchPopupOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--foreground)',
            }}
            title="Close Search"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Conversation List */}
      <div>
        {visibleConversations.length > 0 ? (
          visibleConversations.map(conv => (
            <div
              key={conv.conversationId}
              style={{
                padding: 8,
                cursor: 'pointer',
                color: 'var(--foreground)',
                borderBottom: '1px solid var(--secondary-background-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
              }}
              onClick={() => onSelect(conv)}
            >
              {/* Conversation Title (allow up to 2 lines) */}
              <span
                style={{
                  fontSize: 14,
                  flex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {conv.title.replace(/"/g, '')}
              </span>
              {/* Options Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 40,
                  justifyContent: 'center',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDropdown(conv.conversationId);
                }}
                ref={dropdownRef}
              >
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 6,
                    color: 'var(--foreground)',
                  }}
                  title="Options"
                >
                  <i className="fa-solid fa-ellipsis-h"></i>
                </button>
                {openDropdownFor === conv.conversationId && (
                  <ConversationOptionsDropdown
                    onEdit={() => handleRenameClick(conv)}
                    onDelete={() => {
                      if (window.confirm("Are you sure you want to delete this conversation?")) {
                        onDelete(conv.conversationId);
                        setOpenDropdownFor(null);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No chats found.</p>
        )}
      </div>

      {/* Load More Button */}
      {filteredConversations.length > visibleCount && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => setVisibleCount(visibleCount + 20)}
            style={{
              background: 'none',
              border: '1px solid var(--secondary-background-color)',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--foreground)'
            }}
          >
            Load More
          </button>
        </div>
      )}

      {renamePopupOpen && conversationToRename && (
        <RenamePopup
          initialTitle={conversationToRename.title}
          onSave={(newTitle: string) => {
            onRename(conversationToRename.conversationId, newTitle);
            setRenamePopupOpen(false);
            setConversationToRename(null);
          }}
          onCancel={() => {
            setRenamePopupOpen(false);
            setConversationToRename(null);
          }}
        />
      )}
    </div>
  );
};

export default ConversationHistory;