#!/bin/sh
# 去掉语音首尾静音并压缩到 32kbps（只处理尚未压缩的文件）
cd "$(dirname "$0")/../assets/voice"
mkdir -p /tmp/vtrim
if [ -n "$1" ]; then
  ffmpeg -nostdin -loglevel error -y -i "$1" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse" -ac 1 -ar 24000 -b:a 32k "/tmp/vtrim/$1" && mv "/tmp/vtrim/$1" "$1"
  exit
fi
for f in *.mp3; do
  [ "$(ffprobe -v error -show_entries stream=bit_rate -of csv=p=0 "$f")" = "32000" ] || echo "$f"
done | xargs -P 10 -n 1 sh "$(pwd)/../../tools/trim_voice.sh"
