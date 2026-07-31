#!/bin/bash
# Watchdog: keeps the Next.js dev server and jobs service alive.
# Checks every 10 seconds, restarts if dead.
while true; do
  # Check Next.js
  if ! curl -s -o /dev/null http://localhost:3000/api/health 2>/dev/null; then
    echo "[$(date)] Next.js down — restarting..."
    pkill -f "next dev" 2>/dev/null
    sleep 1
    cd /home/z/my-project
    setsid /home/z/my-project/start-next.sh > /tmp/dev-next.log 2>&1 &
  fi
  # Check jobs service
  if ! pgrep -f "jobs/index" > /dev/null 2>&1; then
    echo "[$(date)] Jobs service down — restarting..."
    cd /home/z/my-project/mini-services/jobs
    setsid /home/z/my-project/start-jobs.sh > /tmp/dev-jobs.log 2>&1 &
  fi
  sleep 10
done
