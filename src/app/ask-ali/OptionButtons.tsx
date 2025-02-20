"use client";

import React, { useState } from "react";

interface OptionButtonsProps {
  options: string[];
  onSelected: (selection: string) => void;
  darkMode?: boolean; // optional prop for dark mode styling
}

const OptionButtons: React.FC<OptionButtonsProps> = ({
  options,
  onSelected,
  darkMode = false
}) => {
  // Decide whether to show inline or popup
  const usePopupMultiSelect = options.length > 4;

  // For small sets, show inline buttons
  if (!usePopupMultiSelect) {
    return (
      <div style={{ marginTop: 8 }}>
        {options.map((opt, index) => (
          <button
            key={index}
            onClick={() => onSelected(opt)}
            style={{
              marginRight: 8,
              padding: "6px 12px",
              borderRadius: "20px",
              border: "1px solid",
              borderColor: darkMode ? "#666" : "#ccc",
              backgroundColor: "transparent",
              color: darkMode ? "#fff" : "#171717",
              cursor: "pointer"
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // For larger sets, show popup overlay with multi-select checkboxes
  const [showOverlay, setShowOverlay] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelection = (option: string) => {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleConfirm = () => {
    // Combine selected items into a single string (adjust if needed)
    if (selected.length > 0) {
      onSelected(selected.join(", "));
    }
    setShowOverlay(false);
  };

  const handleCancel = () => {
    setSelected([]);
    setShowOverlay(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setShowOverlay(true)}
        style={{
          padding: "6px 12px",
          borderRadius: "20px",
          border: "1px solid",
          borderColor: darkMode ? "#666" : "#ccc",
          backgroundColor: "transparent",
          color: darkMode ? "#fff" : "#171717",
          cursor: "pointer"
        }}
      >
        Select Options
      </button>

      {showOverlay && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            style={{
              backgroundColor: darkMode ? "#333" : "#fff",
              borderRadius: 8,
              padding: 16,
              width: 400,
              maxWidth: "90%"
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: darkMode ? "#fff" : "#171717"
              }}
            >
              Select Options
            </h3>

            {/* Two-column scrollable grid for checkboxes */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                maxHeight: 300,
                overflowY: "auto",
                marginBottom: 12
              }}
            >
              {options.map((opt, index) => {
                const checked = selected.includes(opt);
                return (
                  <label
                    key={index}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: darkMode ? "#fff" : "#171717"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(opt)}
                      style={{ marginRight: 6 }}
                    />
                    {opt}
                  </label>
                );
              })}
            </div>

            {/* Buttons row */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  border: "1px solid",
                  borderColor: darkMode ? "#666" : "#ccc",
                  backgroundColor: "transparent",
                  color: darkMode ? "#fff" : "#171717",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  border: "1px solid",
                  borderColor: darkMode ? "#666" : "#ccc",
                  backgroundColor: "transparent",
                  color: darkMode ? "#fff" : "#171717",
                  cursor: "pointer"
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionButtons;