/**
 * WhatsApp message handlers for processing incoming messages
 */

const config = require('../../config/default');
const logger = require('../utils/logger');
const { extractUrls, hasLinks } = require('../utils/linkExtractor');
const { extractWithLLM, extractDocumentMetadata } = require('../utils/llmExtractor');
const { uploadDocument, canUpload } = require('../utils/documentUploader');
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
 * Process a message that contains a document attachment
 * @param {Message} message - WhatsApp message object
 * @returns {Promise<boolean>} True if processed successfully
 */
async function processDocumentMessage(message) {
    const messageId = message.id._serialized;

    // Check for duplicates FIRST
    if (deduplication.isDuplicate(messageId)) {
        logger.debug(`Skipping duplicate document message: ${messageId}`);
        return false;
    }

    // Mark as processed IMMEDIATELY to prevent race conditions
    deduplication.markProcessed(messageId);

    try {
        // Download the media
        const media = await message.downloadMedia();
        if (!media || !media.data) {
            logger.warn(`Failed to download media from message: ${messageId}`);
            return false;
        }

        const filename = media.filename || `document_${Date.now()}`;
        const mimetype = media.mimetype || 'application/octet-stream';
        const buffer = Buffer.from(media.data, 'base64');

        // Check if file can be uploaded
        const uploadCheck = canUpload(buffer.length, filename);
        if (!uploadCheck.canUpload) {
            logger.warn(`Cannot upload ${filename}: ${uploadCheck.reason}`);
            // Error logged above, no reaction to avoid confusing users
            return false;
        }

        // Upload to Catbox.moe
        const uploadResult = await uploadDocument(buffer, filename, mimetype);
        if (!uploadResult.success) {
            logger.error(`Upload failed for ${filename}: ${uploadResult.error}`);
            // Error logged above, no reaction to avoid confusing users
            return false;
        }

        // Extract metadata using LLM or use filename
        const body = message.body || '';
        const extracted = await extractDocumentMetadata(body, filename);

        await sheetsOperations.appendLink({
            title: extracted.title || filename,
            type: extracted.type || 'Document',
            keywords: extracted.keywords || '',
            url: uploadResult.url,
            messageId
        });

        // React with ☕ emoji to confirm archiving
        await message.react('☕');

        logger.info(`Archived document: "${filename}" -> ${uploadResult.url}`);
        return true;
    } catch (error) {
        logger.error(`Failed to process document: ${error.message}`);
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

        // Check for document attachments
        if (message.hasMedia && message.type === 'document') {
            logger.debug(`Processing document from group "${chat.name}"`);
            await processDocumentMessage(message);
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
    processDocumentMessage,
    handleMessage,
    handleCommand,
    setupMessageListener
};
