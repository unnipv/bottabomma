/**
 * WhatsApp message handlers for processing incoming messages
 */

const config = require('../../config/default');
const logger = require('../utils/logger');
const { extractUrls, hasLinks } = require('../utils/linkExtractor');
const { extractWithLLM } = require('../utils/llmExtractor');
const deduplication = require('../utils/deduplication');
const sheetsOperations = require('../sheets/operations');

/**
 * Bot commands configuration
 */
const COMMANDS = {
    '/link': async (message, chat) => {
        const sheetId = config.sheets.spreadsheetId;
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
        await chat.sendMessage(`📚 *Brain Fodder Repository*\n\n${sheetUrl}`);
        logger.info('Sent sheet link');
    },

    '/huh': async (message, chat) => {
        const response = `🤖 *Bottabomma* here!\n\n` +
            `I'm your caffeinated link-hoarding assistant.`;
        await chat.sendMessage(response);
        logger.info('Sent bot description');
    }
};

/**
 * Check if message is a command and handle it
 * @param {Message} message - WhatsApp message
 * @param {Chat} chat - WhatsApp chat
 * @returns {Promise<boolean>} True if command was handled
 */
async function handleCommand(message, chat) {
    const body = (message.body || '').trim().toLowerCase();

    for (const [command, handler] of Object.entries(COMMANDS)) {
        if (body === command) {
            await handler(message, chat);
            return true;
        }
    }
    return false;
}

/**
 * Process a single message that contains links
 * @param {Message} message - WhatsApp message object
 * @returns {Promise<boolean>} True if processed successfully
 */
async function processLinkMessage(message) {
    const messageId = message.id._serialized;
    const body = message.body || '';

    // Check for duplicates FIRST
    if (deduplication.isDuplicate(messageId)) {
        logger.debug(`Skipping duplicate message: ${messageId}`);
        return false;
    }

    // Mark as processed IMMEDIATELY to prevent race conditions
    deduplication.markProcessed(messageId);

    // Extract URLs
    const urls = extractUrls(body);
    if (urls.length === 0) {
        return false;
    }

    // Use LLM for smart extraction (or fallback to basic)
    try {
        const extracted = await extractWithLLM(body, urls[0]);

        await sheetsOperations.appendLink({
            title: extracted.title || urls[0],
            type: extracted.type || 'Article',
            keywords: extracted.keywords || '',
            url: urls[0],
            messageId
        });

        // React with ☕ emoji to confirm archiving
        await message.react('☕');

        logger.info(`Archived: "${extracted.title?.substring(0, 40) || 'Untitled'}..." [${extracted.type}]`);
        return true;
    } catch (error) {
        logger.error(`Failed to archive link ${urls[0]}: ${error.message}`);
        return false;
    }
}

/**
 * Handle incoming message event
 * @param {Message} message - WhatsApp message object
 * @param {string} targetGroupId - ID of the target group to monitor
 */
async function handleMessage(message, targetGroupId) {
    try {
        // Get chat info
        const chat = await message.getChat();

        // Only process messages from the target group
        if (!chat.isGroup || chat.id._serialized !== targetGroupId) {
            return;
        }

        // Check for commands first
        if (await handleCommand(message, chat)) {
            return;
        }

        // Skip messages without links
        if (!hasLinks(message.body)) {
            return;
        }

        logger.debug(`Processing message from group "${chat.name}"`);
        await processLinkMessage(message);
    } catch (error) {
        logger.error(`Error handling message: ${error.message}`);
    }
}

/**
 * Set up message listener on the WhatsApp client
 * @param {Client} client - WhatsApp client instance
 * @param {string} targetGroupId - ID of the target group
 */
function setupMessageListener(client, targetGroupId) {
    // Only use 'message' event - 'message_create' causes duplicates
    client.on('message', async (message) => {
        await handleMessage(message, targetGroupId);
    });

    logger.info('Message listener configured');
}

module.exports = {
    processLinkMessage,
    handleMessage,
    handleCommand,
    setupMessageListener
};
