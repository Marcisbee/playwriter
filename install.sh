#!/usr/bin/env bash

# Download the Playwriter.zip archive
curl -L -o Playwriter.zip "https://github.com/Marcisbee/playwriter/releases/download/v0.1.6/Playwriter.zip"

# Extract the archive to the current directory
unzip -o Playwriter.zip

# Remove the zip file after extraction (optional)
rm Playwriter.zip
rm -rf __MACOSX
