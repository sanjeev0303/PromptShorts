import { initializeWorker } from '@/lib/queue';

// Initialize worker on server start
if (typeof window === 'undefined') {
  console.log('🚀 Initializing video processing worker...');

  try {
    initializeWorker();
    console.log('✅ Video processing worker initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize video processing worker:', error);
  }
}

export {};
