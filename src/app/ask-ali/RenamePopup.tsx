// src/app/ask-ali/RenamePopup.tsx

import React, { useState, useEffect, useRef } from 'react';

interface RenamePopupProps {
  initialTitle: string;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
  // Optional: You can pass position offsets if desired.
  topOffset?: number;
  leftOffset?: number;
}

const RenamePopup: React.FC<RenamePopupProps> = ({
  initialTitle,
  onSave,
  onCancel,
  topOffset = 100,   // Adjust this value as needed to position the popup vertically
  leftOffset = 50,   // Adjust this value as needed to position the popup horizontally
}) => {
  const [newTitle, setNewTitle] = useState(initialTitle);
  const popupRef = useRef<HTMLDivElement>(null);

  // Optionally, focus the textarea when the popup opens.
  useEffect(() => {
    popupRef.current?.querySelector('textarea')?.focus();
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: topOffset,
        left: leftOffset,
        backgroundColor: 'var(--background)',
        padding: '16px',
        border: '1px solid var(--secondary-background-color)',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
      }}
      ref={popupRef}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Rename Conversation</h3>
      <textarea
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        rows={2}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          fontSize: 14,
          resize: 'vertical',
          color: 'var(--foreground)',
          backgroundColor: 'var(--input-bg)',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#ccc',
            color: '#000',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(newTitle)}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: 'var(--primary-color)',
            color: 'var(--background)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default RenamePopup;