#!/bin/bash
trap '' SIGHUP SIGTERM
cd /home/z/my-project/mini-services/jobs
exec bun --hot index.ts
