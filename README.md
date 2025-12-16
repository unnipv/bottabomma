# WhatsApp Link Archiver Bot

Archives links shared in a WhatsApp group to a Google Sheet automatically.

## Features

- 🔗 **Automatic link capture** - Detects and archives any URLs shared in the group
- 📊 **Google Sheets integration** - Links stored with Title, Type, Keywords
- 🔄 **Smart catch-up** - Syncs missed messages when bot restarts (last 100 by default)
- 🚫 **Duplicate prevention** - Uses message IDs to never add the same link twice
- 🏷️ **Auto-categorization** - Infers content type from URL (Article, Video, Podcast, etc.)
- 🔑 **Keyword extraction** - Automatically extracts keywords from message text

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Sheets API**
4. Go to **Credentials** > **Create Credentials** > **Service Account**
5. Download the JSON key file
6. Save it as `./credentials/service-account.json`
7. **Important**: Share your Google Sheet with the service account email (found in the JSON file)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GOOGLE_SHEET_ID=your_spreadsheet_id_here
TARGET_GROUP_ID=your_group_id_here
```

> **Finding Sheet ID**: From your sheet URL `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

> **Finding Group ID**: Run the bot once without `TARGET_GROUP_ID` set - it will list all groups with their IDs

### 4. Run the Bot

```bash
npm start
```

On first run:
1. A QR code will appear in the terminal
2. Open WhatsApp on your phone
3. Go to **Settings** > **Linked Devices** > **Link a Device**
4. Scan the QR code

The session is saved locally, so you won't need to scan again unless you logout.

## Sheet Format

| # | Title | Type | keywords | Link to access |
|---|-------|------|----------|----------------|
| 1 | Article about... | Article | tech, ai | https://... |
| 2 | Great podcast... | Podcast | music | https://... |

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_SHEET_ID` | Your Google Sheet ID | Required |
| `TARGET_GROUP_ID` | WhatsApp group ID to monitor | Required |
| `CATCHUP_MESSAGE_COUNT` | Messages to sync on restart | 100 |
| `LOG_LEVEL` | Logging verbosity | info |

## Project Structure

```
bottabomma/
├── src/
│   ├── index.js          # Main entry point
│   ├── whatsapp/         # WhatsApp client & handlers
│   ├── sheets/           # Google Sheets integration
│   ├── utils/            # Link extraction, deduplication
│   └── catchup/          # Missed message sync
├── config/               # Configuration
├── credentials/          # Google API credentials (gitignored)
└── .wwebjs_auth/        # WhatsApp session (gitignored)
```

## Troubleshooting

**QR code not scanning?**  
- Make sure your phone has internet access
- Try deleting `.wwebjs_auth/` folder and restarting

**Google Sheets errors?**  
- Verify the service account email has Editor access to your sheet
- Check that `GOOGLE_SHEET_ID` is correct

**Bot not seeing messages?**  
- Ensure `TARGET_GROUP_ID` is correct (run without it to see all group IDs)
- The bot only processes messages received after it starts (plus catch-up sync)

## License

MIT
