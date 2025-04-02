// @ts-check
import { render, html } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

import { App } from "./app.mjs";

// @ts-ignore
render(html`<${App} />`, app);

/*
    Function to handle the window close event by gracefully exiting the Neutralino application.
*/
function onWindowClose() {
  Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("windowClose", onWindowClose);
