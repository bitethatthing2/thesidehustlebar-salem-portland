'use client';

import { WolfpackProfileManager } from '@/components/wolfpack/WolfpackProfileManager';

export default function EditProfilePage() {
  return (
    <div className="main-content">
      <div className="container mx-auto px-4 py-3 sm:py-4 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Edit Profile</h1>
        <WolfpackProfileManager />
      </div>
    </div>
  );
}