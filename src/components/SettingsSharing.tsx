import React, { useState, useEffect } from 'react';
import { loadSettings, encodeSettingsToUrl } from '../utils/localStorage';
import QRCode from 'qrcode';

interface SettingsSharingProps {
  isVisible: boolean;
  onClose: () => void;
}

const SettingsSharing: React.FC<SettingsSharingProps> = ({ isVisible, onClose }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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
        console.error('No settings found to share');
        return;
      }

      const url = encodeSettingsToUrl(settings);
      setShareUrl(url);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating share URL:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Share Configuration</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <p className="text-gray-300 mb-6">
            Share your configuration settings with another device or browser. The settings include your GitHub PAT, repository details, and Gemini API key.
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
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-sm font-mono text-gray-300"
                  />
                  <button
                    onClick={copyToClipboard}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      copySuccess
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Copy this link to share via email, chat, or other apps
                </p>
              </div>

              {/* Security Notice */}
              <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-md p-4">
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