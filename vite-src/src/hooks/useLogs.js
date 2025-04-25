import { useState, useEffect } from 'react';
import { events, os } from "@neutralinojs/lib";
import { terminalEscapeCodesToHTML } from '../utils/terminal.js';

/**
 * Hook for managing logs from a spawned process
 * @param {os.SpawnedProcess | null} proc The process to monitor
 * @param {(arg: os.SpawnedProcess | null) => void} setProc Function to update the process state
 * @returns {[string, string]} Raw logs and HTML formatted logs
 */
export function useLogs(proc, setProc) {
  const [logs, setLogs] = useState("");

  useEffect(() => {
    if (!proc) {
      return;
    }

    setLogs("");

    /**
     * @param {CustomEvent<any>} evt
     */
    function handler(evt) {
      if (proc?.id == evt.detail.id) {
        switch (evt.detail.action) {
          case 'stdOut':
            setLogs((l) => l + evt.detail.data);
            break;
          case 'stdErr':
            setLogs((l) => l + evt.detail.data);
            break;
          case 'exit':
            setLogs((l) => l + `Process terminated with exit code: ${evt.detail.data}`);
            setProc(null);
            break;
        }
      }
    }

    events.on('spawnedProcess', handler);

    return () => {
      events.off('spawnedProcess', handler);
    }
  }, [proc]);

  return [logs, terminalEscapeCodesToHTML(logs)];
}
