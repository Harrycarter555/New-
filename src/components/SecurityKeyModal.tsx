
import React from 'react';

interface SecurityKeyModalProps {
  securityKey: string;
  onClose: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const SecurityKeyModal: React.FC<SecurityKeyModalProps> = ({
  securityKey,
  onClose,
  showToast
}) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(securityKey);
    showToast('Security key copied to clipboard!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-slate-800 w-full max-w-md rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-black/50">
          <h3 className="text-xl font-bold text-white">⚠️ IMPORTANT: Save Your Security Key!</h3>
          <p className="text-sm text-slate-400 mt-1">
            This key is required for account recovery. Save it securely!
          </p>
        </div>

        <div className="p-6">
          {/* Security Key Display */}
          <div className="mb-4">
            <div className="bg-black/50 border-2 border-amber-500/30 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-amber-400">SECURITY KEY</span>
                <button
                  onClick={copyToClipboard}
                  className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg hover:bg-amber-500/30"
                >
                  📋 Copy
                </button>
              </div>
              <p className="text-lg font-mono text-white text-center tracking-wider break-all">
                {securityKey}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Copy and save this key in a secure place (password manager, notes, etc.)
            </p>
          </div>

          {/* Warning Message */}
          <div className="mb-6 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-xs text-red-300 font-bold mb-1">⚠️ WARNING:</p>
            <ul className="text-xs text-red-400 list-disc list-inside space-y-1">
              <li>This key cannot be recovered if lost</li>
              <li>Without this key, you cannot recover your account</li>
              <li>Do not share this key with anyone</li>
              <li>Admin cannot recover your account without this key</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                onClose();
                showToast('Remember to save your security key!', 'info');
              }}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold py-3 rounded-lg hover:opacity-90"
            >
              ✅ I have saved my security key
            </button>

            <button
              onClick={copyToClipboard}
              className="w-full bg-amber-500/10 text-amber-400 font-bold py-3 rounded-lg border border-amber-500/20 hover:bg-amber-500/20"
            >
              📋 Copy Key Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityKeyModal;
