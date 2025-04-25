import { createRoot } from "react-dom/client";
import { App } from "./components/App.jsx";
import "./reset.css";
import "./styles.css";

import { init } from "@neutralinojs/lib";

createRoot(document.getElementById("root")!).render(
	<>
		<App />
	</>
);

init();
