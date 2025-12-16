/**
 * Deduplication manager using WhatsApp Message IDs
 */

const logger = require('./logger');

class DeduplicationManager {
    constructor() {
        // In-memory cache of processed message IDs
        this.processedIds = new Set();
    }

    /**
     * Initialize the deduplication cache with existing message IDs from the sheet
     * @param {string[]} existingIds - Array of message IDs already in the sheet
     */
    initialize(existingIds) {
        this.processedIds = new Set(existingIds);
        logger.info(`Deduplication cache initialized with ${this.processedIds.size} existing entries`);
    }

    /**
     * Check if a message has already been processed
     * @param {string} messageId - WhatsApp message ID
     * @returns {boolean} True if already processed
     */
    isDuplicate(messageId) {
        return this.processedIds.has(messageId);
    }

    /**
     * Mark a message as processed
     * @param {string} messageId - WhatsApp message ID
     */
    markProcessed(messageId) {
        this.processedIds.add(messageId);
    }

    /**
     * Get current cache size
     * @returns {number} Number of cached IDs
     */
    getCacheSize() {
        return this.processedIds.size;
    }
}

// Singleton instance
const deduplicationManager = new DeduplicationManager();

module.exports = deduplicationManager;
