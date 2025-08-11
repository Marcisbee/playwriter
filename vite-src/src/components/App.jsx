import { filesystem, os, storage } from "@neutralinojs/lib";
import React, { useEffect, useState } from "react";

import { Project } from "./Project.jsx";

export function App() {
	const recentProjectsKey = "recentProjects";
	const [recentProjects, setRecentProjects] = useState([]);
	const [cwd, setCwd] = useState("");
	useEffect(() => {
		const loadRecent = async () => {
			try {
				const data = await storage.getData(recentProjectsKey);
				if (data) {
					setRecentProjects(JSON.parse(data));
				}
			} catch (err) {
				console.error("Error loading recent projects:", err);
				// Optionally clear broken storage data
				// await storage.setData(recentProjectsKey, JSON.stringify([]));
			}
		};
		loadRecent();
	}, []); // Empty dependency array ensures this runs only once on mount

	async function selectCdm() {
		const entry = await os.showFolderDialog("Select project directory");

		if (!entry) {
			return;
		}

		try {
			const tasksFile = await filesystem.readFile(entry + "/tasks.sh");

			if (!tasksFile) {
				throw new Error("Project not found");
			}
		} catch (e) {
			console.error(e);
			return;
		}

		setCwd(entry);
		console.log("You have selected:", entry);
		// Add to recent projects and save
		const updatedRecent = [...new Set([entry, ...recentProjects])].slice(0, 10); // Keep max 10, add new to front
		setRecentProjects(updatedRecent);
		try {
			await storage.setData(recentProjectsKey, JSON.stringify(updatedRecent));
		} catch (err) {
			console.error("Error saving recent projects:", err);
		}
	}

	async function loadProject(projectPath) {
		// Basic check if path still seems valid (optional, could re-validate fully)
		if (projectPath) {
			// We assume the path is valid as it was previously added.
			// For robustness, you could re-run the validation logic from selectCdm here.
			setCwd(projectPath);
		} else {
			console.error("Invalid project path selected from recent list.");
			// Optionally remove the invalid path from the list
			await removeProject(projectPath);
		}
	}

	async function removeProject(projectPath) {
		const updatedRecent = recentProjects.filter((p) => p !== projectPath);
		setRecentProjects(updatedRecent);
		try {
			await storage.setData(recentProjectsKey, JSON.stringify(updatedRecent));
		} catch (err) {
			console.error("Error saving recent projects after removal:", err);
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
				<div>
					<button onClick={selectCdm}>Select Project Directory</button>
				</div>
				{recentProjects.length > 0 && (
					<div
						style={{
							position: "absolute",
							bottom: 0,
							left: 0,
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
										}}
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
