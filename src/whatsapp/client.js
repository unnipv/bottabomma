/**
 * WhatsApp Web client setup and initialization
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../../config/default');
const logger = require('../utils/logger');

let client = null;

/**
 * Create and configure the WhatsApp Web client
 * @returns {Client} Configured WhatsApp client
 */
function createClient() {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: config.whatsapp.sessionPath
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    // QR code event - display for authentication
    client.on('qr', (qr) => {
        logger.info('QR Code received. Scan with your phone:');
        console.log('\n');
        qrcode.generate(qr, { small: true });
        console.log('\n');
        logger.info('Open WhatsApp on your phone > Settings > Linked Devices > Link a Device');
    });

    // Authentication successful
    client.on('authenticated', () => {
        logger.info('WhatsApp authentication successful');
    });

    // Authentication failure
    client.on('auth_failure', (msg) => {
        logger.error(`WhatsApp authentication failed: ${msg}`);
        logger.info('Try deleting the .wwebjs_auth folder and restarting');
    });

    // Disconnection
    client.on('disconnected', (reason) => {
        logger.warn(`WhatsApp client disconnected: ${reason}`);
        logger.info('Attempting to reconnect...');
    });

    return client;
}

/**
 * Get the WhatsApp client instance
 * @returns {Client} WhatsApp client
 */
function getClient() {
    if (!client) {
        throw new Error('WhatsApp client not created. Call createClient() first.');
    }
    return client;
}

/**
 * Initialize the client (connect to WhatsApp)
 * @returns {Promise<void>}
 */
async function initialize() {
    if (!client) {
        createClient();
    }

    logger.info('Initializing WhatsApp client...');
    await client.initialize();
}

/**
 * List all groups the bot is part of (helpful for finding group ID)
 */
async function listGroups() {
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    logger.info('Available groups:');
    groups.forEach(group => {
        logger.info(`  - "${group.name}" (ID: ${group.id._serialized})`);
    });

    return groups;
}

/**
 * Get the target group chat
 * @returns {Promise<Chat|null>} Target group chat or null
 */
async function getTargetGroup() {
    const targetId = config.whatsapp.targetGroupId;

    if (!targetId) {
        logger.warn('No target group ID configured. Set TARGET_GROUP_ID in .env');
        await listGroups();
        return null;
    }

    try {
        const chat = await client.getChatById(targetId);
        if (chat && chat.isGroup) {
            logger.info(`Found target group: "${chat.name}"`);
            return chat;
        }
        logger.error(`Chat with ID ${targetId} is not a group`);
        return null;
    } catch (error) {
        logger.error(`Failed to find target group: ${error.message}`);
        await listGroups();
        return null;
    }
}

module.exports = {
    createClient,
    getClient,
    initialize,
    listGroups,
    getTargetGroup
};
