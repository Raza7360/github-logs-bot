# GitHub Telegram Activity Monitor Bot

A Telegram bot that monitors all public activities of the [openlabsdevs](https://github.com/openlabsdevs) GitHub account and sends real-time notifications to both bot chat and group channels.

## Features

- 🔔 Real-time monitoring of GitHub activities
- 📬 Sends notifications to bot chat and group
- 📝 Supports multiple event types:
  - Push events
  - Issues and PR events
  - Comments and reviews
  - Stars, forks, and releases
  - Create/delete events
- ⏱️ Configurable polling interval
- 🤖 Interactive bot commands
- 🎨 Formatted messages with emojis and markdown

## Prerequisites

- Node.js (v14 or higher)
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- Telegram chat ID and group ID
- (Optional) GitHub personal access token for higher rate limits

## Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd github-ping-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   TELEGRAM_GROUP_ID=your_group_id_here
   GITHUB_USERNAME=openlabsdevs
   GITHUB_TOKEN=your_github_token_here_optional
   POLL_INTERVAL=300000
   ```

## Getting Your Telegram IDs

### Bot Token
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token provided

### Chat ID (Personal Chat)
1. Start a chat with your bot
2. Send any message to it
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":123456789}` in the response
5. Copy the ID

### Group ID
1. Add your bot to the group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":-100123456789}` (negative number for groups)
5. Copy the ID

## Usage

### Start the bot:

```bash
npm start
```

### Development mode (auto-restart on changes):

```bash
npm run dev
```

## Bot Commands

- `/start` - Show welcome message and available commands
- `/status` - Check bot status and last check time
- `/check` - Manually check for new activities

## Supported GitHub Events

The bot monitors and reports the following GitHub activities:

- **PushEvent** - Code pushes to repositories
- **CreateEvent** - Branch or tag creation
- **DeleteEvent** - Branch or tag deletion
- **IssuesEvent** - Issues opened, closed, or reopened
- **IssueCommentEvent** - Comments on issues
- **PullRequestEvent** - Pull requests opened, closed, or merged
- **PullRequestReviewEvent** - PR reviews submitted
- **PullRequestReviewCommentEvent** - Comments on PR reviews
- **WatchEvent** - Repository stars
- **ForkEvent** - Repository forks
- **ReleaseEvent** - New releases published

## Configuration

### Polling Interval

The `POLL_INTERVAL` is set in milliseconds (default: 300000 = 5 minutes). Adjust based on your needs:

```env
POLL_INTERVAL=60000  # 1 minute
POLL_INTERVAL=300000 # 5 minutes (recommended)
```

### GitHub Token (Optional)

Without a token, you're limited to 60 requests per hour. With a token, you get 5000 requests per hour.

To create a token:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. No scopes needed for public data
4. Copy and add to `.env`

## Project Structure

```
github-ping-bot/
├── index.js           # Main bot application
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
├── .env              # Your configuration (create this)
├── .gitignore        # Git ignore file
└── README.md         # This file
```

## Troubleshooting

### Bot not sending messages

1. Check that your bot token is correct
2. Ensure the bot has been started (send `/start` to it)
3. Verify chat IDs are correct (both should be numbers)
4. For groups, make sure the bot has permission to send messages

### GitHub rate limit errors

1. Add a GitHub personal access token to `.env`
2. Increase the `POLL_INTERVAL` value

### Polling errors

1. Check your internet connection
2. Verify the bot token is valid
3. Look at console logs for specific error messages

## Development

To contribute or modify:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

## Credits

Built with:
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [axios](https://github.com/axios/axios)
- [dotenv](https://github.com/motdotla/dotenv)