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

function getRecentConversationContext(session, currentMessageId, limit = 3) {
  const context = [];
  let messageId = currentMessageId;
  let count = 0;
  
  // Walk backwards through the conversation to get recent context
  while (messageId && count < limit) {
    const node = session.nodes[messageId];
    if (node) {
      context.unshift({
        role: node.role,
        content: node.content // Use full content for better context
      });
      messageId = node.parent;
      count++;
    } else {
      break;
    }
  }
  
  return context;
}

async function generateNodeName(content, previousContent, role, session = null, messageId = null) {
  try {
    // Handle edge cases
    if (!content || content.trim() === '') {
      return role === 'user' ? 'Empty message' : 'Empty response';
    }
    
    // Get conversation context if available
    let contextMessages = '';
    if (session && messageId) {
      const recentMessages = getRecentConversationContext(session, messageId, 3);
      if (recentMessages.length > 0) {
        contextMessages = '\n\nRecent conversation context:\n' + 
          recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      }
    }
    
    const prompt = role === 'user'
      ? `You are generating a navigation label for a conversation tree interface. Users will see this label on a clickable node to understand what this branch of conversation contains.

Generate a clear, descriptive 3-5 word label that captures the essence of this user message. The label should help users quickly identify this conversation branch when navigating.${contextMessages}

Current message: "${content}"

Return ONLY the label, no explanation or additional text.`
      : `You are generating a navigation label for a conversation tree interface. This label will appear on an AI assistant's response node in a branching conversation view.

Generate a clear, descriptive 3-5 word label that summarizes this AI response. The label should help users understand what this response branch contains when navigating the conversation tree.${contextMessages}

User's question: "${previousContent}"
AI's response topic: "${content}"

Return ONLY the label, no explanation or additional text.`;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 20,
      temperature: 0.3,
      messages: [{ 
        role: 'user', 
        content: prompt 
      }]
    });
    
    return response.content[0].text.trim();
  } catch (error) {
    console.error('Failed to generate node name:', error);
    // Improved fallback handling
    if (!content || content.trim() === '') {
      return role === 'user' ? 'Empty message' : 'Empty response';
    }
    const words = content.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 27) + '...' : words;
  }
}

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
    
    const previousContent = parentId && session.nodes[parentId] 
      ? session.nodes[parentId].content 
      : null;
    
    const displayName = '';
    
    const userMessage = {
      id: messageId,
      role: 'user',
      content: message,
      displayName: displayName,
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

    const systemPrompt = `You are a helpful, creative, and insightful AI assistant operating within Pathways, a branching conversation application. 

In Pathways, conversations naturally diverge into multiple branches, creating a tree of possibilities. Users can explore different conversation paths, fork discussions at any point, and navigate between various branches of thought.

Key aspects of your role in Pathways:
- You're helping users explore ideas through branching dialogues within Pathways
- Each response you give could become a fork point for new conversation branches
- Users may revisit earlier points in our Pathways conversation to explore alternative directions
- Your responses should be thoughtful and open-ended when appropriate, inviting further exploration of paths
- Be aware that users might be comparing different branches to see various perspectives on the same topic

When contextually relevant, you may naturally reference that you're part of Pathways - for example, when discussing the exploration of ideas or when users ask about branching conversations. However, don't force mentions of it unnecessarily.

Maintain your helpful and friendly personality while embracing this non-linear, exploratory nature that Pathways enables. Think of yourself as a guide through a garden of forking paths, where each exchange can bloom into new possibilities.`;

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 5000,
      temperature: 0.7,
      system: systemPrompt,
      messages: conversationHistory
    });

    const assistantMessageId = uuidv4();
    const assistantDisplayName = await generateNodeName(
      completion.content[0].text, 
      message,
      'assistant',
      session,
      messageId
    );
    
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: completion.content[0].text,
      displayName: assistantDisplayName,
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
      error: 'SessionId is required in request body' 
    });
  }
  
  if (!fromMessageId) {
    return res.status(400).json({ 
      error: 'fromMessageId is required in request body' 
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
    displayName: node.displayName,
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