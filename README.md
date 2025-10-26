# Pathways

Ever wanted to explore different directions in an AI conversation? When learning something new, you might have a follow-up question but also want to keep exploring the original thread. Or when planning something, you want to compare different options without starting over.

**Pathways** lets you branch conversations with Claude AI at any point and explore multiple paths simultaneously. A visual tree shows all your conversation branches, and you can easily jump between them.

## Demo Videos

- [Learning/Research Use Case](https://www.youtube.com/watch?v=AoZIyKOP-ps)
- [Trip Planning Use Case](https://www.youtube.com/watch?v=h7RiUqW2bLM)

## Use Cases

- 🧠 **Learning complex topics**: Go deep on one aspect, then return to explore another
- ✈️ **Trip planning**: Develop parallel itineraries and compare them
- ✍️ **Creative writing**: Explore different plot directions
- 🎯 **Decision making**: Properly explore "what if" scenarios

## Quick Start

### Prerequisites

- Node.js (v14+)
- [Anthropic API key](https://console.anthropic.com/)

### Setup

1. Clone and install dependencies:
```bash
git clone https://github.com/arunabh98/pathways-ai.git
cd pathways-ai

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

2. Configure your API key:
```bash
cd ../server
cp .env.example .env
```

Edit `server/.env` and add your Anthropic API key:
```
PORT=3001
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

3. Run the application:

**Terminal 1 - Start the server:**
```bash
cd server
npm start
```
Server runs on `http://localhost:3001`

**Terminal 2 - Start the client:**
```bash
cd client
npm start
```
App opens automatically at `http://localhost:3000`

## How to Use

- **Start a conversation**: Type your message and press Send
- **Create a branch**: Click the ⤴ button on any AI response
- **View the tree**: Press `Ctrl/Cmd+B` or click the 🗺 button
- **Switch branches**: Click any node in the tree view to jump to that conversation path

## Tech Stack

React • Express • Claude Sonnet 4.5 • D3.js for tree visualization

---

## Security Notes

⚠️ **Important**:
- **Never commit your `.env` file** - it contains your API key
- **Never share your Anthropic API key publicly** - treat it like a password
- Conversations are stored in memory only and cleared when the server restarts (no data persistence)
- This is an experimental project - use responsibly and don't share sensitive information in conversations

---

## About This Project

This is an experimental personal project exploring branching AI conversations. Built with AI-assisted development, it demonstrates how conversation trees can help with learning, planning, and decision-making.

The project is provided as-is for educational and personal use. Feel free to fork, experiment, and build upon it!

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

**Note**: Conversations are stored in memory and will reset when you restart the server.
