/**
 * WhatsApp Link Archiver Bot
 * Archives links from a WhatsApp group to Google Sheets
 */

const config = require('../config/default');
const logger = require('./utils/logger');
const sheetsClient = require('./sheets/client');
const sheetsOperations = require('./sheets/operations');
const whatsappClient = require('./whatsapp/client');
const { setupMessageListener } = require('./whatsapp/handlers');
const catchupManager = require('./catchup/syncManager');

/**
 * Main application entry point
 */
async function main() {
    logger.info('===========================================');
    logger.info('  Bottabomma is warming up...  ');
    logger.info('===========================================');

    try {
        // Step 1: Initialize Google Sheets
        logger.info('Connecting to Google Sheets...');
        await sheetsClient.initialize();
        await sheetsOperations.ensureHeaders();

        // Step 2: Create and initialize WhatsApp client
        const client = whatsappClient.createClient();

        // Step 3: Set up 'ready' event handler
        client.on('ready', async () => {
            logger.info('WhatsApp client is ready!');

            try {
                // Get target group
                const targetGroup = await whatsappClient.getTargetGroup();

                if (!targetGroup) {
                    logger.error('No target group found. Please configure TARGET_GROUP_ID in .env');
                    logger.info('Available groups have been listed above.');
                    return;
                }

                // Initialize catch-up sync (loads dedup cache + syncs missed messages)
                await catchupManager.initialize(targetGroup);

                // Set up message listener for new messages
                setupMessageListener(client, targetGroup.id._serialized);

                logger.info('===========================================');
                logger.info('  Bot is now monitoring for new links!    ');
                logger.info(`  Group: "${targetGroup.name}"            `);
                logger.info('===========================================');
            } catch (error) {
                logger.error(`Initialization error: ${error.message}`);
            }
        });

        // Step 4: Initialize WhatsApp (triggers QR code if needed)
        await whatsappClient.initialize();

    } catch (error) {
        logger.error(`Fatal error: ${error.message}`);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});

// Start the bot
main();
