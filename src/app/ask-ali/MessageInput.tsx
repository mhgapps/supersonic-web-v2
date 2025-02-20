// src/app/ask-ali/MessageInput.tsx

import React, { useRef, useEffect, ChangeEvent } from 'react';

interface MessageInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  isProcessing: boolean;
  onSend: () => void;
  stop: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  messageText,
  setMessageText,
  isProcessing,
  onSend,
  stop,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize effect whenever messageText changes.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [messageText]);

  return (
    <div style={{ width: '100%', maxWidth: 800, padding: 16, margin: '0 auto' }}>
      <div
        style={{
          backgroundColor: 'var(--input-bg)',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <textarea
          ref={textareaRef}
          value={messageText}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessageText(e.target.value)}
          placeholder="Ask ALI anything..."
          style={{
            width: '100%',
            minHeight: 40,
            maxHeight: 288,
            border: 'none',
            resize: 'vertical',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--input-text-color)',
            fontSize: 16,
            lineHeight: '1.5',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => { console.log("Attachment clicked"); alert('Attachment placeholder'); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-paperclip" style={{ fontSize: 16, color: "var(--icon-color)" }}></i>
            </button>
            <button
              onClick={() => { console.log("Camera clicked"); alert('Camera placeholder'); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-camera" style={{ fontSize: 16, color: "var(--icon-color)" }}></i>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => { console.log("Microphone clicked"); alert('Audio recording placeholder'); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-microphone" style={{ fontSize: 16, color: "var(--icon-color)" }}></i>
            </button>
            <button
              onClick={isProcessing ? stop : onSend}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <i
                className={isProcessing ? "fa-solid fa-stop" : "fa-solid fa-arrow-up"}
                style={{ color: '#fff', fontSize: 16 }}
              ></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;