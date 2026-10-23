#!/bin/sh
# Sends the films of GSS and their posters to the media bucket (Cloudflare R2), where the
# brand page reads them: https://media.gss-lang.dev/films/<file>. The films are rendered in
# video/*/out (not in git). Run `npx wrangler login` once first.
#
#   sh scripts/upload-films.sh
set -e
BUCKET="${BUCKET:-gss-media}"
cd "$(dirname "$0")/.."

# <the file in the bucket> <its folder in video/> <its name in the folder>
send() {
  key="$1" dir="video/$2/out" name="$3"
  for cut in "" "-vertical"; do
    npx wrangler r2 object put "$BUCKET/films/$key$cut.mp4" --file "$dir/$name$cut.mp4" --content-type video/mp4 --cache-control "public, max-age=31536000, immutable" --remote
    npx wrangler r2 object put "$BUCKET/films/$key$cut.jpg" --file "$dir/poster$cut.jpg" --content-type image/jpeg --cache-control "public, max-age=31536000, immutable" --remote
  done
}

send gss-0.0.7 v007 gss-0.0.7
send gss-0.0.6 v006 gss-0.0.6
send gss-launch launch gss-launch
send gss-teaser teaser gss-teaser
