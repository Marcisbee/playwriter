import { app, os } from "@neutralinojs/lib";
import React, { useEffect, useMemo, useState } from "react";

/**
 * AppUpdater
 * - Shows current app version (disabled button)
 * - On mount, checks if a newer version is available from GitHub releases
 * - If newer version exists, shows an enabled "Update" button
 * - When updating, runs the same steps as install.sh (download/unzip) and restarts the app
 *
 * Usage: Render this component above the "Select Project Directory" button in App.jsx.
 */
export function AppUpdater() {
	const currentVersion = useMemo(() => {
		// NL_APPVERSION is provided by Neutralino global variables
		// Fallback to "0.0.0" if missing
		const v =
			typeof window !== "undefined" && window.NL_APPVERSION
				? window.NL_APPVERSION
				: "0.0.0";
		return normalizeVersion(v);
	}, []);

	const [checking, setChecking] = useState(true);
	const [latestVersion, setLatestVersion] = useState("");
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [updating, setUpdating] = useState(false);
	const [updateLog, setUpdateLog] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		let mounted = true;
		const check = async () => {
			setChecking(true);
			setError("");
			try {
				const next = await fetchLatestVersion();
				if (!mounted) return;

				setLatestVersion(next);
				setUpdateAvailable(compareSemver(next, currentVersion) > 0);
			} catch (e) {
				setError(stringifyError(e));
				setUpdateAvailable(false);
			} finally {
				if (mounted) setChecking(false);
			}
		};
		check();
		return () => {
			mounted = false;
		};
	}, [currentVersion]);

	const handleUpdate = async () => {
		setUpdating(true);
		setError("");
		setUpdateLog("");

		// Compose the URL for the latest release zip
		// Example: https://github.com/Marcisbee/playwriter/releases/download/v0.1.5/Playwriter.zip
		const zipUrl = `https://github.com/Marcisbee/playwriter/releases/download/v${latestVersion}/Playwriter.zip`;

		// Equivalent to install.sh steps:
		// 1) curl -L -o Playwriter.zip "<zipUrl>"
		// 2) unzip -o Playwriter.zip
		// 3) rm Playwriter.zip
		// 4) rm -rf __MACOSX
		const sh = [
			"set -e",
			`curl -L -o Playwriter.zip "${zipUrl}"`,
			"unzip -o Playwriter.zip",
			"rm -f Playwriter.zip",
			"rm -rf __MACOSX",
		].join("; ");

		// Execute in the current working directory if available
		const cwd =
			typeof window !== "undefined" && window.NL_CWD
				? window.NL_CWD
				: undefined;

		try {
			// Escape double quotes for bash -lc "<cmd>"
			const bashCmd = `bash -lc "${sh.replaceAll('"', '\\"')}"`;
			const result = await os.execCommand(bashCmd, cwd ? { cwd } : undefined);

			const combined = [result.stdOut || "", result.stdErr || ""]
				.filter(Boolean)
				.join("\n")
				.trim();
			if (combined) setUpdateLog(combined);

			if (result.exitCode !== 0) {
				throw new Error(`Installer failed with exit code ${result.exitCode}`);
			}

			// Restart the app to load the new version
			await app.restartProcess();
		} catch (e) {
			setError(`Update failed: ${stringifyError(e)}`);
			setUpdating(false);
		}
	};

	return (
		<div
			style={{
				display: "flex",
				gap: 10,
				alignItems: "center",
				justifyContent: "center",
				margin: "10px 0 20px",
				flexWrap: "wrap",
			}}
		>
			{checking ? (
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						color: "#555",
					}}
				>
					<Spinner />
					Checking for updates...
				</span>
			) : updating ? (
				<button
					type="button"
					disabled
					style={{
						padding: "6px 10px",
						borderRadius: 6,
						border: "1px solid #ccc",
						background: "#f6f6f6",
						cursor: "wait",
					}}
				>
					<span
						style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
					>
						<Spinner />
						Updating to v{latestVersion}...
					</span>
				</button>
			) : updateAvailable ? (
				<button
					type="button"
					onClick={handleUpdate}
					style={{
						padding: "6px 10px",
						borderRadius: 6,
						border: "1px solid #4caf50",
						background: "#4caf50",
						color: "white",
					}}
					title={`Update available: v${latestVersion}`}
				>
					Update to v{latestVersion}
				</button>
			) : (
				<span style={{ color: "#4caf50" }} title="No updates available">
					Up to date
				</span>
			)}

			{!checking && !updating && !!currentVersion && (
				<small style={{ color: "#666" }}>(current: v{currentVersion})</small>
			)}

			{!checking && !updating && (
				<button
					type="button"
					onClick={() => {
						// Manual re-check
						setChecking(true);
						setError("");
						setTimeout(async () => {
							try {
								const next = await fetchLatestVersion();
								setLatestVersion(next);
								setUpdateAvailable(compareSemver(next, currentVersion) > 0);
							} catch (e) {
								setError(stringifyError(e));
							} finally {
								setChecking(false);
							}
						}, 0);
					}}
					style={{
						padding: "4px 8px",
						borderRadius: 6,
						border: "1px solid #ccc",
						background: "#fff",
					}}
				>
					Re-check
				</button>
			)}

			{error && (
				<div
					style={{
						width: "100%",
						textAlign: "center",
						color: "#b00020",
						marginTop: 8,
					}}
				>
					{error}
				</div>
			)}

			{updating && updateLog && (
				<pre
					style={{
						width: "100%",
						maxWidth: 520,
						maxHeight: 160,
						overflow: "auto",
						background: "#111",
						color: "#ddd",
						padding: 10,
						borderRadius: 6,
						marginTop: 8,
					}}
				>
					{updateLog}
				</pre>
			)}
		</div>
	);
}

/**
 * Small inline spinner
 */
function Spinner() {
	return (
		<span
			aria-label="Loading"
			role="img"
			style={{
				width: 14,
				height: 14,
				display: "inline-block",
				border: "2px solid #ccc",
				borderTopColor: "#999",
				borderRadius: "50%",
				animation: "spin 0.9s linear infinite",
			}}
		/>
	);
}

// Inject minimal CSS keyframes for spinner
if (
	typeof document !== "undefined" &&
	!document.getElementById("app-updater-spinner-style")
) {
	const style = document.createElement("style");
	style.id = "app-updater-spinner-style";
	style.textContent = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
	document.head.appendChild(style);
}

/**
 * Fetch latest version string (e.g., "0.1.5") from GitHub releases
 */
async function fetchLatestVersion() {
	const resp = await fetch(
		"https://api.github.com/repos/Marcisbee/playwriter/releases/latest",
		{
			headers: {
				Accept: "application/vnd.github+json",
			},
		},
	);
	if (!resp.ok) {
		throw new Error(`Failed to fetch releases: HTTP ${resp.status}`);
	}
	const data = await resp.json();
	if (!data || !data.tag_name) {
		throw new Error("Unexpected release payload");
	}
	return normalizeVersion(String(data.tag_name));
}

/**
 * Normalizes various version formats:
 * - "v0.1.5" -> "0.1.5"
 * - "0.1.5 " -> "0.1.5"
 */
function normalizeVersion(v) {
	return v.trim().replace(/^v/i, "");
}

/**
 * Compare two semver-like strings.
 * Returns: -1 if a < b; 0 if equal; 1 if a > b
 */
function compareSemver(a, b) {
	const pa = parseSemver(a);
	const pb = parseSemver(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const na = pa[i] || 0;
		const nb = pb[i] || 0;
		if (na < nb) return -1;
		if (na > nb) return 1;
	}
	return 0;
}

/**
 * Parse "1.2.3" -> [1,2,3]
 */
function parseSemver(v) {
	return String(v)
		.split(".")
		.map((x) => Number.parseInt(x, 10))
		.map((n) => (Number.isFinite(n) ? n : 0));
}

function stringifyError(e) {
	if (!e) return "Unknown error";
	if (typeof e === "string") return e;
	if (e.message) return e.message;
	try {
		return JSON.stringify(e);
	} catch {
		return String(e);
	}
}

export default AppUpdater;
