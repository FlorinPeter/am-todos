// Rate limit handling utility for user-friendly messaging
import logger from './logger';

export interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfter?: string;
  nextAvailableTime?: Date;
  provider: 'github' | 'gitlab';
}

// Parse rate limit information from error responses
export const parseRateLimitError = (error: any, provider: 'github' | 'gitlab'): RateLimitInfo => {
  const errorMessage = error.message?.toLowerCase() || '';
  
  // Check if this is a rate limit error
  const isRateLimited = errorMessage.includes('429') || 
                       errorMessage.includes('too many requests') ||
                       errorMessage.includes('rate limit');
  
  if (!isRateLimited) {
    return { isRateLimited: false, provider };
  }
  
  let retryAfter: string | undefined;
  let nextAvailableTime: Date | undefined;
  
  // Try to extract retry-after information
  if (errorMessage.includes('15 minutes')) {
    retryAfter = '15 minutes';
    nextAvailableTime = new Date(Date.now() + 15 * 60 * 1000);
  } else if (errorMessage.includes('retry after')) {
    // Try to parse retry-after from the message
    const match = errorMessage.match(/retry after[:\s]*(\d+\s*\w+)/);
    if (match) {
      retryAfter = match[1];
    }
  }
  
  logger.log('Rate limit detected:', { provider, retryAfter, nextAvailableTime });
  
  return {
    isRateLimited: true,
    retryAfter,
    nextAvailableTime,
    provider
  };
};

// Generate user-friendly rate limit message
export const generateRateLimitMessage = (rateLimitInfo: RateLimitInfo): string => {
  const { provider, retryAfter, nextAvailableTime } = rateLimitInfo;
  const providerName = provider === 'github' ? 'GitHub' : 'GitLab';
  
  let message = `🚧 ${providerName} Rate Limit Reached\n\n`;
  message += `You've hit the ${providerName} API rate limit. This happens when too many requests are made in a short period.\n\n`;
  
  if (retryAfter) {
    message += `⏰ Try again in: ${retryAfter}\n`;
  }
  
  if (nextAvailableTime) {
    message += `🕐 Available again at: ${nextAvailableTime.toLocaleTimeString()}\n`;
  }
  
  message += `\n💡 Tips to avoid rate limits:\n`;
  message += `• Avoid refreshing the page repeatedly\n`;
  message += `• Close other tabs using the same ${providerName} account\n`;
  message += `• Wait a few minutes before trying again\n`;
  message += `\nThe app will work normally once the rate limit resets.`;
  
  return message;
};

// Show rate limit notification (can be enhanced with UI components later)
export const showRateLimitNotification = (rateLimitInfo: RateLimitInfo) => {
  const message = generateRateLimitMessage(rateLimitInfo);
  
  // For now, use console.warn and alert
  // In a real implementation, this would show a proper UI notification
  logger.error('Rate limit notification:', message);
  
  // Show user-friendly alert
  if (typeof window !== 'undefined' && window.alert) {
    window.alert(message);
  }
};