import { filesystem, os } from "@neutralinojs/lib";
import { useEffect, useState } from "react";

/**
 * Hook for managing auth list from the project directory
 * @param {os.SpawnedProcess | null} proc The process to monitor
 * @param {Function} reset Function to reset any related state
 * @param {string} cwd Current working directory
 * @returns {[any[], Function]} Auth list and reload function
 */
export function useAuthList(proc, reset, cwd) {
	const [authList, setAuthList] = useState([]);

	useEffect(() => {
		reloadAuthList();

		if (!proc) {
			reset();
		}
	}, [proc]);

	useEffect(() => {
		window.addEventListener("focus", reloadAuthList);

		return () => {
			window.removeEventListener("focus", reloadAuthList);
		};
	}, [proc]);

	async function reloadAuthList() {
		try {
			const sessionPath = `${cwd}/session/`;
			const entries = await filesystem.readDirectory(sessionPath);

			const entriesWithAuth = (
				await Promise.all(
					entries
						.filter((entry) => entry.type === "DIRECTORY")
						.sort((a, b) => a.path.localeCompare(b.path))
						.map(async (entry) => {
							const absDir = entry.path;
							try {
								const content = await filesystem.readFile(
									`${absDir}/auth.json`,
								);
								if (!content) return null;
								const relPath = absDir.startsWith(cwd + "/")
									? absDir.slice(cwd.length + 1)
									: absDir;
								return { ...entry, path: relPath, absolutePath: absDir };
							} catch {
								return null;
							}
						}),
				)
			).filter(Boolean);

			setAuthList(entriesWithAuth);
		} catch (error) {
			console.error("Error loading auth list:", error);
			setAuthList([]);
		}
	}

	return [authList, reloadAuthList];
}
