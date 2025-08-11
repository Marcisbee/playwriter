// @ts-check
import { filesystem, os } from "@neutralinojs/lib";
import React, { useEffect, useState } from "react";

/**
 * @param {{ cwd: string }} props
 */
export function DynamicVariables({ cwd }) {
	const [tests, reloadTests] = useTestList(cwd);
	const [selectedTest, setSelectedTest] = useState(null); // State to track the selected test file path

	// Function to handle closing the EnvVarPanel
	const handleClosePanel = () => {
		setSelectedTest(null); // Clear the selected test
		reloadTests(); // Optionally reload the test list if changes might have occurred
	};

	return (
		<div>
			{!selectedTest ? (
				<>
					<h3>Select a Test File:</h3>
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
										{/* Display a more user-friendly name, e.g., relative path */}
										{testPath.replace(cwd + "/", "")}
									</button>
								</li>
							))}
						</ul>
					) : (
						<p>No test files found in 'session' or 'tests' directories.</p>
					)}
				</>
			) : (
				// Render EnvVarPanel when a test is selected
				<EnvVarPanel
					cwd={cwd}
					filePath={selectedTest}
					onClose={handleClosePanel} // Pass the close handler
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
		return escapeHtml(content); // No highlighting needed, just escape
	}

	const highlights = [];
	// Regex to find strings, capturing content within quotes
	const singleQuoteRegex = /'([^']*)'/g;
	const doubleQuoteRegex = /"([^"]*)"/g;
	const backtickRegex = /`([^`]*)`/g; // Template literals

	const findHighlightsInRegex = (regex) => {
		let match;
		while ((match = regex.exec(content)) !== null) {
			const fullMatch = match[0]; // e.g., 'some text'
			const innerContent = match[1]; // e.g., some text
			const quoteType = fullMatch[0]; // e.g., '
			const matchStartIndex = match.index; // Start index of the full quoted string in the original content

			let innerIndex = innerContent.indexOf(textToHighlight);
			while (innerIndex !== -1) {
				// Calculate the absolute start/end index in the original content string
				const start = matchStartIndex + quoteType.length + innerIndex;
				const end = start + textToHighlight.length;
				highlights.push({ start, end });
				// Find the next occurrence within the same innerContent
				innerIndex = innerContent.indexOf(textToHighlight, innerIndex + 1);
			}
		}
	};

	// Find highlights within each type of quote
	findHighlightsInRegex(singleQuoteRegex);
	findHighlightsInRegex(doubleQuoteRegex);
	findHighlightsInRegex(backtickRegex);

	// Sort highlights by start index to process the string sequentially
	highlights.sort((a, b) => a.start - b.start);

	let resultHtml = "";
	let lastIndex = 0;

	for (const highlight of highlights) {
		// Add text before the current highlight (escaped)
		resultHtml += escapeHtml(content.substring(lastIndex, highlight.start));
		// Add the highlighted text (escaped) wrapped in a span
		// Using inline style for simplicity, could use a CSS class
		resultHtml += `<span style="background-color: yellow;">${escapeHtml(content.substring(highlight.start, highlight.end))}</span>`;
		// Update the index to the end of the current highlight
		lastIndex = highlight.end;
	}

	// Add any remaining text after the last highlight (escaped)
	resultHtml += escapeHtml(content.substring(lastIndex));

	return resultHtml;
}
/**
 * Component for suggesting environment variable replacements
 * @param {{ filePath: string, onClose: () => void, cwd: string }} props
 */
function EnvVarPanel({ filePath, onClose, cwd }) {
	const [fileContent, setFileContent] = useState("");
	const [loading, setLoading] = useState(true);
	const [selectedVar, setSelectedVar] = useState("");
	const [customValue, setCustomValue] = useState("");
	const [highlightedContent, setHighlightedContent] = useState("");

	const [hasMatches, setHasMatches] = useState(false); // State to track if customValue has matches in strings
	const [envVars, setEnvVars] = useState([]);

	// Generate highlighted preview when content or value changes
	useEffect(() => {
		if (fileContent && customValue) {
			const previewHtml = generateHighlightedPreview(fileContent, customValue);
			setHighlightedContent(previewHtml);
		} else {
			// If no value to replace or no content, show plain escaped content
			setHighlightedContent(escapeHtml(fileContent));
		}
	}, [fileContent, customValue]);

	// Check for matches when fileContent or customValue changes
	useEffect(() => {
		if (!customValue || !fileContent) {
			setHasMatches(false);
			return;
		}

		let foundMatch = false;
		const singleQuoteRegex = /'([^']*)'/g;
		const doubleQuoteRegex = /"([^"]*)"/g;
		const backtickRegex = /`([^`]*)`/g; // Template literals

		const checkRegexForMatches = (regex) => {
			let match;
			while ((match = regex.exec(fileContent)) !== null) {
				const innerContent = match[1]; // e.g., some text
				if (innerContent.includes(customValue)) {
					foundMatch = true;
					return; // Exit early once a match is found in this regex
				}
			}
		};

		checkRegexForMatches(singleQuoteRegex);
		if (foundMatch) {
			setHasMatches(true);
			return;
		}

		checkRegexForMatches(doubleQuoteRegex);
		if (foundMatch) {
			setHasMatches(true);
			return;
		}

		checkRegexForMatches(backtickRegex);
		setHasMatches(foundMatch);
	}, [fileContent, customValue]);

	// Load environment variables from env.config
	useEffect(() => {
		async function loadEnvVars() {
			const configPath = `${cwd}/env.config`;
			try {
				const content = await filesystem.readFile(configPath);
				const lines = content.split("\n");
				const vars = lines
					.map((line) => line.trim()) // Trim whitespace
					.filter((line) => line && line.includes("=")) // Ensure line is not empty and contains '='
					.map((line) => line.split("=")[0].trim()) // Extract the key part
					.filter((key) => key); // Ensure key is not empty
				setEnvVars(vars); // Set the state with sorted keys
			} catch (error) {
				console.error(`Error reading or parsing ${configPath}:`, error);
				// Optionally set an empty array or handle the error state
				setEnvVars([]);
				// Maybe show an error message to the user
				// alert(`Could not load environment variables from ${configPath}. Please ensure the file exists and is readable.`);
			}
		}

		if (cwd) {
			loadEnvVars();
		}
	}, [cwd]); // Reload if cwd changes

	// Load file content when component mounts
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

	// Apply the replacement to the file
	async function applyReplacement() {
		try {
			if (!customValue || !selectedVar) return;

			let newContent = fileContent;

			// Find all string literals
			const singleQuoteRegex = /'([^']*)'/g;
			const doubleQuoteRegex = /"([^"]*)"/g;
			const backtickRegex = /`([^`]*)`/g;

			const replaceInRegex = (regex) => {
				let match;
				const positions = [];

				// First collect all positions to avoid offset issues
				while ((match = regex.exec(newContent)) !== null) {
					const fullMatch = match[0];
					const innerContent = match[1];

					if (innerContent.includes(customValue)) {
						positions.push({
							start: match.index,
							end: match.index + fullMatch.length,
							fullMatch,
							quoteType: fullMatch[0], // First character is the quote type
							innerContent,
						});
					}
				}

				// Sort from end to start to avoid offset issues
				positions.sort((a, b) => b.start - a.start);

				// Now replace them
				for (const pos of positions) {
					const { start, end, fullMatch, quoteType, innerContent } = pos;

					// Split the content by what we're replacing
					const parts = innerContent.split(customValue);

					// Create a template literal with the environment variable
					let newValue;
					if (quoteType === "`") {
						// It's already a template literal
						newValue = "`" + parts.join(`\${process.env.${selectedVar}}`) + "`";
					} else {
						// Convert to a template literal
						newValue = "`" + parts.join(`\${process.env.${selectedVar}}`) + "`";
					}

					// Replace in the content
					newContent =
						newContent.substring(0, start) +
						newValue +
						newContent.substring(end);
				}
			};

			// Apply regex replacements for each quote type
			replaceInRegex(singleQuoteRegex);
			replaceInRegex(doubleQuoteRegex);
			replaceInRegex(backtickRegex);

			// Save the file
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
							autocomplete="off"
							autocorrect="off"
							autocapitalize="off"
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
					Apply Replacement{!hasMatches && customValue && " (No matches found)"}
				</button>
				<button onClick={onClose} style={{ marginLeft: "10px" }}>
					Cancel
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
					{/* Render the HTML with highlights */}
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
 * @param {string} dirPath The path to the directory to read.
 * @returns {Promise<string[]>} A promise that resolves with an array of file paths.
 */
async function readFilesRecursively(dirPath) {
	let files = [];
	try {
		const entries = await filesystem.readDirectory(dirPath);

		for (const entry of entries) {
			// Construct the full path using the directory path and the entry name
			// Assuming '/' works as a separator, or use os.getPathSeparator() if needed
			const fullPath = `${dirPath}/${entry.entry}`;

			if (entry.type === "FILE") {
				files.push(fullPath);
			} else if (entry.type === "DIRECTORY") {
				// If it's a directory, recurse into it
				const subFiles = await readFilesRecursively(fullPath);
				files = files.concat(subFiles); // Add the files found in the subdirectory
			}
		}
	} catch (error) {
		// Log the error or handle it appropriately
		console.error(`Error reading directory ${dirPath}:`, error);
		// Depending on requirements, you might want to re-throw the error
		// or return the files collected so far, or an empty array.
		// throw error; // Option: re-throw
	}
	return files;
}

/**
 * Hook for managing auth list from the project directory
 * @param {string} cwd Current working directory
 * @returns {[any[], Function]} Auth list and reload function
 */
export function useTestList(cwd) {
	const [list, setList] = useState([]);

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
			console.error("Error loading auth list:", error);
			setList([]);
		}
	}

	return [list, reloadAuthList];
}
