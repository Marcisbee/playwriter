import { filesystem, os } from "@neutralinojs/lib";
import React, { useState } from "react";
import { useAuthList } from "../hooks/useAuthList.js";
import { useLogs } from "../hooks/useLogs.js";

/**
 * @param {{ cwd: string }} props
 */
export function ProjectGenerate({ cwd }) {
	const [lastOutput, setLastOutput] = useState("");
	const [output, setOutput] = useState("");
	const [url, setUrl] = useState("");
	const [auth, setAuth] = useState("");
	const [proc, setProc] = useState(null);
	const [_, logs] = useLogs(proc, setProc);
	const [authList, reloadAuthList] = useAuthList(
		proc,
		() => {
			let lastOutput = "";
			setOutput((o) => {
				lastOutput = o;
				return "";
			});
			// setLastOutput(lastOutput);
		},
		cwd,
	);

	async function selectTestFile() {
		const output = await os.showSaveDialog("Create test file", {
			filters: [{ name: "Setup file", extensions: ["ts"] }],
		});
		setOutput(output);
	}

	async function generateTest() {
		const authDir = /^\//.test(auth || "")
			? auth.startsWith(cwd + "/")
				? auth.slice(cwd.length + 1)
				: auth
			: auth;
		const authInput = auth ? `${authDir}/auth.json` : "";

		const commands = [
			"PLAYWRIGHT_FORCE_TTY=0 FORCE_COLOR=0 ./tasks.sh codegen",
			`--output=${JSON.stringify(output)}`,
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
				<span>Generate Test</span>
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
					<span>Save test file location</span>
					<br />
					<input
						type="text"
						value={output}
						readOnly
						placeholder="tests/000-feature/000-step.ts"
					/>
				</label>
				<button type="button" onClick={selectTestFile}>
					select
				</button>

				<br />
				<br />

				{proc ? (
					<button onClick={() => os.updateSpawnedProcess(proc.id, "exit")}>
						Stop
					</button>
				) : (
					<button onClick={generateTest} disabled={!output || !url}>
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
