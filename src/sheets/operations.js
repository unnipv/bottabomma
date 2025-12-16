/**
 * Google Sheets operations for the link archiver
 * Sheet layout: Columns B-G, Header row 2, Data starts row 3
 * B=# C=Title D=Type E=keywords F=Link G=MessageID (hidden)
 */

const sheetsClient = require('./client');
const config = require('../../config/default');
const logger = require('../utils/logger');

/**
 * Get all existing message IDs from the sheet (for deduplication)
 * @returns {Promise<string[]>} Array of message IDs
 */
async function getAllMessageIds() {
    try {
        const client = sheetsClient.getClient();
        const spreadsheetId = sheetsClient.getSpreadsheetId();
        const sheetName = sheetsClient.getSheetName();

        // Message ID is in column G, data starts at row 3
        const range = `${sheetName}!G3:G`;

        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range
        });

        const rows = response.data.values || [];

        // Filter out empty values
        const messageIds = rows
            .map(row => row[0])
            .filter(id => id && id.trim() !== '');

        logger.info(`Fetched ${messageIds.length} existing message IDs from sheet`);
        return messageIds;
    } catch (error) {
        logger.error(`Failed to fetch message IDs: ${error.message}`);
        throw error;
    }
}

/**
 * Get the next row number (#) for a new entry
 * @returns {Promise<number>} Next row number
 */
async function getNextRowNumber() {
    try {
        const client = sheetsClient.getClient();
        const spreadsheetId = sheetsClient.getSpreadsheetId();
        const sheetName = sheetsClient.getSheetName();

        // Get column B (the # column), data starts at row 3
        const range = `${sheetName}!B3:B`;

        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range
        });

        const rows = response.data.values || [];

        // Count non-empty rows
        const dataRows = rows.filter(row => row[0] && row[0].toString().trim() !== '');

        return dataRows.length + 1;
    } catch (error) {
        logger.error(`Failed to get next row number: ${error.message}`);
        throw error;
    }
}

/**
 * Append a new link entry to the sheet
 * @param {Object} entry - Link entry data
 * @param {string} entry.title - Title/description
 * @param {string} entry.type - Content type
 * @param {string} entry.keywords - Comma-separated keywords
 * @param {string} entry.url - The link URL
 * @param {string} entry.messageId - WhatsApp message ID (for dedup)
 * @returns {Promise<boolean>} Success status
 */
async function appendLink(entry) {
    try {
        const client = sheetsClient.getClient();
        const spreadsheetId = sheetsClient.getSpreadsheetId();
        const sheetName = sheetsClient.getSheetName();

        const nextNumber = await getNextRowNumber();

        // Format link as HYPERLINK formula to match existing format: shows ">>" that links to URL
        const linkFormula = entry.url ? `=HYPERLINK("${entry.url}", ">>")` : '';

        // Row data: B=#, C=Title, D=Type, E=keywords, F=Link, G=MessageID
        const rowData = [
            nextNumber,
            entry.title || '',
            entry.type || 'Article',
            entry.keywords || '',
            linkFormula,
            entry.messageId || ''
        ];

        await client.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!B:G`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [rowData]
            }
        });

        const titlePreview = entry.title ? entry.title.substring(0, 50) : 'No title';
        logger.info(`Added link #${nextNumber}: "${titlePreview}..."`);
        return true;
    } catch (error) {
        logger.error(`Failed to append link: ${error.message}`);
        throw error;
    }
}

/**
 * Check if headers exist (row 2)
 * Headers should already exist in your sheet, but this verifies connectivity
 */
async function ensureHeaders() {
    try {
        const client = sheetsClient.getClient();
        const spreadsheetId = sheetsClient.getSpreadsheetId();
        const sheetName = sheetsClient.getSheetName();

        // Check if headers exist in row 2
        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!B2:G2`
        });

        const headerRow = response.data.values?.[0] || [];

        // If no headers found, create them
        if (headerRow.length === 0 || headerRow[0] !== '#') {
            const headers = ['#', 'Title', 'Type', 'keywords', 'Link to access', 'Message ID'];

            await client.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!B2:G2`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [headers]
                }
            });

            logger.info('Created sheet headers in row 2');
        } else {
            logger.info('Sheet headers verified');
        }
    } catch (error) {
        logger.error(`Failed to ensure headers: ${error.message}`);
        throw error;
    }
}

module.exports = {
    getAllMessageIds,
    getNextRowNumber,
    appendLink,
    ensureHeaders
};
