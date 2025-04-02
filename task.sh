#!/usr/bin/env bash

# ./tasks.sh upgrade
task_update() {
  npx @neutralinojs/neu update
}

# ./tasks.sh run
task_run() {
  npx @neutralinojs/neu run
}

# ./tasks.sh build
task_build() {
  ./build-mac.sh
}
