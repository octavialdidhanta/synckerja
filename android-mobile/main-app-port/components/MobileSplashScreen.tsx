import React from 'react';

/**
 * Full-screen splash showing the Profitloop logo.
 * Used on mobile when loading toward home (ProtectedRoute / HomeAccessGuard) so the same logo
 * is shown until auth/permission/subscription checks are done.
 */
export const MobileSplashScreen = () => (
  <div
    className="min-h-screen w-full flex items-center justify-center bg-[#f5f5f5] safe-area-inset px-4 pb-10 overflow-visible"
    aria-hidden="true"
  >
    <img
      src="/splash-logo.png"
      alt=""
      className="max-w-[42vw] max-h-[22vh] w-auto h-auto object-contain select-none"
      draggable={false}
    />
  </div>
);
