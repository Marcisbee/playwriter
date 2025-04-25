import React, { useState } from 'react';
import { filesystem, os } from "@neutralinojs/lib";

import { Project } from './Project.jsx';

export function App() {
  const [cwd, setCwd] = useState("");

  async function selectCdm() {
    const entry = await os.showFolderDialog('Select project directory');

    if (!entry) {
      return;
    }

    try {
      const tasksFile = await filesystem.readFile(entry + '/tasks.sh');

      if (!tasksFile) {
        throw new Error("Project not found");
      }
    } catch (e) {
      console.error(e);
      return;
    }

    setCwd(entry);
    console.log('You have selected:', entry);
  }

  if (!cwd) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100vh",
        textAlign: "center"
      }}>
        <div>
          <button onClick={selectCdm}>Select project</button>
        </div>
      </div>
    );
  }

  return <Project cwd={cwd} />;
}
