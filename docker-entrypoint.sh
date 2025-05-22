#!/bin/sh

# Replace environment variables in the env-config.js file
envsubst < /usr/share/nginx/html/env-config.js.template > /usr/share/nginx/html/env-config.js

# Start nginx
exec nginx -g 'daemon off;'
