# TON Alert 🔔

![TON Alert](demo.gif)

A professional real-time monitoring tool for TON Network liquidity pools. Track new pairs, analyze token metrics, and receive instant notifications about potential opportunities in the TON DeFi ecosystem.

## 🌟 Features

- Real-time monitoring of new liquidity pools on DeDust and STON.fi
- Comprehensive token analysis including:
  - Liquidity metrics and price calculations
  - Token contract verification
  - Social media presence validation
  - Website analysis and validation
  - Top holders analysis
  - Burned and locked liquidity tracking
- Smart scoring system for quick assessment
- Telegram notifications with detailed analytics
- Beautiful console interface with real-time updates
- Support for both TON and USDT pairs

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Telegram Bot Token (optional, for notifications)
- TON Center API key (optional, for enhanced functionality)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/VictorNoxx/ton-alert.git
cd ton-alert
```

2. Install dependencies:
```bash
npm install
```

3. Create your environment file:
```bash
cp example.env .env
```

4. Configure your `.env` file:
```env
# API Keys
DEDUST_API=https://api.dedust.io/v2/pools
STONFI_API=https://api.ston.fi/v1/pools
DEDUST_PRICES_API=https://api.dedust.io/v2/prices
TONCENTER_API_KEY=your_toncenter_api_key_here

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Twitter/X Configuration
RETTIWT_API_KEY=your_rettiwt_api_key_here
```

### Running the Application

```bash
npm start
```

## 💡 Use Cases

### 1. Trading Bot Integration

The tool can be integrated with trading bots to:
- Automatically detect new pairs
- Analyze token metrics and safety scores
- Execute trades based on custom criteria
- Monitor liquidity changes

### 2. Telegram Notification Bot

Set up as a Telegram bot to:
- Receive instant notifications about new pairs
- Get detailed token analysis
- Track specific metrics
- Share opportunities with your community

### 3. Market Research Tool

Use for:
- Analyzing new projects in the TON ecosystem
- Tracking market trends
- Monitoring liquidity movements
- Identifying potential opportunities

## 🔧 Configuration Options

### Telegram Bot Setup

1. Create a new bot with [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Create a channel or group
4. Add your bot as admin
5. Get the chat ID
6. Update your `.env` file with the credentials

### TON Center API

1. Get your API key from [TON Center](https://toncenter.com/)
2. Add it to your `.env` file
3. Enjoy enhanced functionality for token analysis

## 📊 Output Format

The tool provides information in two formats:

### Console Output
- Real-time updates with color coding
- Progress indicators
- Status messages
- Basic metrics

### Telegram Notifications
- Detailed token analysis
- Social media verification results
- Contract analysis
- Liquidity metrics
- Safety score
- Quick action links

## ⚠️ Disclaimer

This tool is for informational purposes only. Always conduct your own research before making any investment decisions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check [issues page](../../issues).

## ⭐️ Show your support

Give a ⭐️ if this project helped you!