// @ts-check
import { filesystem, os } from "@neutralinojs/lib";
import React, { useCallback, useEffect, useState } from "react";

/**
 * @param {{ cwd: string }} props
 */
export function DynamicVariables({ cwd }) {
	// Test file list / selection
	const [tests, reloadTests] = useTestList(cwd);
	const [selectedTest, setSelectedTest] = useState(
		/** @type {string|null} */ (null),
	);

	// Environment variable list
	const [envVars, setEnvVars] = useState(/** @type {string[]} */ ([]));

	// Dynamic variable creation state (moved outside the EnvVarPanel)
	const [types, setTypes] = useState(/** @type {string[]} */ ([]));
	const [loadingTypes, setLoadingTypes] = useState(true);
	const [newVarName, setNewVarName] = useState("");
	const [newVarType, setNewVarType] = useState("");

	// Reload env vars
	const reloadEnvVars = useCallback(async () => {
		if (!cwd) return;
		const configPath = `${cwd}/env.config`;
		try {
			const content = await filesystem.readFile(configPath);
			const lines = content.split("\n");
			const vars = lines
				.map((line) => line.trim())
				.filter((line) => line && line.includes("="))
				.map((line) => line.split("=")[0].trim())
				.filter((key) => key);
			setEnvVars(vars);
		} catch {
			setEnvVars([]);
		}
	}, [cwd]);

	useEffect(() => {
		reloadEnvVars();
	}, [reloadEnvVars]);

	// Fetch available types once (or when cwd changes)
	useEffect(() => {
		async function fetchTypes() {
			if (!cwd) return;
			setLoadingTypes(true);
			try {
				const cmd = `PLAYWRIGHT_FORCE_TTY=0 FORCE_COLOR=0 ./tasks.sh types`;
				const result = await os.execCommand(cmd, { cwd });
				setTypes(JSON.parse(result.stdOut.split("\n")[1]) || []);
			} catch (error) {
				console.error("Error spawning types process:", error);
				setTypes([]);
			} finally {
				setLoadingTypes(false);
			}
		}
		fetchTypes();
	}, [cwd]);

	const normalizedNewVarName = newVarName
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9_]/g, "_");
	const duplicateVar =
		!!normalizedNewVarName && envVars.includes(normalizedNewVarName);

	// Add new variable (same logic moved from EnvVarPanel)
	async function addVariable() {
		try {
			const rawName = newVarName.trim();
			if (!rawName || !newVarType) return;

			const varName = rawName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
			if (envVars.includes(varName)) {
				alert(`Variable ${varName} already exists.`);
				return;
			}

			const configPath = `${cwd}/env.config`;
			let existing = "";
			try {
				existing = await filesystem.readFile(configPath);
			} catch {
				// file may not exist yet
			}

			let toWrite = existing;
			if (toWrite && !/\n$/.test(toWrite)) {
				toWrite += "\n";
			}
			toWrite += `${varName}=${newVarType}\n`;

			await filesystem.writeFile(configPath, toWrite);
			setEnvVars((prev) => [...prev, varName]);
			setNewVarName("");
			setNewVarType("");
			alert(`Added variable ${varName} with type/value '${newVarType}'.`);
		} catch (error) {
			console.error("Error adding variable:", error);
			alert("Error adding variable: " + error.message);
		}
	}

	const handleClosePanel = () => {
		setSelectedTest(null);
		reloadTests();
		// Reload env vars in case a test modified env.config
		reloadEnvVars();
	};

	return (
		<div>
			{/* Dynamic variable creation UI moved here, always visible */}
			<section style={{ marginBottom: "20px" }}>
				<details>
					<summary>
						Create new dynamic variable
					</summary>
					<div style={{ padding: "8px 10px" }}>
						<label style={{ display: "block", marginBottom: "6px" }}>
							<span>Variable name (UPPER_CASE recommended)</span>
							<br />
							<input
								type="text"
								value={newVarName}
								onChange={(e) => setNewVarName(e.target.value)}
								placeholder="MY_VARIABLE"
								style={{ width: "100%", maxWidth: "320px" }}
								autoComplete="off"
							/>
						</label>
						<label style={{ display: "block", marginBottom: "6px" }}>
							<span>Type / Value</span>
							<br />
							<select
								value={newVarType}
								onChange={(e) => setNewVarType(e.target.value)}
								style={{ width: "100%", maxWidth: "320px" }}
							>
								<option value="">
									{loadingTypes ? "Loading..." : "Select a type"}
								</option>
								{types.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
							{!loadingTypes && !types.length && (
								<span
									style={{
										display: "block",
										fontSize: "0.75em",
										color: "#666",
										marginTop: "4px",
									}}
								>
									No types detected (ensure tasks.sh types works)
								</span>
							)}
						</label>
						<button
							type="button"
							onClick={addVariable}
							style={
								!newVarName ||
								!newVarType ||
								duplicateVar ||
								loadingTypes ||
								!types.length
									? { cursor: "not-allowed" }
									: { backgroundColor: "dodgerblue", color: "white" }
							}
							disabled={
								!newVarName ||
								!newVarType ||
								duplicateVar ||
								loadingTypes ||
								!types.length
							}
						>
							Add variable
						</button>
						{duplicateVar && (
							<div
								style={{ color: "red", fontSize: "0.75em", marginTop: "4px" }}
							>
								Variable already exists.
							</div>
						)}
						{newVarName && !duplicateVar && (
							<div
								style={{ fontSize: "0.7em", marginTop: "4px", color: "#555" }}
							>
								Saved as {normalizedNewVarName}={newVarType || "<type>"}
							</div>
						)}
					</div>
				</details>
			</section>

			{/* Test selection OR panel */}
			{!selectedTest ? (
				<>
					<h3 style={{ marginTop: 0 }}>Select a Test File:</h3>
					{tests.length > 0 ? (
						<ul>
							{tests.map((testPath) => (
								<li key={testPath} style={{ marginBottom: "5px" }}>
									<button
										onClick={() => setSelectedTest(testPath)}
										style={{
											display: "block",
											width: "100%",
											textAlign: "left",
										}}
									>
										{testPath.replace(cwd + "/", "")}
									</button>
								</li>
							))}
						</ul>
					) : (
						<p style={{ fontSize: "0.9em" }}>
							No test files found in 'session' or 'tests' directories.
						</p>
					)}
				</>
			) : (
				<EnvVarPanel
					cwd={cwd}
					filePath={selectedTest}
					onClose={handleClosePanel}
					envVars={envVars}
				/>
			)}
		</div>
	);
}

// Helper function to escape HTML characters
function escapeHtml(unsafe) {
	if (!unsafe) return "";
	return unsafe
		.replace(/&amp;/g, "&amp;")
		.replace(/&lt;/g, "&lt;")
		.replace(/&gt;/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// Function to generate highlighted preview HTML based on matches within quotes
function generateHighlightedPreview(content, textToHighlight) {
	if (!textToHighlight) {
		return escapeHtml(content);
	}

	const highlights = [];
	const singleQuoteRegex = /'([^']*)'/g;
	const doubleQuoteRegex = /"([^"]*)"/g;
	const backtickRegex = /`([^`]*)`/g;

	const findHighlightsInRegex = (regex) => {
		let match;
		while ((match = regex.exec(content)) !== null) {
			const fullMatch = match[0];
			const innerContent = match[1];
			const quoteType = fullMatch[0];
			const matchStartIndex = match.index;

			let innerIndex = innerContent.indexOf(textToHighlight);
			while (innerIndex !== -1) {
				const start = matchStartIndex + quoteType.length + innerIndex;
				const end = start + textToHighlight.length;
				highlights.push({ start, end });
				innerIndex = innerContent.indexOf(textToHighlight, innerIndex + 1);
			}
		}
	};

	findHighlightsInRegex(singleQuoteRegex);
	findHighlightsInRegex(doubleQuoteRegex);
	findHighlightsInRegex(backtickRegex);

	highlights.sort((a, b) => a.start - b.start);

	let resultHtml = "";
	let lastIndex = 0;

	for (const highlight of highlights) {
		resultHtml += escapeHtml(content.substring(lastIndex, highlight.start));
		resultHtml += `<span style="background-color: yellow;">${escapeHtml(
			content.substring(highlight.start, highlight.end),
		)}</span>`;
		lastIndex = highlight.end;
	}

	resultHtml += escapeHtml(content.substring(lastIndex));
	return resultHtml;
}

/**
 * Component for suggesting environment variable replacements
 * @param {{ filePath: string, onClose: () => void, cwd: string, envVars: string[] }} props
 */
function EnvVarPanel({ filePath, onClose, cwd, envVars }) {
	const [fileContent, setFileContent] = useState("");
	const [loading, setLoading] = useState(true);
	const [selectedVar, setSelectedVar] = useState("");
	const [customValue, setCustomValue] = useState("");
	const [highlightedContent, setHighlightedContent] = useState("");
	const [hasMatches, setHasMatches] = useState(false);

	// Load file content
	useEffect(() => {
		async function loadFile() {
			try {
				setLoading(true);
				if (!filePath) return;
				const content = await filesystem.readFile(filePath);
				setFileContent(content);
			} catch (error) {
				console.error("Error reading file:", error);
			} finally {
				setLoading(false);
			}
		}
		loadFile();
	}, [filePath]);

	// Highlight preview
	useEffect(() => {
		if (fileContent && customValue) {
			const previewHtml = generateHighlightedPreview(fileContent, customValue);
			setHighlightedContent(previewHtml);
		} else {
			setHighlightedContent(escapeHtml(fileContent));
		}
	}, [fileContent, customValue]);

	// Detect matches
	useEffect(() => {
		if (!customValue || !fileContent) {
			setHasMatches(false);
			return;
		}

		let foundMatch = false;
		const singleQuoteRegex = /'([^']*)'/g;
		const doubleQuoteRegex = /"([^"]*)"/g;
		const backtickRegex = /`([^`]*)`/g;

		const checkRegex = (regex) => {
			let match;
			while ((match = regex.exec(fileContent)) !== null) {
				if (match[1].includes(customValue)) {
					foundMatch = true;
					return;
				}
			}
		};

		checkRegex(singleQuoteRegex);
		if (!foundMatch) checkRegex(doubleQuoteRegex);
		if (!foundMatch) checkRegex(backtickRegex);

		setHasMatches(foundMatch);
	}, [fileContent, customValue]);

	// Apply replacement
	async function applyReplacement() {
		try {
			if (!customValue || !selectedVar) return;
			let newContent = fileContent;

			const singleQuoteRegex = /'([^']*)'/g;
			const doubleQuoteRegex = /"([^"]*)"/g;
			const backtickRegex = /`([^`]*)`/g;

			const replaceInRegex = (regex) => {
				let match;
				const positions = [];
				while ((match = regex.exec(newContent)) !== null) {
					const fullMatch = match[0];
					const innerContent = match[1];
					if (innerContent.includes(customValue)) {
						positions.push({
							start: match.index,
							end: match.index + fullMatch.length,
							fullMatch,
							quoteType: fullMatch[0],
							innerContent,
						});
					}
				}
				positions.sort((a, b) => b.start - a.start);
				for (const pos of positions) {
					const { start, end, quoteType, innerContent } = pos;
					const parts = innerContent.split(customValue);
					let newValue;
					// We always convert to a template literal
					if (quoteType === "`") {
						newValue = "`" + parts.join(`\${process.env.${selectedVar}}`) + "`";
					} else {
						newValue = "`" + parts.join(`\${process.env.${selectedVar}}`) + "`";
					}
					newContent =
						newContent.substring(0, start) +
						newValue +
						newContent.substring(end);
				}
			};

			replaceInRegex(singleQuoteRegex);
			replaceInRegex(doubleQuoteRegex);
			replaceInRegex(backtickRegex);

			await filesystem.writeFile(filePath, newContent);
			alert(
				`Applied environment variable replacements for "${customValue}" with process.env.${selectedVar}`,
			);
			onClose();
		} catch (error) {
			console.error("Error applying replacements:", error);
			alert("Error applying replacements: " + error.message);
		}
	}

	if (loading) {
		return (
			<div className="var-replace">
				<h3>Loading file content...</h3>
			</div>
		);
	}

	return (
		<div className="var-replace">
			<p>
				<strong>{filePath.slice(cwd.length + 1)}</strong>
			</p>

			<div>
				<div style={{ marginBottom: "10px" }}>
					<label>
						<span>Text to replace:</span>
						<br />
						<input
							type="text"
							value={customValue}
							onChange={(e) => setCustomValue(e.target.value)}
							placeholder="Enter text to replace"
							style={{ width: "100%", maxWidth: "300px" }}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
						/>
					</label>
				</div>

				<div style={{ marginBottom: "10px" }}>
					<label>
						<span>Dynamic variable:</span>
						<br />
						<select
							value={selectedVar}
							onChange={(e) => setSelectedVar(e.target.value)}
							style={{ width: "100%", maxWidth: "300px" }}
						>
							<option value="">Select a variable name</option>
							{envVars.map((envVar, index) => (
								<option key={index} value={envVar}>
									{envVar}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>

			<div style={{ marginTop: "20px" }}>
				<button
					onClick={applyReplacement}
					disabled={!selectedVar || !customValue || !hasMatches}
				>
					Apply Replacement
					{!hasMatches && customValue && " (No matches found)"}
				</button>
				<button onClick={onClose} style={{ marginLeft: "10px" }}>
					Back
				</button>
			</div>

			<div
				style={{
					marginTop: "20px",
					border: "1px solid #ccc",
					padding: "10px",
					maxHeight: "300px",
					overflowY: "auto",
					background: "#f9f9f9",
				}}
			>
				<p
					style={{
						marginTop: "0",
						marginBottom: "5px",
						fontSize: "0.9em",
						color: "#333",
					}}
				>
					{customValue
						? `Preview (occurrences inside quotes matching "${customValue}" will be highlighted):`
						: "File Content Preview:"}
				</p>
				<pre
					style={{
						whiteSpace: "pre-wrap",
						wordWrap: "break-word",
						margin: "0",
						fontSize: "0.85em",
					}}
				>
					<code dangerouslySetInnerHTML={{ __html: highlightedContent }} />
				</pre>
			</div>

			{customValue && selectedVar && (
				<div style={{ marginTop: "10px" }}>
					<p>
						Preview: <code>{customValue}</code> →{" "}
						<code>${"{process.env." + selectedVar + "}"}</code>
					</p>
				</div>
			)}
		</div>
	);
}

/**
 * Reads all files recursively from a given directory.
 * @param {string} dirPath
 * @returns {Promise<string[]>}
 */
async function readFilesRecursively(dirPath) {
	let files = [];
	try {
		const entries = await filesystem.readDirectory(dirPath);
		for (const entry of entries) {
			const fullPath = `${dirPath}/${entry.entry}`;
			if (entry.type === "FILE") {
				files.push(fullPath);
			} else if (entry.type === "DIRECTORY") {
				const subFiles = await readFilesRecursively(fullPath);
				files = files.concat(subFiles);
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${dirPath}:`, error);
	}
	return files;
}

/**
 * Hook for managing test list from the project directory
 * @param {string} cwd
 * @returns {[string[], Function]}
 */
export function useTestList(cwd) {
	const [list, setList] = useState(/** @type {string[]} */ ([]));

	useEffect(() => {
		reloadAuthList();
	}, []);

	useEffect(() => {
		window.addEventListener("focus", reloadAuthList);
		return () => {
			window.removeEventListener("focus", reloadAuthList);
		};
	}, []);

	async function reloadAuthList() {
		try {
			const entriesSession = (
				await readFilesRecursively(`${cwd}/session`)
			).filter((filePath) => filePath.endsWith(".ts"));
			const entriesTests = (await readFilesRecursively(`${cwd}/tests`)).filter(
				(filePath) => filePath.endsWith(".ts"),
			);
			setList([...entriesSession, ...entriesTests].sort());
		} catch (error) {
			console.error("Error loading test list:", error);
			setList([]);
		}
	}

	return [list, reloadAuthList];
}
