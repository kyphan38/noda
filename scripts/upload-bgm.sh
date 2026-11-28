#!/usr/bin/env bash
# Uploads background music (media/bgm, git-ignored) to Cloud Storage defaults/bgm/
# and sets the bucket CORS the music player needs (Web Audio reads the file).
# Files never change in place: long cache, and re-running only copies new files.
# The track list lives in src/lib/bgMusic/tracks.ts.
#
# Prepare a file first (same loudness for every track):
#   ffmpeg -i in.mp3 -map 0:a:0 -map_metadata -1 -af "loudnorm=I=-18:TP=-1.5:LRA=11" \
#     -ar 44100 -ac 2 -c:a libmp3lame -b:a 128k media/bgm/<id>.mp3
#
# Needs gcloud signed in with access to the project.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="gs://kyphan38-noda-app.firebasestorage.app"
SRC="media/bgm"

[ -d "$SRC" ] || { echo "Nothing to upload: $SRC is missing"; exit 1; }

gsutil cors set storage.cors.json "$BUCKET"
# -n: skip files already in the bucket.
gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" -h "Content-Type:audio/mpeg" \
  cp -n "$SRC"/*.mp3 "$BUCKET/defaults/bgm/"

# getDownloadURL needs a download token, and gsutil uploads have none. The files stay
# readable only by the signed-in owner (storage.rules); the token goes into the URL.
for f in "$SRC"/*.mp3; do
  obj="$BUCKET/defaults/bgm/$(basename "$f")"
  if ! gsutil stat "$obj" | grep -q firebaseStorageDownloadTokens; then
    gsutil -q setmeta -h "x-goog-meta-firebaseStorageDownloadTokens:$(uuidgen | tr 'A-Z' 'a-z')" "$obj"
  fi
done
echo "Uploaded $SRC to $BUCKET/defaults/bgm/"
