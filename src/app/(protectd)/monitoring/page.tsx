import { getQueueHealth } from '@/lib/queue'

export default async function MonitoringPage() {
  const queueHealth = await getQueueHealth()

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">System Monitoring</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Queue Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                queueHealth.status === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {queueHealth.status}
              </span>
            </div>
            {queueHealth.counts && (
              <>
                <div className="flex justify-between">
                  <span>Waiting:</span>
                  <span className="font-mono">{queueHealth.counts.waiting}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="font-mono">{queueHealth.counts.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="font-mono">{queueHealth.counts.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="font-mono">{queueHealth.counts.failed}</span>
                </div>
              </>
            )}
            {queueHealth.error && (
              <div className="text-red-600 text-sm mt-2">
                Error: {queueHealth.error}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Worker Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="font-mono">Standalone</span>
            </div>
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="font-mono">{process.env.NODE_ENV || 'development'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">System Info</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Redis:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                queueHealth.status === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {queueHealth.status === 'healthy' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Quick Setup</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          This system uses a standalone worker architecture for better scalability.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-medium">Development:</h4>
            <code className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              pnpm run dev:full
            </code>
          </div>
          <div>
            <h4 className="font-medium">Production:</h4>
            <code className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              pnpm run start:full
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
