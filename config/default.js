require('dotenv').config();

module.exports = {
    // Google Sheets
    sheets: {
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || './credentials/service-account.json',
        sheetName: process.env.GOOGLE_SHEET_NAME,
        // Sheet layout: data starts at column B, header is row 2
        startColumn: 'B',
        endColumn: 'G',      // B=# C=Title D=Type E=keywords F=Link G=MessageID
        headerRow: 2,
        dataStartRow: 3
    },

    // WhatsApp
    whatsapp: {
        targetGroupId: process.env.TARGET_GROUP_ID,
        sessionPath: './.wwebjs_auth',
        chromiumPath: process.env.CHROMIUM_PATH || ''
    },

    // Catch-up sync
    catchup: {
        messageCount: parseInt(process.env.CATCHUP_MESSAGE_COUNT, 10) || 100
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};
