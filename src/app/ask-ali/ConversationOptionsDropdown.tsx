// src/app/ask-ali/ConversationOptionsDropdown.tsx

import React from 'react';

interface ConversationOptionsDropdownProps {
  onEdit: () => void;
  onDelete: () => void;
}

const ConversationOptionsDropdown: React.FC<ConversationOptionsDropdownProps> = ({ onEdit, onDelete }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        backgroundColor: 'var(--dropdown-bg)', // Ensure --dropdown-bg is defined in your globals.css
        padding: 15,
        border: '1px solid var(--secondary-background-color)',
        borderRadius: 15,
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        zIndex: 10,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: 'none',
          border: 'none',
          width: '100%',
          cursor: 'pointer',
          color: 'var(--foreground)',
          fontSize: 12,
        }}
      >
        <i className="fa-solid fa-pen" style={{ fontSize: 12 }}></i> Rename
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: 'none',
          border: 'none',
          width: '100%',
          cursor: 'pointer',
          color: 'var(--foreground)',
          fontSize: 12,
        }}
      >
        <i className="fa-solid fa-trash" style={{ fontSize: 12 }}></i> Delete
      </button>
    </div>
  );
};

export default ConversationOptionsDropdown;