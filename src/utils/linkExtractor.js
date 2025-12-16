/**
 * Extracts URLs and metadata from WhatsApp message text
 */

// URL regex pattern - matches http, https, and www URLs
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Extract all URLs from a message body
 * @param {string} text - Message text
 * @returns {string[]} Array of URLs found
 */
function extractUrls(text) {
    if (!text) return [];

    const matches = text.match(URL_REGEX) || [];

    // Clean up URLs - remove trailing punctuation that might be captured
    return matches.map(url => {
        // Remove trailing punctuation
        url = url.replace(/[.,;:!?)]+$/, '');
        // Ensure https prefix for www URLs
        if (url.startsWith('www.')) {
            url = 'https://' + url;
        }
        return url;
    });
}

/**
 * Extract text content (title/description) from message, excluding URLs
 * @param {string} text - Message text
 * @returns {string} Cleaned title text
 */
function extractTitle(text) {
    if (!text) return '';

    // Remove URLs from text
    let title = text.replace(URL_REGEX, '').trim();

    // Clean up excessive whitespace
    title = title.replace(/\s+/g, ' ').trim();

    // Remove common prefixes like "Check this out:", "Link:", etc.
    title = title.replace(/^(check\s*(this\s*)?out|link|here|see|watch|read|article|video)[:;\s-]*/i, '');

    // Limit length
    if (title.length > 200) {
        title = title.substring(0, 200) + '...';
    }

    return title.trim();
}

/**
 * Determine content type based on URL domain and path
 * @param {string} url - The URL to analyze
 * @returns {string} Content type (Article, Video, Podcast, etc.)
 */
function inferType(url) {
    if (!url) return 'Link';

    const lowerUrl = url.toLowerCase();

    // Domain-based type mapping
    const typePatterns = [
        // Video platforms
        { patterns: ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com'], type: 'Video' },

        // Podcast platforms
        { patterns: ['spotify.com/episode', 'podcasts.apple.com', 'anchor.fm', 'soundcloud.com', 'pocketcasts.com', 'overcast.fm', 'castbox.fm'], type: 'Podcast' },

        // Social/Twitter threads
        { patterns: ['twitter.com', 'x.com', 'nitter.net'], type: 'Twitter Thread' },

        // Reddit
        { patterns: ['reddit.com', 'redd.it'], type: 'Reddit Post' },

        // News sources
        { patterns: ['nytimes.com', 'washingtonpost.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'cnn.com', 'newyorker.com'], type: 'Article' },

        // Academic/Research
        { patterns: ['arxiv.org', 'scholar.google', 'researchgate.net', 'academia.edu', 'doi.org', 'ncbi.nlm.nih.gov', 'nature.com', 'sciencedirect.com'], type: 'Journal' },

        // Books
        { patterns: ['goodreads.com', 'amazon.com/dp', 'amazon.com/gp/product'], type: 'Book' },

        // GitHub
        { patterns: ['github.com', 'gitlab.com', 'bitbucket.org'], type: 'Repository' },

        // Wikipedia 
        { patterns: ['wikipedia.org'], type: 'Wikipedia' },

        // Medium/Blogs
        { patterns: ['medium.com', 'substack.com', 'dev.to', 'hashnode.dev'], type: 'Blog Post' },

        // LinkedIn
        { patterns: ['linkedin.com'], type: 'LinkedIn Post' }
    ];

    for (const { patterns, type } of typePatterns) {
        if (patterns.some(pattern => lowerUrl.includes(pattern))) {
            return type;
        }
    }

    // Default fallback based on common path patterns
    if (lowerUrl.includes('/article') || lowerUrl.includes('/blog') || lowerUrl.includes('/post')) {
        return 'Article';
    }
    if (lowerUrl.includes('/video') || lowerUrl.includes('/watch')) {
        return 'Video';
    }
    if (lowerUrl.includes('/podcast') || lowerUrl.includes('/episode')) {
        return 'Podcast';
    }

    return 'Article'; // Default type
}

/**
 * Extract potential keywords from message text
 * Uses simple NLP-like approach: extract significant words, hashtags, etc.
 * @param {string} text - Message text  
 * @param {string} url - URL (used to exclude domain words)
 * @returns {string} Comma-separated keywords
 */
function extractKeywords(text, url = '') {
    if (!text) return '';

    // Remove URLs from text first
    let cleanText = text.replace(URL_REGEX, ' ');

    // Extract hashtags first (they're explicit keywords)
    const hashtags = cleanText.match(/#\w+/g) || [];
    const hashtagWords = hashtags.map(tag => tag.replace('#', '').toLowerCase());

    // Remove hashtags and clean text
    cleanText = cleanText.replace(/#\w+/g, ' ');

    // Common stop words to filter out
    const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
        'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they',
        'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
        'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own',
        'same', 'so', 'than', 'too', 'very', 'just', 'can', 'about', 'into', 'through',
        'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
        'under', 'again', 'further', 'then', 'once', 'here', 'there', 'also', 'new', 'one',
        'check', 'out', 'link', 'read', 'watch', 'see', 'click', 'http', 'https', 'www', 'com'
    ]);

    // Extract words (at least 3 characters, alphabetic)
    const words = cleanText
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 3 && !stopWords.has(word));

    // Combine hashtag words and extracted words, remove duplicates
    const allKeywords = [...new Set([...hashtagWords, ...words])];

    // Take top 5-7 keywords (prioritize shorter list for cleanliness)
    const finalKeywords = allKeywords.slice(0, 6);

    return finalKeywords.join(', ');
}

/**
 * Check if a message contains any URLs
 * @param {string} text - Message text
 * @returns {boolean} True if message contains URLs
 */
function hasLinks(text) {
    return extractUrls(text).length > 0;
}

module.exports = {
    extractUrls,
    extractTitle,
    inferType,
    extractKeywords,
    hasLinks
};
