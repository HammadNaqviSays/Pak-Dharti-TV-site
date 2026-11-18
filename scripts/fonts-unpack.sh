#!/usr/bin/env bash
# Decrypts private/fonts.tgz.enc into public/fonts (needs env FONTS_KEY). Fonts with unclear licences are not stored in git in plain form.
set -e
[ -n "$FONTS_KEY" ] || { echo "FONTS_KEY missing"; exit 1; }
printf '%s' "$FONTS_KEY" | openssl enc -d -aes-256-cbc -pbkdf2 -in private/fonts.tgz.enc -pass stdin | tar xz
ls public/fonts/urdu | wc -l
