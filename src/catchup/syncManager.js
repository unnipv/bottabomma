/**
 * Catch-up sync manager - handles syncing missed messages when bot restarts
 */

const { Message } = require('whatsapp-web.js');
const config = require('../../config/default');
const logger = require('../utils/logger');
const { hasLinks } = require('../utils/linkExtractor');
const { processLinkMessage, processDocumentMessage } = require('../whatsapp/handlers');
const deduplication = require('../utils/deduplication');
const sheetsOperations = require('../sheets/operations');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function dedupeMessages(messages) {
    const uniqueMessages = new Map();

    for (const message of messages) {
        const messageId = message?.id?._serialized;
        if (!messageId) {
            continue;
        }

        uniqueMessages.set(messageId, message);
    }

    return Array.from(uniqueMessages.values());
}

async function fetchMessagesFromStore(targetGroup, limit) {
    const rawMessages = await targetGroup.client.pupPage.evaluate(async ({ chatId, limit }) => {
        const normalizeRemote = (value) => {
            if (!value) {
                return null;
            }

            if (typeof value === 'string') {
                return value;
            }

            return value._serialized || null;
        };

        const messages = window.Store.Msg.getModelsArray()
            .filter(message => !message.isNotification)
            .filter(message => normalizeRemote(message.id?.remote) === chatId)
            .sort((a, b) => a.t - b.t);

        if (messages.length > 0) {
            return messages.slice(limit > 0 ? -limit : 0).map(message => window.WWebJS.getMessageModel(message));
        }

        const chat = window.Store.Chat.getModelsArray().find(item => item.id?._serialized === chatId);

        if (!chat) {
            throw new Error(`Unable to find cached messages for chat ${chatId}`);
        }

        const chatMessages = chat.msgs.getModelsArray()
            .filter(message => !message.isNotification)
            .sort((a, b) => a.t - b.t);

        return chatMessages.slice(limit > 0 ? -limit : 0).map(message => window.WWebJS.getMessageModel(message));
    }, { chatId: targetGroup.id._serialized, limit });

    return rawMessages.map(message => new Message(targetGroup.client, message));
}

async function fetchMessagesFromSearch(targetGroup, limit) {
    const queries = ['http', 'www', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    const allMatches = [];

    for (const query of queries) {
        try {
            const matches = await targetGroup.client.searchMessages(query, {
                chatId: targetGroup.id._serialized,
                limit,
                page: 1
            });

            if (matches.length > 0) {
                logger.info(`Search fallback found ${matches.length} candidate messages for query "${query}"`);
                allMatches.push(...matches);
            }
        } catch (error) {
            logger.warn(`Search fallback failed for query "${query}": ${error.message}`);
        }
    }

    return dedupeMessages(allMatches);
}

async function fetchRecentMessages(targetGroup, limit) {
    const MAX_RETRIES = 3;

    try {
        await targetGroup.syncHistory();
    } catch (error) {
        logger.debug(`History sync warm-up skipped: ${error.message}`);
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const delay = attempt * 5000;
            logger.info(`Waiting ${delay / 1000}s for chat to load (attempt ${attempt}/${MAX_RETRIES})...`);
            await sleep(delay);

            return await targetGroup.fetchMessages({ limit });
        } catch (error) {
            logger.warn(`fetchMessages attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
        }
    }

    logger.warn('Falling back to search-based and cached-message catch-up');

    const [cachedMessages, searchedMessages] = await Promise.all([
        fetchMessagesFromStore(targetGroup, limit).catch(error => {
            logger.warn(`Cached message fallback failed: ${error.message}`);
            return [];
        }),
        fetchMessagesFromSearch(targetGroup, limit).catch(error => {
            logger.warn(`Search fallback failed: ${error.message}`);
            return [];
        })
    ]);

    const combinedMessages = dedupeMessages([...cachedMessages, ...searchedMessages])
        .sort((a, b) => a.timestamp - b.timestamp);

    logger.info(`Fallback catch-up collected ${combinedMessages.length} candidate messages`);

    return limit > 0 ? combinedMessages.slice(-limit) : combinedMessages;
}

/**
 * Sync missed messages from the target group
 * @param {Chat} targetGroup - The target WhatsApp group chat
 * @returns {Promise<{synced: number, skipped: number}>} Sync statistics
 */
async function syncMissedMessages(targetGroup) {
    const messageCount = config.catchup.messageCount;

    logger.info(`Starting catch-up sync: fetching last ${messageCount} messages...`);
    const messages = await fetchRecentMessages(targetGroup, messageCount);

    logger.info(`Fetched ${messages.length} messages from "${targetGroup.name}"`);

    let synced = 0;
    let skipped = 0;

    // Process messages in chronological order (oldest first)
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);

    for (const message of sortedMessages) {
        const messageId = message.id._serialized;

        // Skip already processed messages
        if (deduplication.isDuplicate(messageId)) {
            skipped++;
            continue;
        }

        try {
            let processed = false;

            if (message.hasMedia && message.type === 'document') {
                processed = await processDocumentMessage(message);
            } else if (hasLinks(message.body)) {
                processed = await processLinkMessage(message);
            } else {
                continue;
            }

            if (processed) {
                synced++;
            }
        } catch (error) {
            logger.error(`Failed to sync message ${messageId}: ${error.message}`);
        }
    }

    logger.info(`Catch-up sync complete: ${synced} new links archived, ${skipped} duplicates skipped`);

    return { synced, skipped };
}

/**
 * Initialize the catch-up system
 * - Load existing message IDs from sheet
 * - Sync any missed messages
 * @param {Chat} targetGroup - The target WhatsApp group chat
 */
async function initialize(targetGroup) {
    try {
        // Load existing message IDs for deduplication
        const existingIds = await sheetsOperations.getAllMessageIds();
        deduplication.initialize(existingIds);

        // Sync missed messages
        await syncMissedMessages(targetGroup);

        logger.info('Catch-up sync manager initialized');
    } catch (error) {
        logger.error(`Failed to initialize catch-up sync: ${error.message}`);
        logger.warn('Continuing without catch-up sync. New messages will still be monitored.');
    }
}

module.exports = {
    syncMissedMessages,
    initialize
};
