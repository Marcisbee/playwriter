import { filesystem, os } from "@neutralinojs/lib";
import React, { useState } from "react";
import { useAuthList } from "../hooks/useAuthList.js";
import { useLogs } from "../hooks/useLogs.js";

/**
 * @param {{ cwd: string }} props
 */
export function ProjectSetup({ cwd }) {
	const [setupDir, setSetupDir] = useState("");
	const [url, setUrl] = useState("");
	const [saveAuth, setSaveAuth] = useState(true);
	const [auth, setAuth] = useState("");
	const [proc, setProc] = useState(null);
	const [_, logs] = useLogs(proc, setProc);
	const [authList, reloadAuthList] = useAuthList(
		proc,
		() => setSetupDir(""),
		cwd,
	);

	async function selectSetupDir() {
		const output = await os.showFolderDialog("Create setup dir");
		setSetupDir(output);
	}

	async function generateTest() {
		const setupOutput = `${setupDir}/setup.ts`;
		const authDirForSave = setupDir.startsWith(cwd + "/")
			? setupDir.slice(cwd.length + 1)
			: setupDir;
		const authOutput = `${authDirForSave}/auth.json`;
		const authDir = /^\//.test(auth || "")
			? auth.startsWith(cwd + "/")
				? auth.slice(cwd.length + 1)
				: auth
			: auth;
		const authInput = auth ? `${authDir}/auth.json` : "";

		const commands = [
			"./tasks.sh codegen",
			`--output=${JSON.stringify(setupOutput)}`,
			saveAuth && `--save-storage=${JSON.stringify(authOutput)}`,
			auth &&
				!/^\//.test(authDir || "") &&
				`--load-storage=${JSON.stringify(authInput)}`,
			url,
		].filter(Boolean);

		const proc = await os.spawnProcess(commands.join(" "), { cwd });
		setProc(proc);
	}

	return (
		<div>
			<h2>
				<span>Generate Auth</span>
			</h2>
			<div>
				<label>
					<span>Load auth</span>
					<br />
					<select value={auth} onChange={(e) => setAuth(e.target.value)}>
						<option value="">none</option>
						{authList.map((entry, index) => (
							<option key={index} value={entry.path}>
								{entry.entry}
							</option>
						))}
					</select>
				</label>
				<button type="button" onClick={reloadAuthList}>
					refresh
				</button>

				<br />
				<br />

				<label>
					<span>Test url</span>
					<br />
					<input
						type="text"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://example.com"
					/>
				</label>

				<br />
				<br />

				<label>
					<span>Save auth folder location</span>
					<br />
					<input
						type="text"
						value={setupDir}
						readOnly
						placeholder="setup/000-scope"
					/>
				</label>
				<button type="button" onClick={selectSetupDir}>
					select
				</button>

				<br />
				<br />

				<label>
					<input
						type="checkbox"
						checked={saveAuth}
						onChange={(e) => setSaveAuth(e.target.checked)}
					/>
					<span> Save auth file</span>
				</label>

				<br />
				<br />

				{proc ? (
					<button onClick={() => os.updateSpawnedProcess(proc.id, "exit")}>
						Stop
					</button>
				) : (
					<button onClick={generateTest} disabled={!setupDir || !url}>
						Start
					</button>
				)}
			</div>
			<br />
			<details>
				<summary>Logs</summary>
				<pre dangerouslySetInnerHTML={{ __html: logs }} />
			</details>
		</div>
	);
}
