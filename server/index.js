require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const sessions = {};

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/session', (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = {
    id: sessionId,
    nodes: {},
    currentBranch: [],
    rootMessageId: null,
    createdAt: new Date()
  };
  
  res.json({ sessionId });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required in request body' 
      });
    }

    if (!sessionId) {
      return res.status(400).json({ 
        error: 'SessionId is required in request body' 
      });
    }

    if (!sessions[sessionId]) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    const session = sessions[sessionId];
    const messageId = uuidv4();
    const parentId = session.currentBranch.length > 0 
      ? session.currentBranch[session.currentBranch.length - 1] 
      : null;
    
    const userMessage = {
      id: messageId,
      role: 'user',
      content: message,
      parent: parentId,
      children: [],
      timestamp: new Date()
    };
    
    session.nodes[messageId] = userMessage;
    
    if (!session.rootMessageId) {
      session.rootMessageId = messageId;
    }
    
    if (parentId && session.nodes[parentId]) {
      session.nodes[parentId].children.push(messageId);
    }
    
    session.currentBranch.push(messageId);

    const conversationHistory = [];
    for (const msgId of session.currentBranch) {
      const msg = session.nodes[msgId];
      conversationHistory.push({
        role: msg.role,
        content: [
          {
            type: 'text',
            text: msg.content
          }
        ]
      });
    }

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 5000,
      temperature: 1,
      messages: conversationHistory
    });

    const assistantMessageId = uuidv4();
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: completion.content[0].text,
      parent: messageId,
      children: [],
      timestamp: new Date()
    };
    
    session.nodes[assistantMessageId] = assistantMessage;
    session.nodes[messageId].children.push(assistantMessageId);
    session.currentBranch.push(assistantMessageId);

    res.json({
      response: completion.content[0].text,
      messageId: assistantMessageId
    });

  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    
    if (error.status === 401) {
      res.status(401).json({ 
        error: 'Invalid API key. Please check your ANTHROPIC_API_KEY in .env file.' 
      });
    } else if (error.status === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to get response from Claude',
        details: error.message 
      });
    }
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ 
      error: 'Session not found' 
    });
  }
  
  const session = sessions[sessionId];
  const messages = [];
  
  for (const msgId of session.currentBranch) {
    messages.push(session.nodes[msgId]);
  }
  
  res.json({
    sessionId,
    messages,
    currentBranch: session.currentBranch,
    createdAt: session.createdAt
  });
});

app.post('/api/branch', (req, res) => {
  const { sessionId, fromMessageId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ 
      error: 'SessionId is required' 
    });
  }
  
  if (!fromMessageId) {
    return res.status(400).json({ 
      error: 'fromMessageId is required' 
    });
  }
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ 
      error: 'Session not found' 
    });
  }
  
  const session = sessions[sessionId];
  
  if (!session.nodes[fromMessageId]) {
    return res.status(404).json({ 
      error: 'Message not found' 
    });
  }
  
  const newBranch = [];
  let currentId = fromMessageId;
  
  while (currentId) {
    newBranch.unshift(currentId);
    currentId = session.nodes[currentId].parent;
  }
  
  session.currentBranch = newBranch;
  
  res.json({
    sessionId,
    currentBranch: session.currentBranch,
    branchedFrom: fromMessageId
  });
});

function buildTree(session, nodeId) {
  if (!nodeId || !session.nodes[nodeId]) {
    return null;
  }
  
  const node = session.nodes[nodeId];
  const treeNode = {
    id: node.id,
    role: node.role,
    content: node.content,
    timestamp: node.timestamp,
    children: []
  };
  
  for (const childId of node.children) {
    const childTree = buildTree(session, childId);
    if (childTree) {
      treeNode.children.push(childTree);
    }
  }
  
  return treeNode;
}

app.get('/api/session/:sessionId/tree', (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ 
      error: 'Session not found' 
    });
  }
  
  const session = sessions[sessionId];
  const tree = buildTree(session, session.rootMessageId);
  
  res.json({
    sessionId,
    tree,
    currentBranch: session.currentBranch,
    createdAt: session.createdAt
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});