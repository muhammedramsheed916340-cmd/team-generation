#!/bin/bash
# Keep-alive wrapper for dev services
trap '' SIGHUP SIGTERM
cd /home/z/my-project
exec npx next dev -p 3000
