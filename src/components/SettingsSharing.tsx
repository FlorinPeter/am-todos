import React, { useState, useEffect } from 'react';
import { loadSettings, encodeSettingsToUrl } from '../utils/localStorage';
import QRCode from 'qrcode';
import logger from '../utils/logger';

interface SettingsSharingProps {
  isVisible: boolean;
  onClose: () => void;
}

const SettingsSharing: React.FC<SettingsSharingProps> = ({ isVisible, onClose }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (isVisible) {
      generateShareUrl();
    }
  }, [isVisible]);

  const generateShareUrl = async () => {
    setIsGenerating(true);
    try {
      const settings = loadSettings();
      if (!settings) {
        logger.error('No settings found to share');
        return;
      }

      const url = encodeSettingsToUrl(settings);
      setShareUrl(url);

      // Generate QR code with optimized settings for smaller data
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 1,
        errorCorrectionLevel: 'L', // Low error correction for smaller QR code
        type: 'image/png',
        quality: 0.92,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      logger.error('Error generating share URL:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        showCopyFeedback();
        return;
      }
      
      // Fallback for mobile/older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        showCopyFeedback();
      } catch (fallbackError) {
        logger.error('Fallback copy failed:', fallbackError);
        // For mobile, try to select the text for manual copy
        selectUrlText();
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error);
      // Last resort: select the URL text for manual copy
      selectUrlText();
    }
  };

  const showCopyFeedback = () => {
    setCopySuccess(true);
    setShowFeedback(true);
    
    // Haptic feedback for mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    // Reset feedback after delay
    setTimeout(() => {
      setCopySuccess(false);
      setShowFeedback(false);
    }, 2500);
  };

  const selectUrlText = () => {
    // Find the URL input and select its text for manual copy
    const urlInput = document.querySelector('input[readonly]') as HTMLInputElement;
    if (urlInput) {
      urlInput.focus();
      urlInput.select();
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      data-testid="modal-overlay" 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        role="dialog"
        className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Share Configuration</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <p className="text-gray-300 mb-6">
            Share your configuration settings with another device or browser. The settings include your Git provider credentials (GitHub/GitLab), repository details, and AI API keys.
          </p>

          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-blue-400">Generating configuration...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="text-center">
                <h3 className="text-lg font-medium text-white mb-3">Scan QR Code</h3>
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Configuration QR Code" 
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Scan with your mobile device to automatically configure the app
                </p>
              </div>

              {/* Share URL */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Configuration Link</h3>
                <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-md text-sm font-mono text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={copyToClipboard}
                    className={`px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 min-w-[100px] ${
                      copySuccess
                        ? 'bg-green-600 text-white scale-105 shadow-lg'
                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    } touch-manipulation`}
                  >
                    {copySuccess ? (
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Feedback Toast */}
                {showFeedback && (
                  <div className="mt-3 p-3 bg-green-900/50 border border-green-600 rounded-md animate-pulse">
                    <div className="flex items-center text-green-300">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">
                        {copySuccess ? 'Link copied to clipboard!' : 'Text selected - use Ctrl+C (Cmd+C on Mac) to copy'}
                      </span>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-gray-400 mt-2">
                  Copy this link to share via email, chat, or other apps
                </p>
              </div>

              {/* Security Notice */}
              <div className="bg-yellow-900/50 border border-yellow-600 rounded-md p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-300">Security Notice</h3>
                    <p className="text-sm text-yellow-200 mt-1">
                      This configuration contains sensitive API keys and tokens. Only share with trusted devices and ensure secure transmission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSharing;