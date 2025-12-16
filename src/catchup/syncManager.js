/**
 * Catch-up sync manager - handles syncing missed messages when bot restarts
 */

const config = require('../../config/default');
const logger = require('../utils/logger');
const { hasLinks } = require('../utils/linkExtractor');
const { processLinkMessage } = require('../whatsapp/handlers');
const deduplication = require('../utils/deduplication');
const sheetsOperations = require('../sheets/operations');

/**
 * Sync missed messages from the target group
 * @param {Chat} targetGroup - The target WhatsApp group chat
 * @returns {Promise<{synced: number, skipped: number}>} Sync statistics
 */
async function syncMissedMessages(targetGroup) {
    const messageCount = config.catchup.messageCount;

    logger.info(`Starting catch-up sync: fetching last ${messageCount} messages...`);

    try {
        // Fetch recent messages from the group
        const messages = await targetGroup.fetchMessages({ limit: messageCount });

        logger.info(`Fetched ${messages.length} messages from "${targetGroup.name}"`);

        let synced = 0;
        let skipped = 0;

        // Process messages in chronological order (oldest first)
        const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);

        for (const message of sortedMessages) {
            // Skip messages without links
            if (!hasLinks(message.body)) {
                continue;
            }

            const messageId = message.id._serialized;

            // Skip already processed messages
            if (deduplication.isDuplicate(messageId)) {
                skipped++;
                continue;
            }

            try {
                const processed = await processLinkMessage(message);
                if (processed) {
                    synced++;
                }
            } catch (error) {
                logger.error(`Failed to sync message ${messageId}: ${error.message}`);
            }
        }

        logger.info(`Catch-up sync complete: ${synced} new links archived, ${skipped} duplicates skipped`);

        return { synced, skipped };
    } catch (error) {
        logger.error(`Catch-up sync failed: ${error.message}`);
        throw error;
    }
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
        throw error;
    }
}

module.exports = {
    syncMissedMessages,
    initialize
};
