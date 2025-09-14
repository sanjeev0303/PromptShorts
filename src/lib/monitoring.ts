import { prisma } from './prisma'
import { Redis } from 'ioredis'
import { createMonitoringRedisConnection } from './queue'

// Performance metrics collection
interface PerformanceMetric {
  timestamp: Date;
  metricName: string;
  value: number;
  tags?: Record<string, string>;
  unit?: 'ms' | 'bytes' | 'count' | 'percent' | 'requests/sec';
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
  services: {
    database: { status: string; responseTime: number };
    redis: { status: string; responseTime: number };
    queue: { status: string; activeJobs: number; waitingJobs: number };
    disk: { status: string; usage: number };
    memory: { status: string; usage: number };
  };
}

interface VideoProcessingMetrics {
  videoId: string;
  totalDuration: number;
  stepDurations: Record<string, number>;
  errors: string[];
  retryCount: number;
  memoryUsage: number;
  status: 'success' | 'failed' | 'processing';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private redis: Redis;
  private metricsFlushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.redis = createMonitoringRedisConnection();
    this.startMetricsCollection();
  }

  // Record performance metrics
  recordMetric(name: string, value: number, tags?: Record<string, string>, unit?: string) {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      metricName: name,
      value,
      tags,
      unit: unit as any
    };

    this.metrics.push(metric);

    // Store in Redis for real-time monitoring
    this.redis.zadd(`metrics:${name}`, Date.now(), JSON.stringify(metric)).catch(() => {
      // Silently handle Redis errors
    });

    // Only log non-system metrics to reduce console noise
    if (!name.startsWith('system.memory.')) {
      console.log(`📊 Metric recorded: ${name} = ${value} ${unit || ''}`);
    }
  }

  // Time a function execution
  async timeOperation<T>(operationName: string, operation: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await operation();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const endMemory = process.memoryUsage().heapUsed;
      const memoryDelta = endMemory - startMemory;

      this.recordMetric(`${operationName}.duration`, duration, tags, 'ms');
      this.recordMetric(`${operationName}.memory_delta`, memoryDelta, tags, 'bytes');
      this.recordMetric(`${operationName}.success`, 1, tags, 'count');

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      this.recordMetric(`${operationName}.duration`, duration, tags, 'ms');
      this.recordMetric(`${operationName}.error`, 1, tags, 'count');

      throw error;
    }
  }

  // Get system health status
  async getSystemHealth(): Promise<SystemHealth> {
    const healthCheck: SystemHealth = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        queue: await this.checkQueueHealth(),
        disk: await this.checkDiskHealth(),
        memory: await this.checkMemoryHealth()
      }
    };

    // Determine overall health
    const services = Object.values(healthCheck.services);
    if (services.some(s => s.status === 'critical')) {
      healthCheck.status = 'critical';
    } else if (services.some(s => s.status === 'degraded')) {
      healthCheck.status = 'degraded';
    }

    return healthCheck;
  }

  private async checkDatabaseHealth() {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      return {
        status: responseTime < 1000 ? 'healthy' : responseTime < 5000 ? 'degraded' : 'critical',
        responseTime
      };
    } catch (error) {
      return {
        status: 'critical',
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkRedisHealth() {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'healthy' as const,
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        responseTime: Date.now() - start
      };
    }
  }

  private async checkQueueHealth() {
    try {
      // This would integrate with your BullMQ queue
      const activeJobs = 0; // TODO: Get from queue
      const waitingJobs = 0; // TODO: Get from queue

      return {
        status: waitingJobs < 100 ? 'healthy' : waitingJobs < 500 ? 'degraded' : 'critical',
        activeJobs,
        waitingJobs
      };
    } catch (error) {
      return {
        status: 'critical',
        activeJobs: 0,
        waitingJobs: 0
      };
    }
  }

  private async checkDiskHealth() {
    try {
      // Simplified disk check - in production, use proper disk monitoring
      const usage = 45; // Placeholder - implement actual disk usage check
      return {
        status: usage < 80 ? 'healthy' : usage < 90 ? 'degraded' : 'critical',
        usage
      };
    } catch (error) {
      return {
        status: 'critical',
        usage: 100
      };
    }
  }

  private async checkMemoryHealth() {
    try {
      const memInfo = process.memoryUsage();
      const usage = (memInfo.heapUsed / memInfo.heapTotal) * 100;
      return {
        status: usage < 80 ? 'healthy' : usage < 90 ? 'degraded' : 'critical',
        usage
      };
    } catch (error) {
      return {
        status: 'critical',
        usage: 100
      };
    }
  }

  // Get metrics for a time period
  async getMetrics(metricName: string, timeRange: number = 3600000): Promise<PerformanceMetric[]> {
    const end = Date.now();
    const start = end - timeRange;
    const key = `metrics:${metricName}`;

    try {
      const rawMetrics = await this.redis.zrangebyscore(key, start, end);
      return rawMetrics.map(metric => JSON.parse(metric));
    } catch (error) {
      console.error('Failed to fetch metrics from Redis:', error);
      return [];
    }
  }

  // Video processing metrics
  recordVideoProcessingMetrics(metrics: VideoProcessingMetrics) {
    this.recordMetric('video.processing.total_duration', metrics.totalDuration,
      { videoId: metrics.videoId, status: metrics.status }, 'ms');

    this.recordMetric('video.processing.memory_usage', metrics.memoryUsage,
      { videoId: metrics.videoId }, 'bytes');

    this.recordMetric('video.processing.retry_count', metrics.retryCount,
      { videoId: metrics.videoId }, 'count');

    if (metrics.status === 'success') {
      this.recordMetric('video.processing.success', 1, { videoId: metrics.videoId }, 'count');
    } else if (metrics.status === 'failed') {
      this.recordMetric('video.processing.failure', 1, { videoId: metrics.videoId }, 'count');
    }

    // Record individual step durations
    Object.entries(metrics.stepDurations).forEach(([step, duration]) => {
      this.recordMetric(`video.step.${step}.duration`, duration,
        { videoId: metrics.videoId }, 'ms');
    });
  }

  private startMetricsCollection() {
    // Collect system metrics every 30 seconds
    this.metricsFlushInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.recordMetric('system.memory.heap_used', memUsage.heapUsed, {}, 'bytes');
      this.recordMetric('system.memory.heap_total', memUsage.heapTotal, {}, 'bytes');
      this.recordMetric('system.memory.external', memUsage.external, {}, 'bytes');
      this.recordMetric('system.memory.rss', memUsage.rss, {}, 'bytes');

      // Cleanup old metrics (keep only last 1000 entries)
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }
    }, 30000);
  }

  // Alert system
  async checkAlerts(): Promise<Array<{ level: 'warning' | 'critical'; message: string }>> {
    const alerts: Array<{ level: 'warning' | 'critical'; message: string }> = [];
    const health = await this.getSystemHealth();

    if (health.status === 'critical') {
      alerts.push({
        level: 'critical',
        message: 'System health is critical - immediate attention required'
      });
    } else if (health.status === 'degraded') {
      alerts.push({
        level: 'warning',
        message: 'System performance is degraded'
      });
    }

    // Check specific service alerts
    Object.entries(health.services).forEach(([service, status]) => {
      if (status.status === 'critical') {
        alerts.push({
          level: 'critical',
          message: `${service} service is down or critically slow`
        });
      } else if (status.status === 'degraded') {
        alerts.push({
          level: 'warning',
          message: `${service} service performance is degraded`
        });
      }
    });

    return alerts;
  }

  // Cleanup
  destroy() {
    if (this.metricsFlushInterval) {
      clearInterval(this.metricsFlushInterval);
    }
    this.redis.disconnect();
  }

  // Shutdown alias for destroy
  async shutdown() {
    this.destroy();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { PerformanceMetric, SystemHealth, VideoProcessingMetrics };
