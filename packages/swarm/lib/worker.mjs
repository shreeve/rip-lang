// Worker bootstrap — loaded by each worker thread
// The rip-loader is preloaded via Worker({ preload: [...] }), so .rip imports work.
// Imports the user script (which calls swarm() — a no-op in worker mode),
// then processes tasks via IPC from the main thread.

import { parentPort, workerData } from 'worker_threads';

const { scriptPath, context } = workerData;

let perform;

try {
  // Import the user script — triggers swarm() which registers perform() in worker mode
  await import(scriptPath);

  // Get perform from the swarm module (registered by swarm() in worker mode)
  const swarmMod = await import(new URL('../swarm.rip', import.meta.url).href);
  perform = swarmMod._getPerform();

  if (typeof perform !== 'function') {
    throw new Error('No perform() function provided to swarm()');
  }
} catch (err) {
  parentPort.postMessage({ type: 'error', error: err.message });
  process.exit(1);
}

// Signal ready
parentPort.postMessage({ type: 'ready' });

// Process tasks as they arrive
parentPort.on('message', async (msg) => {
  if (msg.type === 'task') {
    try {
      await perform(msg.taskPath, context);
      parentPort.postMessage({ type: 'done', taskPath: msg.taskPath });
    } catch (err) {
      parentPort.postMessage({ type: 'failed', taskPath: msg.taskPath, error: err.message });
    }
  } else if (msg.type === 'shutdown') {
    process.exit(0);
  }
});
