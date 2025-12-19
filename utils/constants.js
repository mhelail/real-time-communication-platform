/**
 * Application constants
 * Centralized configuration values
 */

module.exports = {
  // Call timeout (30 seconds)
  CALL_TIMEOUT: 30000,

  // JWT expiration
  JWT_EXPIRATION: '24h',

  // Message status
  MESSAGE_STATUS: {
    DELIVERED: 'delivered',
    SEEN: 'seen',
    UNREAD: 'unread'
  },

  // Call status
  CALL_STATUS: {
    ANSWERED: 'answered',
    MISSED: 'missed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
  },

  // Conversation types
  CONVERSATION_TYPE: {
    PRIVATE: 'private',
    GROUP: 'group'
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100
};

