import { filesystem, os, storage } from "@neutralinojs/lib";
import React, { useEffect, useState } from "react";
import { AppUpdater } from "./AppUpdater.jsx";
import { Project } from "./Project.jsx";

export function App() {
	const recentProjectsKey = "recentProjects";
	const [recentProjects, setRecentProjects] = useState([]);
	const [cwd, setCwd] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		const loadRecent = async () => {
			try {
				const data = await storage.getData(recentProjectsKey);
				if (data) {
					setRecentProjects(JSON.parse(data));
				}
			} catch (err) {
				console.error("Error loading recent projects:", err);
				setError("Failed to load recent projects list.");
			}
		};
		loadRecent();
	}, []);

	async function validateProject(dir) {
		try {
			await filesystem.readFile(dir + "/tasks.sh");
			return true;
		} catch (e) {
			console.error("Project validation failed:", e);
			return false;
		}
	}

	async function selectCdm() {
		setError("");
		const entry = await os.showFolderDialog("Select project directory");

		if (!entry) {
			return;
		}

		const valid = await validateProject(entry);
		if (!valid) {
			setError("Selected folder is not a valid project (missing tasks.sh).");
			return;
		}

		setCwd(entry);
		console.log("You have selected:", entry);
		const updatedRecent = [...new Set([entry, ...recentProjects])].slice(0, 10);
		setRecentProjects(updatedRecent);
		try {
			await storage.setData(recentProjectsKey, JSON.stringify(updatedRecent));
		} catch (err) {
			console.error("Error saving recent projects:", err);
			setError("Unable to persist recent projects.");
		}
	}

	async function loadProject(projectPath) {
		setError("");
		if (!projectPath) {
			console.error("Invalid project path selected from recent list.");
			setError("The selected recent project path is invalid.");
			await removeProject(projectPath);
			return;
		}
		const valid = await validateProject(projectPath);
		if (!valid) {
			setError(
				"Project no longer valid (tasks.sh missing). It was removed from the recent list.",
			);
			await removeProject(projectPath);
			return;
		}
		setCwd(projectPath);
	}

	async function removeProject(projectPath) {
		const updatedRecent = recentProjects.filter((p) => p !== projectPath);
		setRecentProjects(updatedRecent);
		try {
			await storage.setData(recentProjectsKey, JSON.stringify(updatedRecent));
		} catch (err) {
			console.error("Error saving recent projects after removal:", err);
			setError("Failed to update recent projects list.");
		}
	}

	if (!cwd) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					minHeight: "100vh",
					textAlign: "center",
				}}
			>
				<AppUpdater />
				<div style={{ flex: 1, alignContent: "center" }}>
					<button onClick={selectCdm}>Select Project Directory</button>
					{error && (
						<div
							style={{
								marginTop: "1rem",
								color: "#b00020",
								fontWeight: "bold",
								whiteSpace: "pre-wrap",
							}}
						>
							{error}
						</div>
					)}
				</div>
				{recentProjects.length > 0 && (
					<div
						style={{
							width: "100%",
							background: "#fff",
							borderTop: "2px solid #ccc",
							padding: 10,
						}}
					>
						<h3>Recent Projects:</h3>
						<ul
							style={{
								listStyle: "none",
								padding: 0,
								maxHeight: "300px",
								overflowY: "auto",
							}}
						>
							{recentProjects.map((proj) => (
								<li
									key={proj}
									style={{
										marginBottom: "10px",
										display: "flex",
										justifyContent: "center",
										alignItems: "center",
										gap: "10px",
									}}
								>
									<span
										style={{
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											maxWidth: "60%",
										}}
										title={proj}
									>
										{proj}
									</span>
									<button
										onClick={() => loadProject(proj)}
										style={{ marginLeft: "auto" }}
									>
										Load
									</button>
									<button
										onClick={() => removeProject(proj)}
										title="Remove from list"
									>
										X
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		);
	}

	return <Project cwd={cwd} />;
}
