# Hans - Personal WhatsApp Assistant for Wegmans

Hans is an AI-powered personal assistant that manages your Wegmans grocery list via WhatsApp. Just text Hans naturally - "hey, I need eggs and milk for tomorrow" - and the items will appear in your Wegmans app ready for your next shopping trip.

## Features

- **Natural Language**: Talk to Hans like a human - no rigid commands needed
- **Powered by Gemini**: Google's AI understands context and handles multi-item requests
- **Smart Item Matching**: Searches your past purchases first for quick adds
- **Interactive Selection**: Choose the exact product when multiple matches are found
- **Persistent Sessions**: Stays logged in to both WhatsApp and Wegmans
- **Docker Ready**: Easy deployment on Raspberry Pi or any server

## Prerequisites

- **Node.js 20+** (for local development)
- **Docker & Docker Compose** (for containerized deployment)
- A **Wegmans account** with an existing shopping list
- **WhatsApp** on your phone
- **Gemini API key** (free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey))

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url> hans
cd hans
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Your WhatsApp number in format: countrycode + number + @c.us
# Example: For US number (202) 555-1234, use: 12025551234@c.us
OWNER_PHONE_NUMBER=12025551234@c.us

# Gemini API key for natural language processing
# Get yours free at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key

# Your Wegmans account credentials
WEGMANS_EMAIL=your-email@example.com
WEGMANS_PASSWORD=your-wegmans-password

# Optional settings
LOG_LEVEL=info
DATA_PATH=./data
```

### 3. Build the Project

```bash
npm run build
```

## Running Hans

### Option A: Local Development

```bash
npm run dev
```

### Option B: Docker (Recommended for Raspberry Pi)

```bash
cd docker
docker compose up --build -d
```

View logs:
```bash
docker logs -f hans
```

## WhatsApp Setup

When Hans starts for the first time, it needs to connect to your WhatsApp account.

### 1. Watch the Logs

```bash
# Local
npm run dev

# Or Docker
docker logs -f hans
```

### 2. Scan the QR Code

You'll see a QR code printed in the terminal:

```
============================================================
SCAN THIS QR CODE WITH WHATSAPP:
============================================================

▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▀█ █▄ ▄▄██ ▄▄▄▄▄ █
...

============================================================
```

### 3. Link Your WhatsApp

1. Open WhatsApp on your phone
2. Go to **Settings** → **Linked Devices**
3. Tap **Link a Device**
4. Scan the QR code from the terminal

Once linked, you'll see:
```
WhatsApp client is ready!
```

The session is saved automatically. You won't need to scan again unless you unlink the device.

## Wegmans Authentication

Hans needs to log in to your Wegmans account to manage your shopping list. Since this requires a browser, we provide a web-based authentication tool accessible via SSH tunnel.

### 1. Start the Auth Server

```bash
# Local
npm run auth

# Or in Docker, exec into the container
docker exec -it hans npm run auth:start
```

You'll see:
```
============================================================
WEGMANS AUTH SERVER STARTED
============================================================

To authenticate via SSH tunnel:
  1. ssh -L 3847:localhost:3847 user@your-pi
  2. Open http://localhost:3847 in your browser

============================================================
```

### 2. Create SSH Tunnel (if running on remote server)

From your local machine:

```bash
ssh -L 3847:localhost:3847 user@your-raspberry-pi
```

### 3. Complete Login in Browser

1. Open [http://localhost:3847](http://localhost:3847) in your browser
2. Click **Start Login** - this opens Wegmans login page in a headless browser
3. Click **View Browser** to see the current page
4. Use the text input to type your email, then click **Type**
5. Click **Press Enter** or use the interface to navigate
6. Complete the login process (you'll see the page update in screenshots)
7. Once logged in, click **Save Session**

Your Wegmans session is now saved and Hans can manage your list.

### Re-authentication

If your Wegmans session expires, Hans will notify you. Simply run the auth server again to re-authenticate.

## Using Hans

Once both WhatsApp and Wegmans are set up, just text Hans naturally from your phone.

### Natural Language Examples

Hans understands conversational requests:

| What you say | What Hans does |
|--------------|----------------|
| "I need eggs and milk" | Adds both items to your list |
| "Add bananas for tomorrow" | Adds bananas |
| "What's on my list?" | Shows your current list |
| "Remove the eggs" | Removes eggs from the list |
| "The second one" | Selects option 2 from previous choices |
| "Find organic almond milk" | Searches the full catalog |
| "Clear everything" | Empties your list |
| "/reset" | Clears conversation context |

### Example Conversations

**Adding multiple items:**
```
You: hey can you add some eggs and also I need bananas

Hans: I'll add those for you!

Found eggs in your past purchases:
1. Wegmans Organic Large Brown Eggs (12 ct) - $5.99
2. Wegmans Large White Eggs (18 ct) - $3.49

Which eggs would you like?

(Added bananas to your list)

You: the organic ones

Hans: Added "Wegmans Organic Large Brown Eggs" to your list
```

**Checking your list:**
```
You: what do I have so far?

Hans: Your shopping list (3 items):
1. Wegmans Organic Large Brown Eggs (12 ct) - $5.99
2. Wegmans 2% Milk (1 gal) - $4.29
3. Bananas - $0.59/lb
```

**Removing items:**
```
You: actually remove the milk

Hans: Done! Removed milk from your list.
```

**Searching for new items:**
```
You: I want to try that new oat milk everyone's talking about

Hans: Found 5 oat milk options:
1. Oatly Oat Milk Original (64 oz) - $5.49
2. Wegmans Organic Oat Milk (64 oz) - $4.29
3. Califia Farms Oat Barista Blend (32 oz) - $5.99
4. Planet Oat Original (52 oz) - $4.49
5. Chobani Oat Plain (52 oz) - $4.79

Which one looks good?

You: 2

Hans: Added "Wegmans Organic Oat Milk" to your list
```

### Tips

- **Be conversational**: Hans understands context, so "add that" works after seeing options
- **Multiple items**: Add several things in one message - "eggs, milk, and bread"
- **Past purchases first**: Hans checks what you usually buy before searching
- **Be specific**: "organic 2% milk" gets better matches than just "milk"
- **Reset context**: Send "/reset" if Hans gets confused

## Deployment on Raspberry Pi

### Recommended Setup

1. **Raspberry Pi 4 or 5** with 4GB+ RAM
2. **Raspberry Pi OS Lite** (64-bit)
3. **Docker** installed

### Installation Steps

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in, then:
git clone <your-repo-url> hans
cd hans

# Configure
cp .env.example .env
nano .env  # Edit with your values

# Start Hans
cd docker
docker compose up -d

# View logs
docker logs -f hans
```

### Auto-start on Boot

Docker Compose with `restart: unless-stopped` ensures Hans starts automatically after a reboot.

### Resource Usage

- **Memory**: ~500MB-1GB (Chromium is the main consumer)
- **CPU**: Low when idle, moderate during browser automation
- **Storage**: ~2GB for Docker image + data

## Troubleshooting

### WhatsApp won't connect

- Ensure your phone has internet access
- Try unlinking all devices in WhatsApp and re-scanning
- Delete `data/whatsapp-session/` and restart

### Wegmans login fails

- Verify your credentials in `.env`
- Check if Wegmans website is accessible
- Re-run the auth server and complete login manually
- Delete `data/browser-state/wegmans` and re-authenticate

### "Item not found" errors

- Try more specific search terms
- Use `search` instead of `add` for new items
- Check if the item exists on wegmans.com

### Docker container crashes

- Increase `shm_size` in docker-compose.yml (try `2gb`)
- Check available memory with `free -h`
- View crash logs: `docker logs hans`

### Gemini API errors

- Verify your `GEMINI_API_KEY` in `.env`
- Check your quota at [Google AI Studio](https://aistudio.google.com/)
- Free tier: 1,500 requests/day, 1 million tokens/minute
- If rate limited, wait a minute and try again

## Project Structure

```
hans/
├── src/
│   ├── index.ts              # Main entry point
│   ├── auth-server.ts        # Web-based Wegmans auth
│   ├── config.ts             # Configuration
│   ├── llm/                  # AI/LLM integration
│   │   ├── gemini.ts         # Gemini API client
│   │   └── agent.ts          # Agentic orchestration
│   ├── whatsapp/             # WhatsApp client
│   ├── actions/              # Action handlers
│   │   └── wegmans/          # Wegmans automation
│   ├── browser/              # Playwright browser pool
│   └── db/                   # SQLite persistence
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── data/                     # Persistent data (gitignored)
│   ├── whatsapp-session/
│   ├── browser-state/
│   └── hans.db
└── .env                      # Your configuration (gitignored)
```

## Security Notes

- Your `.env` file contains sensitive credentials - never commit it
- WhatsApp session data in `data/` provides full access to your WhatsApp
- Consider running on a private network or with proper firewall rules
- The auth server only binds to localhost (accessible only via SSH tunnel)

## License

MIT
