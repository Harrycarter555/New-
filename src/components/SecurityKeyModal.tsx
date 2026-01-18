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
    // Termux-compatible copy method
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(securityKey)
        .then(() => showToast('Security key copied!', 'success'))
        .catch(() => {
          // Fallback method for Termux
          const textArea = document.createElement('textarea');
          textArea.value = securityKey;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showToast('Security key copied!', 'success');
        });
    } else {
      // Old school method
      const textArea = document.createElement('textarea');
      textArea.value = securityKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Security key copied!', 'success');
    }
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
              📱 <strong>Termux users:</strong> Long press to select, then copy
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onClose}
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
