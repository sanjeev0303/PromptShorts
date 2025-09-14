import { Redis } from 'ioredis'
import { Queue, Worker, Job, QueueEvents, FlowProducer } from "bullmq"
import { prisma } from "@/lib/prisma"
import { performanceMonitor } from "./monitoring"
import { processes } from "@/action/processes"

export const createRedisConnection = () => {
    const connection = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null, // Required for BullMQ blocking operations
        enableReadyCheck: false,
        lazyConnect: true,
        keepAlive: 60000,
        connectTimeout: 120000,
        commandTimeout: 30000,
        reconnectOnError: (err) => {
            const targetError = "READONLY";
            return err.message.includes(targetError);
        },
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        family: 4,
        enableOfflineQueue: false
    })

    connection.on("connect", () => {
        console.log("✅ Redis connected successfully");
    })

    connection.on("ready", () => {
        console.log("🚀 Redis is ready");
    })

    connection.on("error", (error) => {
        console.error("❌ Redis connection error:", error.message);
        console.error("Redis error details:", error);
    })

    connection.on("close", () => {
        console.log("🔴 Redis connection closed");
    })

    connection.on("reconnecting", (_ms: number) => {
        console.log("🔄 Redis reconnecting...");
    })

    return connection
}

// Separate Redis connection for monitoring (can have retries)
export const createMonitoringRedisConnection = () => {
    const connection = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 5,
        enableReadyCheck: false,
        lazyConnect: true,
        keepAlive: 60000,
        connectTimeout: 120000,
        commandTimeout: 30000,
        reconnectOnError: (err) => {
            const targetError = "READONLY";
            return err.message.includes(targetError);
        },
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        family: 4,
        enableOfflineQueue: true
    })

    connection.on('error', (err) => {
        console.log("❌ Redis connection error:", err.message);
        if (!err.message.includes('ECONNRESET')) {
            console.error("Redis error details:", err);
        }
    })

    connection.on("ready", () => {
        console.log("🚀 Redis is ready");
    })

    connection.on("close", () => {
        console.log("🔴 Redis connection closed");
    })

    connection.on("reconnecting", () => {
        console.log("🔄 Redis reconnecting...");
    })

    return connection;
}

const connection = createRedisConnection();

export const videoQueue = new Queue('video-processing', {
    connection,
    defaultJobOptions: {
        removeOnComplete: 20, // Keep more completed jobs for monitoring
        removeOnFail: 10,     // Keep more failed jobs for debugging
        attempts: 2,          // Reduced attempts to fail faster
        backoff: {
            type: 'exponential',
            delay: 3000
        },
        delay: 0
    }
})

// Cleanup function for stuck jobs
export async function cleanupStuckJobs() {
    try {
        console.log("🧹 Starting cleanup of stuck jobs...");

        // Get stuck videos (processing for more than 20 minutes)
        const stuckVideos = await prisma.video.findMany({
            where: {
                processing: true,
                createdAt: {
                    lt: new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
                }
            }
        });

        console.log(`Found ${stuckVideos.length} stuck videos`);

        // Mark stuck videos as failed
        for (const video of stuckVideos) {
            await prisma.video.update({
                where: { videoId: video.videoId },
                data: {
                    processing: false,
                    failed: true
                }
            });

            console.log(`Marked video ${video.videoId} as failed (stuck for >20 minutes)`);
        }

        // Clean up failed jobs older than 24 hours
        const failedJobs = await videoQueue.getFailed(0, -1);
        const oldFailedJobs = failedJobs.filter(job =>
            Date.now() - job.timestamp > 24 * 60 * 60 * 1000
        );

        for (const job of oldFailedJobs) {
            await job.remove();
        }

        console.log(`Cleaned up ${oldFailedJobs.length} old failed jobs`);

        // Clean up completed jobs older than 48 hours
        const completedJobs = await videoQueue.getCompleted(0, -1);
        const oldCompletedJobs = completedJobs.filter(job =>
            Date.now() - job.timestamp > 48 * 60 * 60 * 1000
        );

        for (const job of oldCompletedJobs) {
            await job.remove();
        }

        console.log(`Cleaned up ${oldCompletedJobs.length} old completed jobs`);

        console.log("✅ Cleanup completed successfully");

    } catch (error) {
        console.error("❌ Error during cleanup:", error);
    }
}

// Enhanced worker with better error handling and timeouts
export class EnhancedVideoWorker {
    private worker: Worker;
    private cleanupInterval: NodeJS.Timeout | undefined;

    constructor() {
        this.worker = new Worker('video-processing', async (job: Job) => {
            const { videoId, config } = job.data;

            // Update job progress
            await job.updateProgress(0);

            try {
                // Import here to avoid circular dependencies
                const { processes } = await import('@/action/processes');
                const { processesWithConfig } = await import('@/action/processes-with-config');

                // Set up progress updates
                const progressInterval = setInterval(async () => {
                    try {
                        const video = await prisma.video.findUnique({
                            where: { videoId },
                            select: {
                                processing: true,
                                content: true,
                                imageLinks: true,
                                audio: true,
                                captions: true,
                                videoUrl: true
                            }
                        });

                        if (video) {
                            let progress = 0;
                            if (video.content) progress += 20;
                            if (video.imageLinks?.length) progress += 30;
                            if (video.audio) progress += 20;
                            if (video.captions) progress += 15;
                            if (video.videoUrl) progress += 15;

                            await job.updateProgress(progress);
                        }
                    } catch (error) {
                        console.error("Error updating job progress:", error);
                    }
                }, 10000); // Update every 10 seconds

                const result = config
                    ? await processesWithConfig(videoId, config)
                    : await processes(videoId);
                clearInterval(progressInterval);
                await job.updateProgress(100);

                return result;

            } catch (error) {
                // Ensure video is marked as failed
                await prisma.video.update({
                    where: { videoId },
                    data: {
                        processing: false,
                        failed: true
                    }
                }).catch(dbError => {
                    console.error("Failed to update video status:", dbError);
                });

                throw error;
            }
        }, {
            connection: createRedisConnection(),
            concurrency: 2
        });

        this.setupEventHandlers();
        this.startCleanupSchedule();
    }

    private setupEventHandlers() {
        this.worker.on('completed', (job, result) => {
            console.log(`✅ Job ${job.id} completed successfully`, {
                videoId: job.data.videoId,
                duration: Date.now() - job.timestamp,
                result: typeof result
            });
        });

        this.worker.on('failed', (job, err) => {
            console.error(`❌ Job ${job?.id} failed:`, {
                videoId: job?.data?.videoId,
                error: err.message,
                duration: job ? Date.now() - job.timestamp : 'unknown',
                attempts: job?.attemptsMade,
                stackTrace: err.stack
            });
        });

        this.worker.on('progress', (job, progress) => {
            console.log(`📊 Job ${job.id} progress: ${progress}%`);
        });

        this.worker.on('stalled', (jobId) => {
            console.warn(`⚠️ Job ${jobId} stalled - will be retried`);
        });

        this.worker.on('error', (err) => {
            console.error('❌ Worker error:', err);
        });
    }

    private startCleanupSchedule() {
        // Run cleanup every 30 minutes
        this.cleanupInterval = setInterval(() => {
            cleanupStuckJobs().catch(error => {
                console.error("Scheduled cleanup failed:", error);
            });
        }, 30 * 60 * 1000);

        // Run initial cleanup after 1 minute
        setTimeout(() => {
            cleanupStuckJobs().catch(error => {
                console.error("Initial cleanup failed:", error);
            });
        }, 60000);
    }

    public async shutdown() {
        console.log("🛑 Shutting down video worker...");

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        await this.worker.close();

        console.log("✅ Video worker shutdown complete");
    }
}

// Queue health monitoring
export async function getQueueHealth() {
    try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            videoQueue.getWaiting(),
            videoQueue.getActive(),
            videoQueue.getCompleted(0, 9),
            videoQueue.getFailed(0, 9),
            videoQueue.getDelayed()
        ]);

        return {
            status: 'healthy',
            counts: {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length,
                delayed: delayed.length
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}

// Queue metrics collection
export async function getQueueMetrics() {
    try {
        const stats = await videoQueue.getJobCounts();
        const jobs = await videoQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 100);

        // Calculate average processing time
        const completedJobs = jobs.filter(job => job.finishedOn && job.processedOn);
        const avgProcessingTime = completedJobs.length > 0
            ? completedJobs.reduce((sum, job) => sum + (job.finishedOn! - job.processedOn!), 0) / completedJobs.length
            : 0;

        // Calculate success rate
        const totalProcessed = stats.completed + stats.failed;
        const successRate = totalProcessed > 0 ? (stats.completed / totalProcessed) * 100 : 100;

        return {
            stats,
            avgProcessingTime,
            successRate,
            recentJobs: jobs.slice(0, 10).map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                failedReason: job.failedReason,
                attemptsMade: job.attemptsMade
            }))
        };
    } catch (error) {
        console.error('Failed to get queue metrics:', error);
        return null;
    }
}

// Initialize worker and cleanup
let workerInstance: EnhancedVideoWorker | null = null;

export function initializeWorker() {
    if (!workerInstance) {
        workerInstance = new EnhancedVideoWorker();
        console.log("✅ Video worker initialized");
    }
    return workerInstance;
}

export function getWorkerInstance() {
    return workerInstance;
}

// Process termination handling
if (typeof process !== 'undefined') {
    const gracefulShutdown = async (signal: string) => {
        console.log(`📨 Received ${signal}, starting graceful shutdown...`);

        if (workerInstance) {
            await workerInstance.shutdown();
        }

        await connection.quit();

        console.log("✅ Graceful shutdown complete");
        process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
