// @ts-check
import { html, useLayoutEffect, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js'

export function App() {
  const [cwd, setCwd] = useState("/private/var/www/playwright-gen-example");

  async function selectCdm() {
    const entry = await Neutralino.os.showFolderDialog('Select project directory');

    if (!entry) {
      return;
    }

    try {
      const tasksFile = await Neutralino.filesystem.readFile(entry + '/tasks.sh');

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
    return html`<div style="display: flex;flex-direction: column;justify-content: center;min-height: 100vh;text-align: center;"><div><button onclick=${selectCdm}>Select project</button></div></div>`;
  }

  return html`<${Project} cwd=${cwd} />`;
}

/**
 * @param {{ cwd: string }} props
 */
function Project({ cwd }) {
  const [error, setError] = useState("");
  const [tab, setTab] = useState("run");
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    async function load() {
      setError("");

      const result = await Neutralino.os.execCommand("./tasks.sh prepare", { cwd });

      // First try might return stderr
      if (result.stdErr) {
        const result2 = await Neutralino.os.execCommand("./tasks.sh prepare", { cwd });

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
    return html`
      <div>
        <h1>${iconPlaywright()} ${cwd}</h1>

        <h2>error</h2>

        <pre>${error}</pre>
      </div>
    `;
  }

  if (loading) {
    return html`
      <div>
        <h1>${iconPlaywright()} ${cwd}</h1>

        Loading...
      </div>
    `;
  }

  return html`
    <div>
      <h1>${iconPlaywright()} ${cwd}</h1>

      <menu>
        <button type="button" class=${tab === "run" ? "active" : undefined} onclick=${() => setTab("run")}>Run Tests</button>
        <button type="button" class=${tab === "generate-test" ? "active" : undefined} onclick=${() => setTab("generate-test")}>Generate test</button>
        <button type="button" class=${tab === "generate-auth" ? "active" : undefined} onclick=${() => setTab("generate-auth")}>Generate auth</button>
      </menu>

      <br />

      ${tab === 'run' && html`<${ProjectTest} cwd=${cwd} />`}
      ${tab === 'generate-test' && html`<${ProjectGenerate} cwd=${cwd} />`}
      ${tab === 'generate-auth' && html`<${ProjectSetup} cwd=${cwd} />`}
    </div>
  `;
}

/**
 * @param {{ cwd: string }} props
 */
function ProjectSetup({ cwd }) {
  const [setupDir, setSetupDir] = useState("");
  const [url, setUrl] = useState("");
  const [saveAuth, setSaveAuth] = useState(true);
  const [auth, setAuth] = useState("");
  const [proc, setProc] = useState(null);
  const [_, logs] = useLogs(proc, setProc);
  const [authList, reloadAuthList] = useAuthList(proc, () => setSetupDir(""), cwd);

  async function selectSetupDir() {
    const output = await Neutralino.os.showFolderDialog('Create setup dir');
    setSetupDir(output?.replace(cwd + "/", ""));
  }

  async function generateTest() {
    const setupOutput = `${setupDir}/setup.ts`;
    const authOutput = `${setupDir}/auth.json`;
    const authInput = `${auth}/auth.json`;

    const commands = [
      "./tasks.sh codegen",
      `--output=${JSON.stringify(setupOutput)}`,
      saveAuth && `--save-storage=${JSON.stringify(authOutput)}`,
      /^\//.test(auth || "") && `--load-storage=${JSON.stringify(authInput)}`,
      url,
    ].filter(Boolean);

    const proc = await Neutralino.os.spawnProcess(commands.join(" "), { cwd });
    setProc(proc);
  }

  return html`
    <div>
      <h2>
        <span>Generate Auth</span>
      </h2>
      <div>
        <label>
          <span>Load auth</span>
          <br />
          <select value=${auth} oninput=${(e) => setAuth(e.target.value)}>
            <option value="">none</option>
            ${authList.map((entry) => html`
              <option value=${entry.path}>${entry.entry}</option>
            `)}
          </select>
        </label>
        <button type="button" onclick=${reloadAuthList}>refresh</button>

        <br />
        <br />

        <label>
          <span>Test url</span>
          <br />
          <input
            type="text"
            value=${url}
            oninput=${(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </label>

        <br />
        <br />

        <label>
          <span>Auth folder location</span>
          <br />
          <input
            type="text"
            value=${setupDir}
            readonly
          />
        </label>
        <button type="button" onclick=${selectSetupDir}>select</button>

        <br />
        <br />

        <label>
          <input
            type="checkbox"
            checked=${saveAuth}
            oninput=${(e) => setSaveAuth(e.target.checked)}
          />
          <span> Save auth file</span>
        </label>

        <br />
        <br />

        ${proc ? html`
          <button onclick=${() => Neutralino.os.updateSpawnedProcess(proc.id, 'exit')}>Stop</button>
        ` : html`
          <button onclick=${generateTest} disabled=${!setupDir || !url}>Start</button>
        `}
      </div>
      <br />
      <details>
        <summary>Logs</summary>
        <pre innerHTML=${logs} />
      </details>
    </div>
  `;
}

function ProjectVariables() {
  return html`
    <hr />
    <div>
      <h2>
        <span>Variables</span>
      </h2>
      <div>
        Variable A: 1
        <br />
        Save to .env.template & read from it too
        NAME_1: DATE
      </div>
    </div>
  `;
}

/**
 * @param {{ cwd: string }} props
 */
function ProjectGenerate({ cwd }) {
  const [lastOutput, setLastOutput] = useState("");
  const [output, setOutput] = useState("");
  const [url, setUrl] = useState("");
  const [auth, setAuth] = useState("");
  const [proc, setProc] = useState(null);
  const [_, logs] = useLogs(proc, setProc);
  const [authList, reloadAuthList] = useAuthList(proc, () => {
    let lastOutput = "";
    setOutput((o) => {
      lastOutput = o;
      return "";
    });
    // setLastOutput(lastOutput);
  }, cwd);

  async function selectTestFile() {
    const output = await Neutralino.os.showSaveDialog('Create test file', {
      filters: [
        { name: 'Setup file', extensions: ['ts'] },
      ]
    });
    setOutput(output?.replace(cwd + "/", ""));
  }

  async function generateTest() {
    const authInput = `${auth}/auth.json`;

    const commands = [
      "PLAYWRIGHT_FORCE_TTY=0 FORCE_COLOR=0 ./tasks.sh codegen",
      `--output=${JSON.stringify(output)}`,
      /^\//.test(auth || "") && `--load-storage=${JSON.stringify(authInput)}`,
      url,
    ].filter(Boolean);

    const proc = await Neutralino.os.spawnProcess(commands.join(" "), { cwd });
    setProc(proc);
  }

  return html`
    <div>
      <h2>
        <span>Generate Test</span>
      </h2>
      <div>
        <label>
          <span>Load auth</span>
          <br />
          <select value=${auth} oninput=${(e) => setAuth(e.target.value)}>
            <option value="">none</option>
            ${authList.map((entry) => html`
              <option value=${entry.path}>${entry.entry}</option>
            `)}
          </select>
        </label>
        <button type="button" onclick=${reloadAuthList}>refresh</button>

        <br />
        <br />

        <label>
          <span>Test url</span>
          <br />
          <input
            type="text"
            value=${url}
            oninput=${(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </label>

        <br />
        <br />

        <label>
          <span>Test file location</span>
          <br />
          <input
            type="text"
            value=${output}
            readonly
          />
        </label>
        <button type="button" onclick=${selectTestFile}>select</button>

        <br />
        <br />

        ${proc ? html`
          <button onclick=${() => Neutralino.os.updateSpawnedProcess(proc.id, 'exit')}>Stop</button>
        ` : html`
          <button onclick=${generateTest} disabled=${!output || !url}>Start</button>
        `}
      </div>
      <br />
      <details>
        <summary>Logs</summary>
        <pre innerHTML=${logs} />
      </details>
    </div>
  `;
}

/**
 * @param {{ path: string, exit: () => void }} props
 */
function ProjectSetVariables({ path, exit }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!path) {
    return ""
  }

  return html`
    <br />
    <div class="var-replace">
      <strong>Set variables in last recorded test</strong>
      <br />
      <span>${path}</span>
      <form onsubmit=${async (e) => {
      e.preventDefault();

      setError("");
      setSuccess("");

      const formData = new FormData(e.target);
      const text = formData.get("text");
      const type = formData.get("type");

      if (!type || !text) {
        setError('No value entered');
        return;
      }

      const content = await Neutralino.filesystem.readFile(path);

      if (content.indexOf(text) === -1) {
        setError(`Value ${JSON.stringify(text)} not found!`);
        return;
      }

      console.log({
        text,
        type,
        content,
      });

      // await Neutralino.os.showMessageBox('Playwriter', 'No value to replace');
      setSuccess(`Value ${JSON.stringify(text)} replaced!`);
    }}>
        <input type="text" name="text" placeholder="Value to replace" />
        <select name="type">
          <option value="generic">generic</option>
          <option value="email">email</option>
        </select>
        <br />
        <button style="margin-top: 10px;" type="submit">replace</button>
        <button type="button" onclick=${exit}>close</button>
        ${success && html`<div style="color: green;">${success}</div>`}
        ${error && html`<div style="color: orangered;">${error}</div>`}
      </form>
    </div>
  `;
}

/**
 * @param {{ cwd: string }} props
 */
function ProjectTest({ cwd }) {
  const [grep, setGrep] = useState("dashboard");
  const [procReport, setProcReport] = useState(null);
  const [proc, setProc] = useState(null);
  const [rawLogs, logs] = useLogs(proc, setProc);
  const [tests, setTests] = useState([]);
  const [testsRunning, setTestsRunning] = useState([]);
  const [testsStatus, setTestsStatus] = useState([]);

  /**
   * @param {boolean=} filter
   */
  async function getTestList(filter) {
    const cmd = [
      `PLAYWRIGHT_FORCE_TTY=0 FORCE_COLOR=0 ./tasks.sh test --reporter="list" --list`,
      filter && `--grep=${JSON.stringify(`/${grep}/`)}`,
    ].filter(Boolean);
    const result = await Neutralino.os.execCommand(cmd.join(" "), { cwd });

    if (result.stdErr) {
      console.error(result.stdErr)
    }

    const lines = result.stdOut.split("\n");
    lines.splice(0, lines.findIndex((line) => /^Listing tests:/.test(line)) + 1);
    lines.splice(lines.findIndex((line) => /^Total: /.test(line)), lines.length);

    return lines.map((line) => {
      const [type, path, name] = line.trim().split(" › ");

      return {
        type: type === '[setup]' ? 'auth' : 'test',
        path: path.replace(/^.*file\:|\:\d+\:\d+$/g, "").slice(cwd.length),
        name,
      }
    });
  }

  function getTestStatusList() {
    const lines = logs.split("\n").filter((line) => (
      /^  [✘✓]  \d+ \[\w+\] › [a-z0-9:\-_\/\. ]+ › \w+/i.test(line)
    ));

    return lines.map((line) => {
      const [_, status, type, path, name] = line.match(/^  ([✘✓])  \d+ \[(\w+)\] › ([a-z0-9:\-_\/\. ]+) › (\w+)/i) || [];

      return {
        type,
        path: path.replace(/^.*file\:|\:\d+\:\d+$/g, "").slice(cwd.length),
        status: status === "✓" ? 'pass' : 'fail',
        name,
      }
    });
  }

  useLayoutEffect(() => {
    setTestsStatus(getTestStatusList());
  }, [logs]);

  useLayoutEffect(() => {
    async function updateTestList() {
      setTests(await getTestList());
    }

    updateTestList();

    window.addEventListener("focus", updateTestList);

    return () => {
      window.removeEventListener("focus", updateTestList);
    };
  }, [cwd]);

  async function runReport() {
    const proc = await Neutralino.os.spawnProcess(`./tasks.sh report`, { cwd });
    setProcReport(proc);
  }

  async function runTests() {
    setTestsRunning(await getTestList(true));

    const proc = await Neutralino.os.spawnProcess(`PLAYWRIGHT_FORCE_TTY=0 FORCE_COLOR=0 ./tasks.sh test --grep=${JSON.stringify(`/${grep}/`)}`, { cwd });
    setProc(proc);
  }

  const testsList = tests.map((t1) => {
    const run = !!testsRunning.find((t2) => t1.path === t2.path);
    const status = run && (testsStatus.find((t2) => t1.path === t2.path)?.status) || 'idle';

    return {
      ...t1,
      run,
      status,
    };
  });

  const testsAreRunning = !!(rawLogs && proc);

  async function stopReport() {
    await Neutralino.os.updateSpawnedProcess(procReport.id, 'exit');
    setProcReport(null);
  }

  return html`
    <div>
      <h2>
        <span>Run Tests</span>
      </h2>
      <div>
        <label>
          <span>Test scope</span>
          <br />
          <input
            type="text"
            value=${grep}
            oninput=${(e) => setGrep(e.target.value)}
          />
        </label>

        <br />
        <br />

        ${proc ? html`
          <button onclick=${() => Neutralino.os.updateSpawnedProcess(proc.id, 'exit')}>Stop</button>
        ` : html`
          <button onclick=${runTests}>Start</button>
        `}

        ${procReport ? html`
          <dialog ref=${(e) => { e?.showModal() }} onclose=${stopReport}>
            <h3>Report is running</h3>
            <button onclick=${stopReport}>Stop</button>
          </dialog>

          <button onclick=${stopReport}>Stop</button>
        ` : html`
          <button onclick=${runReport} disabled=${!(!proc && !!rawLogs)}>Show report</button>
        `}
      </div>
      <br />
      <ul>
        ${testsList.map((test) => html`
          <li>
            ${!test.run && iconIdle()}
            ${!!(testsAreRunning && test.run && test.status === "idle") && iconLoad()}
            ${!!(test.run && test.status === "pass") && iconPass()}
            ${!!(test.run && test.status === "fail") && iconFail()}
            ${!!(!testsAreRunning && test.run && test.status === "idle") && iconSkip()}
            ${" "}<b>[${test.type}]:</b> ${test.path}
          </li>
        `)}
      </ul>
      <details>
        <summary>Logs</summary>
        <pre innerHTML=${logs} />
      </details>
    </div>
  `;
}

function terminalEscapeCodesToHTML(text) {
  return '<span>' +
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/1A\x1B\[2K/g, "")
      .replace(/\x1B\[([^m]*)m/g, (_, escape) => {
        switch (escape) {
          case '1': return '</span><span class="color-bold">'
          case '31': return '</span><span class="color-red">'
          case '32': return '</span><span class="color-green">'
          case '33': return '</span><span class="color-yellow">'
          case '35': return '</span><span class="color-magenta">' // This is generated by warnings in version 0.14.0 and earlier
          case '37': return '</span><span class="color-dim">'
          case '41;31': return '</span><span class="bg-red color-red">'
          case '41;97': return '</span><span class="bg-red color-white">'
          case '43;33': return '</span><span class="bg-yellow color-yellow">'
          case '43;30': return '</span><span class="bg-yellow color-black">'
          case '0': return '</span><span>'
        }
        return escape
      }) +
    '</span>'
}

/**
 * @param {Neutralino.os.SpawnedProcess | null} proc
 * @param {(arg: Neutralino.os.SpawnedProcess | null) => void} setProc
 */
function useLogs(proc, setProc) {
  const [logs, setLogs] = useState("");

  useLayoutEffect(() => {
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

    Neutralino.events.on('spawnedProcess', handler);

    return () => {
      Neutralino.events.off('spawnedProcess', handler)
    }
  }, [proc]);

  return [logs, terminalEscapeCodesToHTML(logs)];
}

function useAuthList(proc, reset, cwd) {
  const [authList, setAuthList] = useState([]);

  useLayoutEffect(() => {
    reloadAuthList();

    if (!proc) {
      reset();
    }
  }, [proc]);

  useLayoutEffect(() => {
    window.addEventListener("focus", reloadAuthList);

    return () => {
      window.removeEventListener("focus", reloadAuthList);
    };
  }, [proc]);

  async function reloadAuthList() {
    const sessionPath = `${cwd}/session/`;
    const entries = await Neutralino.filesystem.readDirectory(sessionPath);

    const entriesWithAuth = (await Promise.all(
      entries
        .filter((entry) => entry.type === 'DIRECTORY')
        .map((entry) => (
          Neutralino.filesystem.readFile(`${entry.path}/auth.json`)
            .then((content) => content && entry)
            .catch(() => { })
        ))
    )).filter(Boolean);

    setAuthList(entriesWithAuth);
  }

  return [authList, reloadAuthList];
}

function iconPlaywright() {
  return html`<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14.5496 23.6067V21.5876L8.94009 23.1784C8.94009 23.1784 9.35466 20.77 12.2802 19.9401C13.1676 19.6886 13.9244 19.6903 14.5496 19.811V11.5298H17.3585C17.0528 10.5848 16.7569 9.85725 16.5083 9.35184C16.0973 8.51512 15.6758 9.06975 14.7192 9.86991C14.0453 10.4327 12.3427 11.6336 9.78019 12.3241C7.21772 13.0151 5.14631 12.8317 4.28175 12.6821C3.05634 12.4706 2.41538 12.2017 2.47556 13.1335C2.52788 13.9556 2.72363 15.2303 3.17222 16.9135C4.14253 20.5591 7.34991 27.5833 13.4111 25.9507C14.9943 25.524 16.112 24.6808 16.8865 23.6062H14.5496V23.6067ZM5.49759 16.9636L9.80522 15.8287C9.80522 15.8287 9.67978 17.4859 8.06484 17.9114C6.44963 18.3367 5.49759 16.9636 5.49759 16.9636Z" fill="#E2574C"/>
  <path d="M30.7609 11.6257C29.6412 11.8221 26.955 12.0665 23.6351 11.1769C20.3144 10.2876 18.1114 8.73225 17.2384 8.001C16.0009 6.96459 15.4567 6.24431 14.9209 7.33388C14.4472 8.29491 13.8417 9.85866 13.2556 12.0482C11.9855 16.7892 11.036 26.7938 18.8882 28.899C26.7384 31.0025 30.9178 21.863 32.1882 17.1217C32.7743 14.9327 33.0314 13.2753 33.1023 12.2065C33.183 10.9958 32.3513 11.3473 30.7612 11.626L30.7609 11.6257ZM14.985 15.5481C14.985 15.5481 16.2225 13.6235 18.3212 14.22C20.4213 14.8165 20.5838 17.1383 20.5838 17.1383L14.985 15.5481ZM20.108 24.1841C16.4166 23.1027 15.847 20.1592 15.847 20.1592L25.7636 22.9317C25.7636 22.9312 23.762 25.252 20.108 24.1841ZM23.614 18.1344C23.614 18.1344 24.8498 16.2112 26.948 16.8095C29.0461 17.4068 29.2115 19.7286 29.2115 19.7286L23.614 18.1344Z" fill="#2EAD33"/>
  </svg>`
}

function iconIdle() {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="color:gray;" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.1 2.182a10 10 0 0 1 3.8 0m0 19.636a10 10 0 0 1-3.8 0m7.509-18.097a10 10 0 0 1 2.69 2.7M2.182 13.9a10 10 0 0 1 0-3.8m18.097 7.509a10 10 0 0 1-2.7 2.69M21.818 10.1a10 10 0 0 1 0 3.8M3.721 6.391a10 10 0 0 1 2.7-2.69m-.03 16.578a10 10 0 0 1-2.69-2.7"/></svg>`
}

function iconLoad() {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v4m4.2 1.8l2.9-2.9M18 12h4m-5.8 4.2l2.9 2.9M12 18v4m-7.1-2.9l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9"/></svg>`
}

function iconPass() {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="color:green;" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12l2 2l4-4"/></g></svg>`
}

function iconFail() {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="color:orangered;" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9l-6 6m0-6l6 6"/></g></svg>`
}

function iconSkip() {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="color:gray;" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 12h8m-4-4"/><circle cx="12" cy="12" r="10"/></g></svg>`
}

// window.onkeydown = (e) => {
//   console.log(e)
//   if (e.key === 'c' && e.metaKey) {
//     e.preventDefault();
//     console.log("COPY", window.getSelection()?.toString())
//     Neutralino.clipboard.writeText(window.getSelection()?.toString()).then(() => {
//       console.log('Text copied to clipboard');
//     });
//   }
// }

// window.onkeydown = (e) => {
//   console.log(e)
//   if (e.key === 'v' && e.metaKey) {
//     // window.getSelection().target.dispatchEvent(new KeyboardEvent('keydown', {'key': 'a'}));
//     e.preventDefault();
//     console.log("PASTE", window.getSelection())
//     Neutralino.clipboard.readText().then((text) => {
//       window.getSelection()
//       console.log('Text copied to clipboard');
//     });
//   }
// }
