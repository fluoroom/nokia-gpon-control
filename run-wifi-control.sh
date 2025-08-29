#!/bin/bash
export DISPLAY=:99
Xvfb :99 -ac -screen 0 1280x1024x24 2>/dev/null &
xvfb_pid=$!
node nokia-gpon-ctl.js "$@"
kill $xvfb_pid 