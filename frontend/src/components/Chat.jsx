import React, { useState, useRef, useEffect } from 'react';
import TableModal from './TableModal';
import './Chat.css';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';

export default function Chat({ history, setHistory, apiBaseUrl }) {
  const [currentUserInput, setCurrentUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  // const [chatMode, setChatMode] = useState('normal'); // 'normal' or 'sql' - Removed
  const [isClearing, setIsClearing] = useState(false);
  const chatWindowRef = useRef(null);
  const textareaRef = useRef(null); // Ref for the textarea

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ columns: [], rows: [] });

  useEffect(() => {
    // Scroll to bottom whenever history changes
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [history]);

  // Adjust textarea height dynamically
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height first to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set the height based on scroll height, but don't exceed a max height
      const maxHeight = 150; // Example max height in pixels
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [currentUserInput]); // Re-run when input changes

  const openTableModal = (columns, rows) => {
    setModalData({ columns, rows });
    setIsModalOpen(true);
  };

  const closeTableModal = () => {
    setIsModalOpen(false);
  };

  const downloadTableAsXLSX = (columns, rows, filename = 'query_results.xlsx') => {
    if (!rows || rows.length === 0 || !columns || columns.length === 0) {
      console.warn("No data available to download.");
      alert("No table data available to download for this message.");
      return;
    }

    try {
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results'); // Sheet name

      // Generate XLSX file and trigger download
      XLSX.writeFile(workbook, filename);

    } catch (error) {
      console.error("Error generating XLSX file:", error);
      alert(`Failed to generate Excel file: ${error.message}`);
    }
  };

  const sendMessage = async () => {
    const messageToSend = currentUserInput.trim();
    if (!messageToSend || isSending || isClearing) return;

    setIsSending(true);
    const userMessage = { role: 'user', content: messageToSend };

    setHistory(prevHistory => [...prevHistory, userMessage]);
    setCurrentUserInput('');
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }


    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // body: JSON.stringify({ message: messageToSend, mode: chatMode }), // Send chat mode - Removed mode
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!response.ok) {
        let errorDetails = `Network error: ${response.statusText} (${response.status})`;
        try {
          errorDetails = errorData.detail || errorDetails;
        } catch (jsonError) {
          console.debug("Could not parse error response as JSON:", jsonError);
        }
        throw new Error(errorDetails);
      }
      const data = await response.json();

      const newMessage = data.new && data.new.role && data.new.content
        ? data.new
        : { role: 'bot', content: 'Received incomplete or unexpected response from server.' };

      setHistory(prevHistory => {
        const historyWithoutOptimisticUser = prevHistory.filter(msg => msg !== userMessage);
        return [...historyWithoutOptimisticUser, userMessage, newMessage];
      });
    } catch (error) {
      console.error("Failed to send message or receive response:", error);
      const errorMessage = { role: 'bot', content: `Sorry, I encountered an error: ${error.message}` };
      setHistory(prevHistory => [...prevHistory, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isSending && !isClearing) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Are you sure you want to clear the entire chat history? This cannot be undone.")) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        let errorDetails = `Failed to clear history (${response.status} ${response.statusText})`;
        try {
          const errorData = await response.json();
          errorDetails = errorData.detail || errorDetails;
        } catch (jsonError) {
          console.debug("Could not parse error response as JSON:", jsonError);
        }
        throw new Error(errorDetails);
      }
      setHistory([]);
      console.log("Chat history cleared successfully.");
    } catch (error) {
      console.error("Failed to clear chat history:", error);
      const clearErrorMessage = { role: 'bot', content: `Failed to clear chat on server: ${error.message}. Please try again.` };
      setHistory([clearErrorMessage]);
    } finally {
      setIsClearing(false);
    }
  };

  const insertSqlCommand = () => {
    setCurrentUserInput(prevInput => {
      // Add '/sql ' only if it's not already at the start
      if (!prevInput.trim().toLowerCase().startsWith('/sql ')) {
        return '/sql ' + prevInput;
      }
      return prevInput;
    });
    textareaRef.current?.focus(); // Focus the textarea after inserting
  };

  return (
    <>
      {/* Chat Window */}
      <div ref={chatWindowRef} className="chat-window mb-3 p-3 border rounded bg-light" aria-live="polite">
        {history.length === 0 && !isSending && !isClearing && (
          <div className="text-center text-muted mt-5">
            No messages yet. Start by asking a question about space missions below!
          </div>
        )}
        {history.map((message, index) => (
          <div key={index} className={`message-wrapper ${message.role === 'user' ? 'user-message-wrapper' : 'bot-message-wrapper'}`}>
            <div className={`message-bubble p-2 px-3 mb-2 d-inline-block rounded shadow-sm ${message.role === 'user' ? 'bg-primary text-white user-bubble' : 'bg-white text-dark bot-bubble'}`}>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Action Buttons */}
            {message.role === 'bot' && message.rows && message.columns && message.rows.length > 0 && (
              <div className="mt-2 mb-3 text-end action-buttons-container">
                <button
                  onClick={() => openTableModal(message.columns, message.rows)}
                  className="btn btn-sm btn-outline-primary me-2"
                  title="View table data in modal"
                >
                  <i className="bi bi-table me-1"></i>
                  View Table
                </button>
                <button
                  onClick={() => downloadTableAsXLSX(message.columns, message.rows)}
                  className="btn btn-sm btn-outline-success"
                  title="Download table data as XLSX"
                >
                  <i className="bi bi-download me-1"></i>
                  Download XLSX
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicators */}
        {isSending && (
          <div className="d-flex align-items-center text-muted p-2 bot-message-wrapper">
            <div className="message-bubble p-2 px-3 mb-2 d-inline-block rounded shadow-sm bg-white text-dark bot-bubble">
              <div className="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></div>
              <span>Bot is thinking...</span>
            </div>
          </div>
        )}
        {isClearing && (
          <div className="d-flex align-items-center text-muted p-2">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
            <span>Clearing history...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="input-group chat-input-group">
        {/* Wrapper for textarea and hint */}
        <div className="textarea-wrapper flex-grow-1 position-relative">
          <textarea
            ref={textareaRef}
            placeholder="Ask about space missions..."
            // Add class to apply padding when hint is visible
            className={`form-control ${!currentUserInput.toLowerCase().startsWith('/sql ') && !currentUserInput ? 'textarea-with-hint-overlay' : ''}`}
            value={currentUserInput}
            onChange={(e) => setCurrentUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || isClearing}
            aria-label="Chat input"
            rows="1"
            style={{ resize: 'none', overflowY: 'hidden' }}
          />
        </div>


        {/* Send Button */}
        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={isSending || isClearing || !currentUserInput.trim()}
          title="Send message"
        >
          {isSending ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              <span className="visually-hidden">Sending...</span>
            </>
          ) : (
            <i className="bi bi-send"></i>
          )}
        </button>

        {/* Clear Button */}
        <button
          className="btn btn-outline-danger"
          onClick={clearChat}
          disabled={isSending || isClearing || history.length === 0}
          title="Clear chat history"
        >
          <i className="bi bi-trash"></i>
          <span className="clear-button-text ms-1">Delete</span> 
        </button>
      </div>

      {/* Table Modal */}
      <TableModal
        isOpen={isModalOpen}
        onClose={closeTableModal}
        columns={modalData.columns}
        rows={modalData.rows}
      />
    </>
  );
}