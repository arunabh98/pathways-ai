import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TreeSidebar from './TreeSidebar';
import Toast from './Toast';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBranch, setCurrentBranch] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '' });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const response = await axios.post('http://localhost:3001/api/session');
        setSessionId(response.data.sessionId);
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };
    
    initializeSession();
  }, []);


  const fetchMessages = async () => {
    if (!sessionId) return;
    
    try {
      const response = await axios.get(`http://localhost:3001/api/session/${sessionId}`);
      setMessages(response.data.messages);
      setCurrentBranch(response.data.currentBranch || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };


  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const createBranch = async (fromMessageId) => {
    if (!sessionId) return;
    
    try {
      await axios.post('http://localhost:3001/api/branch', {
        sessionId,
        fromMessageId
      });
      
      await fetchMessages();
      showToast('🗺 New path created!');
    } catch (error) {
      console.error('Failed to create branch:', error);
      showToast('Failed to create path');
    }
  };

  const handleBranchSwitch = async () => {
    await fetchMessages();
    showToast('📍 Switched path');
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputText.trim() || !sessionId || isLoading) return;
    
    const tempUserId = `temp-user-${Date.now()}`;
    const userMessage = {
      id: tempUserId,
      role: 'user',
      content: inputText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      const response = await axios.post('http://localhost:3001/api/chat', {
        sessionId: sessionId,
        message: inputText
      });
      
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      const assistantMessage = {
        id: tempAssistantId,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      await fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      const tempErrorId = `temp-error-${Date.now()}`;
      const errorMessage = {
        id: tempErrorId,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={`App ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <Toast 
        message={toast.message} 
        show={toast.show} 
        onClose={() => setToast({ show: false, message: '' })}
      />
      <TreeSidebar
        sessionId={sessionId}
        onBranchSwitch={handleBranchSwitch}
        currentBranch={currentBranch}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="chat-container">
        <div className="chat-header">
          <button
            className={`sidebar-toggle ${isSidebarOpen ? 'open' : ''}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? 'Close map view (Ctrl/Cmd+B)' : 'Open map view (Ctrl/Cmd+B)'}
          >
            {isSidebarOpen ? '◀' : '🗺'}
          </button>
          <h1>Pathways</h1>
        </div>
        
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <h2>Welcome to Pathways!</h2>
              <p>Start a conversation and split paths at any point to explore different routes.</p>
              <p>Click the ⤴ button on any AI response to create a new path from that point.</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-wrapper">
                {message.role === 'assistant' && (
                  <div className="message-avatar assistant-avatar">AI</div>
                )}
                <div className="message-content">
                  <div className="message-bubble">
                    {message.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.id && message.role === 'assistant' && (
                    <div className="message-actions">
                      {message.children && message.children.length > 1 && (
                        <span className="branch-indicator">
                          {message.children.length} paths
                        </span>
                      )}
                      <button
                        className="fork-button"
                        onClick={() => createBranch(message.id)}
                        title="Split path from this response"
                      >
                        ⤴
                      </button>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="message-avatar user-avatar">U</div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant-message">
              <div className="message-wrapper">
                <div className="message-avatar assistant-avatar">AI</div>
                <div className="message-content">
                  <div className="message-bubble typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="input-container">
          <form onSubmit={sendMessage}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              disabled={!sessionId || isLoading}
              className="message-input"
            />
            <button
              type="submit"
              disabled={!sessionId || isLoading || !inputText.trim()}
              className="send-button"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;