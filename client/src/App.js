import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import TreeSidebar from './TreeSidebar';
import Toast from './Toast';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBranch, setCurrentBranch] = useState([]);
  const [treeData, setTreeData] = useState(null);
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

  useEffect(() => {
    if (sessionId) {
      fetchTreeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

  const fetchTreeData = async () => {
    if (!sessionId) return;
    
    try {
      const response = await axios.get(`http://localhost:3001/api/session/${sessionId}/tree`);
      setTreeData(response.data.tree);
    } catch (error) {
      console.error('Failed to fetch tree data:', error);
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
      await fetchTreeData();
      showToast('🌿 Branch created!');
    } catch (error) {
      console.error('Failed to create branch:', error);
      showToast('Failed to create branch');
    }
  };

  const handleBranchSwitch = async () => {
    await fetchMessages();
    await fetchTreeData();
    showToast('📍 Switched branch');
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
      await fetchTreeData();
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

  return (
    <div className="App">
      <Toast 
        message={toast.message} 
        show={toast.show} 
        onClose={() => setToast({ show: false, message: '' })}
      />
      <TreeSidebar
        sessionId={sessionId}
        onBranchSwitch={handleBranchSwitch}
        currentBranch={currentBranch}
      />
      <div className="chat-container">
        <div className="chat-header">
          <h1>Chat with Claude</h1>
        </div>
        
        <div className="messages-container">
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-wrapper">
                <div className="message-bubble">
                  {message.content}
                </div>
                {message.id && (
                  <button
                    className="fork-button"
                    onClick={() => createBranch(message.id)}
                    title="Create branch from this message"
                  >
                    🍴
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant-message">
              <div className="message-bubble typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={sendMessage} className="input-container">
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
  );
}

export default App;