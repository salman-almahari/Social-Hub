'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

interface ProfilePictureUploadProps {
  currentAvatarUrl?: string;
  onAvatarUpdate: (newAvatarUrl: string) => void;
  isEditing: boolean;
}

export default function ProfilePictureUpload({ currentAvatarUrl, onAvatarUpdate, isEditing }: ProfilePictureUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - accept any image format
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('http://localhost:8080/upload-avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onAvatarUpdate(data.avatar_url);
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      setPreviewUrl(currentAvatarUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-32 h-32">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Profile picture"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px' }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image</span>
          </div>
        )}
      </div>

      {isEditing && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isUploading ? 'Uploading...' : 'Change Picture'}
          </button>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </>
      )}
    </div>
  );
} 