'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then((reg) => console.log('✅ Service worker registered:', reg))
          .catch((err) => console.error('❌ Service worker failed:', err));
      });
    }
  }, []);
  return null;
}
