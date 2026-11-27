# The demo video's narration: one audio file a scene, with the time of every word.
# The words are read from docs/demo-script.md ("The words alone"), so the voice cannot drift from the script.
# Voice: edge-tts (a Microsoft neural voice; the narration text is sent to Microsoft's speech service).
# Usage: python scripts/demo/voice.py [--out E:/still-recalled-video/build/voice] [--voice en-US-AndrewNeural] [--rate=-4%]
import argparse, asyncio, json, os, re, sys
import edge_tts

p = argparse.ArgumentParser()
p.add_argument('--out', default='E:/still-recalled-video/build/voice')
p.add_argument('--voice', default='en-US-AndrewNeural')
p.add_argument('--rate', default='+0%')
p.add_argument('--pitch', default='+0Hz')
p.add_argument('--script', default='docs/demo-script.md')
a = p.parse_args()
os.makedirs(a.out, exist_ok=True)

text = open(a.script, encoding='utf-8').read().replace('\r\n', '\n')
block = text.split('## The words alone', 1)[1].split('\n## ', 1)[0]
scenes = [re.sub(r'\s+', ' ', m).strip() for m in re.findall(r'^\d+\.\s+(.*?)(?=^\d+\.\s|\Z)', block, flags=re.S | re.M)]
if len(scenes) != 9:
    sys.exit(f'expected 9 scenes in "The words alone", found {len(scenes)}')

# Said differently from how it is written: a recall number is read digit by digit.
SPOKEN = {'23088': '2 3 0 8 8'}

async def one(i, shown):
    spoken = shown
    for k, v in SPOKEN.items():
        spoken = spoken.replace(k, v)
    words, audio = [], bytearray()
    com = edge_tts.Communicate(spoken, a.voice, rate=a.rate, pitch=a.pitch, boundary='WordBoundary')
    async for ev in com.stream():
        if ev['type'] == 'audio':
            audio.extend(ev['data'])
        elif ev['type'] == 'WordBoundary':
            words.append({'t': ev['offset'] / 1e7, 'd': ev['duration'] / 1e7, 'w': ev['text']})
    with open(os.path.join(a.out, f'scene-{i}.mp3'), 'wb') as f:
        f.write(audio)
    return {'scene': i, 'shown': shown, 'spoken': spoken, 'words': words}

async def main():
    out = []
    for i, s in enumerate(scenes, 1):
        for attempt in range(3):
            try:
                out.append(await one(i, s))
                break
            except Exception as e:  # the speech service drops a connection now and then
                if attempt == 2:
                    raise
                await asyncio.sleep(2)
        print(i, len(out[-1]['words']), 'words', round(out[-1]['words'][-1]['t'] + out[-1]['words'][-1]['d'], 2), 's')
    json.dump({'voice': a.voice, 'rate': a.rate, 'pitch': a.pitch, 'spokenAs': SPOKEN, 'scenes': out},
              open(os.path.join(a.out, 'voice.json'), 'w', encoding='utf-8'), indent=1)

asyncio.run(main())
