#!/bin/sh
set -eu

expected='/vr/finomir/'

check_contains() {
    file=$1
    value=$2
    if ! grep -F "$value" "$file" >/dev/null; then
        echo "Ошибка: $file не содержит $value" >&2
        exit 1
    fi
}

check_contains .env.example "BASE_PATH=$expected"
check_contains .env.example "VITE_BASE_PATH=$expected"
check_contains deploy/nginx-location.conf "location $expected"
check_contains deploy/nginx-location.conf 'location /vr/finomir/api/'
check_contains frontend/public/manifest.webmanifest '"start_url":"./"'
check_contains frontend/public/manifest.webmanifest '"scope":"./"'
check_contains frontend/public/sw.js "self.skipWaiting()"
check_contains frontend/public/sw.js "self.clients.claim()"
check_contains frontend/nginx.conf "location = /sw.js"

echo "Base path $expected согласован для env, Nginx и PWA."
