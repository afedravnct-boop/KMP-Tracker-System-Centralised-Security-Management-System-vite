import React, { useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { authFetch } from './api';

export default function BulkNominalRollUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setMessage(null);

    try {
      const res = await authFetch('/api/v1/nominal-roll/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Upload successful!' });
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Upload failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network or server error during upload.' });
    } finally {
      setUploading(false);
      e.target.value = null; // Reset input field
    }
  };

  return (
    <div className="space-y-3">
      <label className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center transition shadow-sm ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading & Processing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" /> Select & Upload Excel File
          </>
        )}
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          onChange={handleFileChange} 
          disabled={uploading} 
          className="hidden" 
        />
      </label>

      {message && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center border ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 text-green-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 mr-2 text-red-600 shrink-0" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}
    </div>
  );
}