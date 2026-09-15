/**
 * Notifications API Manager
 * Handles fetching notifications and announcements from server safely
 */

window.NotificationsAPI = {
    /**
     * Fetch notifications and announcements
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>}
     */
    async fetchContent(options = {}) {
        const config = window.NotificationsConfig?.api || {};
        const baseURL = typeof config.baseURL === 'function' ? config.baseURL() : (config.baseURL || 'https://bh.shabakaty.site');
        const endpoint = config.endpoint || '/api/v1/public/content';

        // Build URL with query parameters
        const params = new URLSearchParams();

        // Add user_token if available (from LoyaltyStorage)
        if (options.userToken) {
            params.append('user_token', options.userToken);
        } else if (window.LoyaltyStorage?.get) {
            const userData = window.LoyaltyStorage.get();
            if (userData?.token) {
                params.append('user_token', userData.token);
            }
        }

        // Add other parameters
        if (options.includeNotifications !== undefined) {
            params.append('include_notifications', options.includeNotifications);
        }
        if (options.includeAnnouncements !== undefined) {
            params.append('include_announcements', options.includeAnnouncements);
        }
        if (options.notificationsLimit) {
            params.append('notifications_limit', options.notificationsLimit);
        }
        if (options.announcementsPosition) {
            params.append('announcements_position', options.announcementsPosition);
        }

        const url = `${baseURL}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;

        if (window.NotificationsConfig?.debug) {
            console.log('[NotificationsAPI] Fetching from:', url);
        }

        try {
            const response = await this._fetchWithTimeout(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }, config.timeout || 10000);

            if (!response.ok) {
                return {
                    success: true,
                    data: { notifications: [], announcements: [] }
                };
            }

            const contentType = response.headers.get('content-type') || '';
            let data = null;
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                try {
                    data = JSON.parse(text);
                } catch {
                    // Non-JSON response (e.g. HTML fallback on static host or hotspot), return safe empty structure
                    data = { notifications: [], announcements: [] };
                }
            }

            if (window.NotificationsConfig?.debug) {
                console.log('[NotificationsAPI] Received:', data);
            }

            return {
                success: true,
                data: data || { notifications: [], announcements: [] }
            };

        } catch (error) {
            // Gracefully handle abort or network errors without spamming console.error
            if (window.NotificationsConfig?.debug) {
                console.warn('[NotificationsAPI] Fetch warning/error:', error.name === 'AbortError' ? 'Request timed out or aborted' : error.message);
            }

            return {
                success: true,
                data: { notifications: [], announcements: [] }
            };
        }
    },

    /**
     * Fetch with timeout using AbortSignal.timeout when available
     * @private
     */
    async _fetchWithTimeout(url, options, timeout = 10000) {
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            try {
                return await fetch(url, {
                    ...options,
                    signal: AbortSignal.timeout(timeout)
                });
            } catch (err) {
                throw err;
            }
        }

        const controller = new AbortController();
        let isTimedOut = false;
        const timeoutId = setTimeout(() => {
            isTimedOut = true;
            try {
                controller.abort('timeout');
            } catch (e) {
                controller.abort();
            }
        }, timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (isTimedOut || error.name === 'AbortError') {
                const timeoutErr = new Error('Request timed out');
                timeoutErr.name = 'AbortError';
                throw timeoutErr;
            }
            throw error;
        }
    },

    /**
     * Delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.NotificationsAPI;
}
