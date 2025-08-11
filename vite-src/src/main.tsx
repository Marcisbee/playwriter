import { createRoot } from "react-dom/client";
import { App } from "./components/App.jsx";
import "./reset.css";
import "./styles.css";

import { init, window as nlWindow } from "@neutralinojs/lib";

createRoot(document.getElementById("root")!).render(
	<>
		<App />
	</>,
);

(async () => {
	await init();

	// Enable native Edit menu with macOS accelerators (Cmd+X/C/V)
	if ((window as any).NL_OS === "Darwin") {
		const menu = [
			{
				id: "edit",
				text: "Edit",
				menuItems: [
					{ id: "cut", text: "Cut", action: "cut:", shortcut: "x" },
					{ id: "copy", text: "Copy", action: "copy:", shortcut: "c" },
					{ id: "paste", text: "Paste", action: "paste:", shortcut: "v" },
					{ id: "undo", text: "Undo", action: "undo:", shortcut: "z" },
					{
						id: "selectAll",
						text: "Select All",
						action: "selectAll:",
						shortcut: "a",
					},
				],
			},
		];
		try {
			await nlWindow.setMainMenu(menu);
		} catch (e) {
			console.error("Failed to set macOS main menu", e);
		}
	}
})();
