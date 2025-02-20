"use client";

import React, { useState, useEffect, ChangeEvent } from "react";

// Adjust these if your props differ
export interface EmployeeSelectorProps {
  darkMode: boolean;
  onSelect: (employeeName: string) => void; // or pass entire record if needed
  onClose: () => void;
}

// Basic shape of employee data from the API
interface EmployeeRecord {
  employeeId: string;
  name?: string;   // Mark optional to avoid undefined issues
  // add other fields if needed
}

export default function EmployeeSelector({
  darkMode,
  onSelect,
  onClose
}: EmployeeSelectorProps) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hard-coded userId for now
  const HARD_CODED_USER_ID = "guest#user-guest";
  // Base URL
  const API_BASE_URL = "https://u4twn69urd.execute-api.us-east-1.amazonaws.com";

  // Fetch employees on mount
  useEffect(() => {
    async function fetchEmployees() {
      setIsLoading(true);
      setError(null);
      try {
        // For example: GET /{userId}?type=Employee
        const url = `${API_BASE_URL}/${encodeURIComponent(HARD_CODED_USER_ID)}?type=Employee`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`);
        }
        const data = await res.json();
        if (data.status === "success" && Array.isArray(data.data)) {
          setEmployees(data.data);
        } else {
          setEmployees([]);
        }
      } catch (err: any) {
        console.error("Error fetching employees:", err);
        setError("Failed to load employees.");
      }
      setIsLoading(false);
    }
    fetchEmployees();
  }, []);

  // Handle search
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Filter employees by searchTerm
  // Use (emp.name || "") so we never call toLowerCase() on undefined
  const filteredEmployees = employees.filter((emp) =>
    (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      style={{
        border: darkMode ? "1px solid #666" : "1px solid #ccc",
        backgroundColor: darkMode ? "#333" : "#fff",
        padding: 16,
        borderRadius: 8,
        marginTop: 8,
        maxWidth: 300
      }}
    >
      {/* Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong style={{ color: darkMode ? "#fff" : "#000" }}>
          Select Employee
        </strong>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            color: darkMode ? "#fff" : "#000",
            cursor: "pointer"
          }}
        >
          <i className="fa-solid fa-times" />
        </button>
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <p style={{ color: darkMode ? "#fff" : "#000" }}>
          Loading employees...
        </p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search employee..."
            style={{
              width: "100%",
              padding: 8,
              marginTop: 8,
              borderRadius: 4,
              border: "1px solid #ccc",
              outline: "none"
            }}
          />

          <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 8 }}>
            {filteredEmployees.map((emp) => (
              <div
                key={emp.employeeId} // ensure unique key
                onClick={() => onSelect(emp.name || "Unknown")}
                style={{
                  padding: "6px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: darkMode ? "#fff" : "#000",
                  marginBottom: 4,
                  backgroundColor: darkMode ? "#444" : "#f9f9f9"
                }}
              >
                {emp.name || "Unnamed Employee"}
              </div>
            ))}
            {filteredEmployees.length === 0 && (
              <p style={{ color: darkMode ? "#fff" : "#000" }}>
                No matching employees
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}