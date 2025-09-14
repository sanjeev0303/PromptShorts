#!/usr/bin/env node
import 'dotenv/config';
import { VideoProcessingWorker } from './lib/video-worker';

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

console.log('🚀 Starting AI Shorts Video Processing Worker...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 Redis URL:', process.env.REDIS_URL?.replace(/:[^:@]+@/, ':****@'));
console.log('🎬 Concurrency:', process.env.NODE_ENV === 'production' ? 4 : 2);

let worker: VideoProcessingWorker;

async function startWorker() {
    try {
        worker = new VideoProcessingWorker();
        console.log('✅ Video Processing Worker started successfully');
        console.log('🎬 Ready to process video jobs...');
    } catch (error) {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    }
}

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
    console.log(`📨 Received ${signal}, shutting down gracefully...`);

    if (worker) {
        await worker.shutdown();
    }

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the worker
startWorker();
