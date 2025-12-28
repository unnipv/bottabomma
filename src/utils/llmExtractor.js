/**
 * LLM-powered extraction for better title, type, and keywords
 * Uses Groq API (free tier) for fast inference
 */

const logger = require('./logger');
const { extractTitle, inferType, extractKeywords } = require('./linkExtractor');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Extract title, type, and keywords using Groq LLM
 * Falls back to basic extraction if API fails or not configured
 * @param {string} messageText - The WhatsApp message text
 * @param {string} url - The URL found in the message
 * @returns {Promise<{title: string, type: string, keywords: string}>}
 */
async function extractWithLLM(messageText, url) {
    const apiKey = process.env.GROQ_API_KEY;

    // Fall back to basic extraction if no API key
    if (!apiKey) {
        logger.debug('No GROQ_API_KEY set, using basic extraction');
        return basicExtraction(messageText, url);
    }

    try {
        const prompt = `Analyze this WhatsApp message sharing a link and extract structured information.

Message: "${messageText}"
URL: ${url}

Extract:
1. TITLE: A clean, descriptive title for this content (not the raw message, but a proper title)
2. TYPE: Must be exactly one of: Podcast, Letter, Website, Video, Movie, Reddit Thread, Twitter Thread, Book (Fiction), Article, Journal, Song, Poem, Book (Non-fiction), Newsletter, Event, Miscellaneous
3. KEYWORDS: 3-6 relevant keywords/topics, comma-separated

Respond in this exact JSON format only, no other text:
{"title": "...", "type": "...", "keywords": "..."}`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            logger.debug(`LLM extracted: ${parsed.title} [${parsed.type}]`);
            return {
                title: parsed.title || basicExtraction(messageText, url).title,
                type: parsed.type || inferType(url),
                keywords: parsed.keywords || ''
            };
        }

        throw new Error('Could not parse LLM response');
    } catch (error) {
        logger.warn(`LLM extraction failed, falling back to basic: ${error.message}`);
        return basicExtraction(messageText, url);
    }
}

/**
 * Basic extraction fallback (no LLM)
 */
function basicExtraction(messageText, url) {
    return {
        title: extractTitle(messageText) || url,
        type: inferType(url),
        keywords: extractKeywords(messageText, url)
    };
}

/**
 * Extract metadata for documents using LLM
 * Falls back to filename-based extraction if LLM not available
 * @param {string} messageText - The WhatsApp message text accompanying the document
 * @param {string} filename - Original filename of the document
 * @returns {Promise<{title: string, type: string, keywords: string}>}
 */
async function extractDocumentMetadata(messageText, filename) {
    const apiKey = process.env.GROQ_API_KEY;

    // Fall back to basic extraction if no API key
    if (!apiKey) {
        logger.debug('No GROQ_API_KEY set, using basic document extraction');
        return basicDocumentExtraction(messageText, filename);
    }

    try {
        const prompt = `Analyze this WhatsApp message sharing a document and extract structured information.

Message: "${messageText}"
Filename: ${filename}

Extract:
1. TITLE: A clean, descriptive title for this document (improve on the filename if possible)
2. TYPE: Must be exactly one of: PDF, Spreadsheet, Presentation, Document, Image, Audio, Video, Archive, Ebook, Miscellaneous
3. KEYWORDS: 3-6 relevant keywords/topics, comma-separated

Respond in this exact JSON format only, no other text:
{"title": "...", "type": "...", "keywords": "..."}`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            logger.debug(`LLM extracted document: ${parsed.title} [${parsed.type}]`);
            return {
                title: parsed.title || filename,
                type: parsed.type || inferDocumentType(filename),
                keywords: parsed.keywords || ''
            };
        }

        throw new Error('Could not parse LLM response');
    } catch (error) {
        logger.warn(`LLM document extraction failed, falling back to basic: ${error.message}`);
        return basicDocumentExtraction(messageText, filename);
    }
}

/**
 * Basic document extraction fallback (no LLM)
 */
function basicDocumentExtraction(messageText, filename) {
    return {
        title: messageText?.trim() || filename,
        type: inferDocumentType(filename),
        keywords: ''
    };
}

/**
 * Infer document type from filename extension
 */
function inferDocumentType(filename) {
    const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1] || '';

    const typeMap = {
        'pdf': 'PDF',
        'doc': 'Document', 'docx': 'Document', 'odt': 'Document', 'rtf': 'Document',
        'xls': 'Spreadsheet', 'xlsx': 'Spreadsheet', 'csv': 'Spreadsheet', 'ods': 'Spreadsheet',
        'ppt': 'Presentation', 'pptx': 'Presentation', 'odp': 'Presentation',
        'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'webp': 'Image',
        'mp3': 'Audio', 'wav': 'Audio', 'ogg': 'Audio', 'm4a': 'Audio',
        'mp4': 'Video', 'avi': 'Video', 'mkv': 'Video', 'mov': 'Video',
        'zip': 'Archive', 'rar': 'Archive', '7z': 'Archive', 'tar': 'Archive', 'gz': 'Archive',
        'epub': 'Ebook', 'mobi': 'Ebook', 'azw': 'Ebook'
    };

    return typeMap[ext] || 'Document';
}

module.exports = {
    extractWithLLM,
    extractDocumentMetadata,
    basicExtraction
};
