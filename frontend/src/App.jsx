import React, { useEffect, useState } from 'react';
import Chat from './components/Chat';
import './App.css';

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory_localStorage';
const API_BASE_URL = 'http://localhost:8000';

export default function App() {
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          return parsedHistory;
        }
      }
    } catch (error) {
      console.error("Failed to load or parse chat history from localStorage:", error);
      localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(chatHistory === null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (chatHistory === null) {
      setIsLoading(true);
      setError(null);
      fetch(`${API_BASE_URL}/api/chat`, { credentials: 'include' })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch history (${res.status} ${res.statusText})`);
          }
          return res.json();
        })
        .then(data => {
          setChatHistory(data.history || []);
        })
        .catch(error => {
          console.error("Failed to fetch initial chat history:", error);
          setError(`Failed to load initial chat history: ${error.message}. Please try refreshing.`);
          setChatHistory([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    if (chatHistory !== null) {
      try {
        if (Array.isArray(chatHistory)) {
          localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chatHistory));
        } else {
          console.warn("Attempted to save non-array chat history to sessionStorage:", chatHistory);
        }
      } catch (error) {
        console.error("Failed to save chat history to localStorage:", error);
      }
    }
  }, [chatHistory]);

  return (
    <div className="container-fluid">
      <div className="card shadow-lg h-100 d-flex flex-column">
        <div className="card-header bg-dark text-white">
          <h1 className="mb-0 h4">🚀 AstroLog: Ask About Space Missions!</h1>
        </div>
        <div className="card-body d-flex flex-column flex-grow-1">
          {isLoading ? (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading chat history...</span>
              </div>
              <span className="ms-2">Loading chat history...</span>
            </div>
          ) : error ? (
            <div className="alert alert-danger d-flex align-items-center" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-exclamation-triangle-fill flex-shrink-0 me-2" viewBox="0 0 16 16" role="img" aria-label="Warning:">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
              </svg>
              <div>
                {error}
              </div>
            </div>
          ) : Array.isArray(chatHistory) ? (
            <Chat history={chatHistory} setHistory={setChatHistory} apiBaseUrl={API_BASE_URL} />
          ) : (
            <div className="alert alert-warning">Chat history could not be initialized.</div>
          )}
        </div>
      </div>
    </div>
  );
}
