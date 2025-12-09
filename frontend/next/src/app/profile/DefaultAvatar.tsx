import React from 'react';

interface DefaultAvatarProps {
  className?: string;
}

export function DefaultAvatar({ className = "w-24 h-24" }: DefaultAvatarProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="12" fill="#E5E7EB" />
      <path
        d="M12 13.5C14.0711 13.5 15.75 11.8211 15.75 9.75C15.75 7.67893 14.0711 6 12 6C9.92893 6 8.25 7.67893 8.25 9.75C8.25 11.8211 9.92893 13.5 12 13.5Z"
        fill="#9CA3AF"
      />
      <path
        d="M12 15C7.58172 15 4 18.5817 4 23H20C20 18.5817 16.4183 15 12 15Z"
        fill="#9CA3AF"
      />
    </svg>
  );
} 