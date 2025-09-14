import { Redis } from 'ioredis'
import { Queue } from "bullmq"

/**
 * Simple Redis connection factory for BullMQ
 * Optimized for standalone worker architecture
 */
export const createRedisConnection = () => {
    const connection = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        keepAlive: 60000,
        connectTimeout: 30000,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        family: 4,
        enableOfflineQueue: false
    })

    connection.on("connect", () => console.log("✅ Redis connected"))
    connection.on("ready", () => console.log("🚀 Redis ready"))
    connection.on("error", (error) => console.error("❌ Redis error:", error.message))

    return connection
}

// Simplified monitoring connection
export const createMonitoringRedisConnection = () => {
    return new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        lazyConnect: true
    })
}

// Single video processing queue
export const videoQueue = new Queue('video-processing', {
    connection: createRedisConnection(),
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 5000
        }
    }
})

// Simple queue health check
export async function getQueueHealth() {
    try {
        const [waiting, active, completed, failed] = await Promise.all([
            videoQueue.getWaiting(),
            videoQueue.getActive(),
            videoQueue.getCompleted(0, 4),
            videoQueue.getFailed(0, 4)
        ])

        return {
            status: 'healthy',
            counts: {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length
            }
        }
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}
