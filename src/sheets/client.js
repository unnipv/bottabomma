/**
 * Google Sheets API client initialization
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const config = require('../../config/default');
const logger = require('../utils/logger');

let sheetsClient = null;
let authClient = null;

/**
 * Initialize Google Sheets API client using service account credentials
 */
async function initialize() {
    try {
        const credentialsPath = path.resolve(config.sheets.credentialsPath);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(
                `Google credentials file not found at: ${credentialsPath}\n` +
                'Please follow these steps:\n' +
                '1. Go to Google Cloud Console (console.cloud.google.com)\n' +
                '2. Create a new project or select existing one\n' +
                '3. Enable Google Sheets API\n' +
                '4. Create a Service Account and download JSON key\n' +
                '5. Save the JSON file to: ./credentials/service-account.json\n' +
                '6. Share your Google Sheet with the service account email'
            );
        }

        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

        authClient = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        sheetsClient = google.sheets({ version: 'v4', auth: authClient });

        // Test connection
        await sheetsClient.spreadsheets.get({
            spreadsheetId: config.sheets.spreadsheetId
        });

        logger.info('Google Sheets API client initialized successfully');
        return sheetsClient;
    } catch (error) {
        logger.error(`Failed to initialize Google Sheets client: ${error.message}`);
        throw error;
    }
}

/**
 * Get the sheets client (must call initialize first)
 */
function getClient() {
    if (!sheetsClient) {
        throw new Error('Google Sheets client not initialized. Call initialize() first.');
    }
    return sheetsClient;
}

/**
 * Get spreadsheet ID from config
 */
function getSpreadsheetId() {
    return config.sheets.spreadsheetId;
}

/**
 * Get sheet name from config
 */
function getSheetName() {
    return config.sheets.sheetName;
}

module.exports = {
    initialize,
    getClient,
    getSpreadsheetId,
    getSheetName
};
