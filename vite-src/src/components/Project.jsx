import React, { useState, useLayoutEffect } from 'react';
import { filesystem, os } from "@neutralinojs/lib";
import { ProjectTest } from './ProjectTest.jsx';
import { ProjectGenerate } from './ProjectGenerate.jsx';
import { ProjectSetup } from './ProjectSetup.jsx';
import { IconPlaywright } from '../utils/icons.jsx';

/**
 * @param {{ cwd: string }} props
 */
export function Project({ cwd }) {
  const [error, setError] = useState("");
  const [tab, setTab] = useState("run");
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    async function load() {
      setError("");

      const result = await os.execCommand("./tasks.sh prepare", { cwd });

      // First try might return stderr
      if (result.stdErr) {
        const result2 = await os.execCommand("./tasks.sh prepare", { cwd });

        // If it's still error, then just show error
        if (result2.stdErr) {
          console.error(result.stdErr);
          setError(result.stdErr);
          return;
        }
      }

      setLoading(false);
    }

    load();
  }, [cwd]);

  if (error) {
    return (
      <div>
        <h1>
          <IconPlaywright /> {cwd}
        </h1>

        <h2>error</h2>

        <pre>{error}</pre>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1>
          <IconPlaywright /> {cwd}
        </h1>

        Loading...
      </div>
    );
  }

  return (
    <div>
      <h1>
        <IconPlaywright /> {cwd}
      </h1>

      <menu>
        <button
          type="button"
          className={tab === "run" ? "active" : undefined}
          onClick={() => setTab("run")}
        >
          Run Tests
        </button>
        <button
          type="button"
          className={tab === "generate-test" ? "active" : undefined}
          onClick={() => setTab("generate-test")}
        >
          Generate test
        </button>
        <button
          type="button"
          className={tab === "generate-auth" ? "active" : undefined}
          onClick={() => setTab("generate-auth")}
        >
          Generate auth
        </button>
      </menu>

      <br />

      {tab === 'run' && <ProjectTest cwd={cwd} />}
      {tab === 'generate-test' && <ProjectGenerate cwd={cwd} />}
      {tab === 'generate-auth' && <ProjectSetup cwd={cwd} />}
    </div>
  );
}
