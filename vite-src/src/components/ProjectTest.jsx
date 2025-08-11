import { filesystem, os } from "@neutralinojs/lib";
import React, { useLayoutEffect, useState } from "react";
import { useLogs } from "../hooks/useLogs.js";
import {
	IconFail,
	IconIdle,
	IconLoad,
	IconPass,
	IconSkip,
} from "../utils/icons.jsx";

/**
 * @param {{ cwd: string }} props
 */
export function ProjectTest({ cwd }) {
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
		const result = await os.execCommand(cmd.join(" "), { cwd });

		if (result.stdErr) {
			console.error(result.stdErr);
		}

		const lines = result.stdOut.split("\n");
		lines.splice(
			0,
			lines.findIndex((line) => /^Listing tests:/.test(line)) + 1,
		);
		lines.splice(
			lines.findIndex((line) => /^Total: /.test(line)),
			lines.length,
		);

		return lines.map((line) => {
			const [type, path, name] = line.trim().split(" › ");

			return {
				type: type === "[setup]" ? "auth" : "test",
				path: path.replace(/^.*file:|:\d+:\d+$/g, "").slice(cwd.length),
				name,
			};
		});
	}

	function getTestStatusList() {
		const lines = logs
			.split("\n")
			.filter((line) =>
				/^ {2}[✘✓] {2}\d+ \[\w+\] › [a-z0-9:\-_/. ]+ › \w+/i.test(line),
			);

		return lines.map((line) => {
			const [_, status, type, path, name] =
				line.match(
					/^ {2}([✘✓]) {2}\d+ \[(\w+)\] › ([a-z0-9:\-_/. ]+) › (\w+)/i,
				) || [];

			return {
				type,
				path: path.replace(/^.*file:|:\d+:\d+$/g, "").slice(cwd.length),
				status: status === "✓" ? "pass" : "fail",
				name,
			};
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
		const proc = await os.spawnProcess(`./tasks.sh report`, { cwd });
		setProcReport(proc);
	}

	async function runTests() {
		setTestsRunning(await getTestList(true));

		const proc = await os.spawnProcess(
			`PLAYWRIGHT_FORCE_TTY=0 FORCE_COLOR=0 ./tasks.sh test --grep=${JSON.stringify(`/${grep}/`)}`,
			{ cwd },
		);
		setProc(proc);
	}

	const testsList = tests.map((t1) => {
		const run = !!testsRunning.find((t2) => t1.path === t2.path);
		const status =
			(run && testsStatus.find((t2) => t1.path === t2.path)?.status) || "idle";

		return {
			...t1,
			run,
			status,
		};
	});

	const testsAreRunning = !!(rawLogs && proc);

	async function stopReport() {
		await os.updateSpawnedProcess(procReport.id, "exit");
		setProcReport(null);
	}

	return (
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
						value={grep}
						onChange={(e) => setGrep(e.target.value)}
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
					/>
				</label>

				<br />
				<br />

				{proc ? (
					<button onClick={() => os.updateSpawnedProcess(proc.id, "exit")}>
						Stop
					</button>
				) : (
					<button onClick={runTests}>Start</button>
				)}

				{procReport ? (
					<>
						<dialog
							ref={(e) => {
								e?.showModal();
							}}
							onClose={stopReport}
						>
							<h3>Report is running</h3>
							<button onClick={stopReport}>Stop</button>
						</dialog>

						<button onClick={stopReport}>Stop</button>
					</>
				) : (
					<button onClick={runReport} disabled={!(!proc && !!rawLogs)}>
						Show report
					</button>
				)}
			</div>
			<br />
			<ul>
				{testsList.map((test, index) => (
					<li key={index}>
						{!test.run && <IconIdle />}
						{!!(testsAreRunning && test.run && test.status === "idle") && (
							<IconLoad />
						)}
						{!!(test.run && test.status === "pass") && <IconPass />}
						{!!(test.run && test.status === "fail") && <IconFail />}
						{!!(!testsAreRunning && test.run && test.status === "idle") && (
							<IconSkip />
						)}{" "}
						<b>[{test.type}]:</b> {test.path}
					</li>
				))}
			</ul>
			<details>
				<summary>Logs</summary>
				<pre dangerouslySetInnerHTML={{ __html: logs }} />
			</details>
		</div>
	);
}
