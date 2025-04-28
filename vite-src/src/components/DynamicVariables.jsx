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
                <li key={testPath} style={{ marginBottom: '5px' }}>
                  <button onClick={() => setSelectedTest(testPath)} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                    {/* Display a more user-friendly name, e.g., relative path */}
                    {testPath.replace(cwd + '/', '')}
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

/**
 * Component for suggesting environment variable replacements
 * @param {{ filePath: string, onClose: () => void, cwd: string }} props
 */
function EnvVarPanel({ filePath, onClose, cwd }) {
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedVar, setSelectedVar] = useState("");
  const [customValue, setCustomValue] = useState("");

  const [envVars, setEnvVars] = useState([]);

  // Load environment variables from env.config
  useEffect(() => {
    async function loadEnvVars() {
      const configPath = `${cwd}/env.config`;
      try {
        const content = await filesystem.readFile(configPath);
        const lines = content.split('\n');
        const vars = lines
          .map(line => line.trim()) // Trim whitespace
          .filter(line => line && line.includes('=')) // Ensure line is not empty and contains '='
          .map(line => line.split('=')[0].trim()) // Extract the key part
          .filter(key => key); // Ensure key is not empty
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
        let positions = [];

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
              innerContent
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
          if (quoteType === '`') {
            // It's already a template literal
            newValue = '`' + parts.join(`\${process.env.${selectedVar}}`) + '`';
          } else {
            // Convert to a template literal
            newValue = '`' + parts.join(`\${process.env.${selectedVar}}`) + '`';
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
      alert(`Applied environment variable replacements for "${customValue}" with process.env.${selectedVar}`);
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
      <p style={{ marginBottom: '15px', fontStyle: 'italic', color: '#666' }}>
        Editing file: <code>{filePath}</code>
      </p>
      <p>Enter text to replace with an dynamic variable:</p>

      <div>
        <div style={{ marginBottom: '10px' }}>
          <label>
            <span>Text to replace:</span>
            <br />
            <input
              type="text"
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              placeholder="Enter text to replace"
              style={{ width: '100%', maxWidth: '300px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>
            <span>Dynamic variable:</span>
            <br />
            <select
              value={selectedVar}
              onChange={e => setSelectedVar(e.target.value)}
              style={{ width: '100%', maxWidth: '300px' }}
            >
              <option value="">Select a variable name</option>
              {envVars.map((envVar, index) => (
                <option key={index} value={envVar}>{envVar}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={applyReplacement}
          disabled={!selectedVar || !customValue}
        >
          Apply Replacement
        </button>
        <button onClick={onClose} style={{ marginLeft: '10px' }}>
          Cancel
        </button>
      </div>

      {customValue && selectedVar && (
        <div style={{ marginTop: '10px' }}>
          <p>Preview: <code>{customValue}</code> → <code>${'{process.env.' + selectedVar + '}'}</code></p>
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

      if (entry.type === 'FILE') {
        files.push(fullPath);
      } else if (entry.type === 'DIRECTORY') {
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
      const entriesSession = (await readFilesRecursively(`${cwd}/session`)).filter(filePath => filePath.endsWith('.ts'));
      const entriesTests = (await readFilesRecursively(`${cwd}/tests`)).filter(filePath => filePath.endsWith('.ts'));

      setList([...entriesSession, ...entriesTests].sort());
    } catch (error) {
      console.error("Error loading auth list:", error);
      setList([]);
    }
  }

  return [list, reloadAuthList];
}
