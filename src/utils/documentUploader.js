/**
 * Document uploader utility using Catbox.moe for permanent file hosting
 * API docs: https://catbox.moe/tools.php
 */

const logger = require('./logger');

const CATBOX_API_URL = 'https://catbox.moe/user/api.php';

// Maximum file size allowed by Catbox (200 MB)
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// Blacklisted file extensions on Catbox
const BLACKLISTED_EXTENSIONS = ['.exe', '.scr', '.cpl', '.doc', '.docx', '.jar'];

/**
 * Upload a document to Catbox.moe
 * @param {Buffer} buffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadDocument(buffer, filename, mimetype) {
    try {
        // Check file size
        if (buffer.length > MAX_FILE_SIZE) {
            logger.warn(`File too large: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
            return {
                success: false,
                error: `File exceeds 200 MB limit`
            };
        }

        // Check for blacklisted extensions
        const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
        if (BLACKLISTED_EXTENSIONS.includes(ext)) {
            logger.warn(`Blacklisted file type: ${filename}`);
            return {
                success: false,
                error: `File type ${ext} is not allowed`
            };
        }

        // Create FormData for multipart upload
        const FormData = (await import('form-data')).default;
        const form = new FormData();

        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, {
            filename: filename,
            contentType: mimetype
        });

        // Optional: use userhash for managing uploads later
        const userhash = process.env.CATBOX_USERHASH;
        if (userhash) {
            form.append('userhash', userhash);
        }

        logger.debug(`Uploading ${filename} to Catbox.moe...`);

        const response = await fetch(CATBOX_API_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Catbox API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.text();

        // Catbox returns the URL directly as plain text on success
        // On error, it returns an error message
        if (result.startsWith('https://')) {
            logger.info(`Uploaded ${filename} -> ${result}`);
            return {
                success: true,
                url: result.trim()
            };
        } else {
            throw new Error(result || 'Unknown upload error');
        }
    } catch (error) {
        logger.error(`Failed to upload ${filename}: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check if a file can be uploaded (size and extension checks)
 * @param {number} size - File size in bytes
 * @param {string} filename - Original filename
 * @returns {{canUpload: boolean, reason?: string}}
 */
function canUpload(size, filename) {
    if (size > MAX_FILE_SIZE) {
        return {
            canUpload: false,
            reason: `File exceeds 200 MB limit (${(size / 1024 / 1024).toFixed(2)} MB)`
        };
    }

    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    if (BLACKLISTED_EXTENSIONS.includes(ext)) {
        return {
            canUpload: false,
            reason: `File type ${ext} is not allowed by Catbox.moe`
        };
    }

    return { canUpload: true };
}

module.exports = {
    uploadDocument,
    canUpload,
    MAX_FILE_SIZE,
    BLACKLISTED_EXTENSIONS
};
