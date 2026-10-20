# hls-vodtolive

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Coverage Status](https://coveralls.io/repos/github/Eyevinn/hls-vodtolive/badge.svg?branch=master)](https://coveralls.io/github/Eyevinn/hls-vodtolive?branch=master) [![Slack](http://slack.streamingtech.se/badge.svg)](http://slack.streamingtech.se)

Node library for the conversion of HLS VOD to HLS Live (A continuation and rebranding of vod-to-live.js library that is now deprecated)

## Installation

```
npm install --save @eyevinn/hls-vodtolive
```

## Usage

This library load and parses HLS VOD manifests and generates HLS Live manifests. The example below loads one HLS VOD and then another HLS VOD that is appended to the first one. The `getLiveMediaSequences(mediaseq)` returns HLS Live media sequence slices, and in the example below outputs the last live media sequence representation of the first VOD.

```
const HLSVod = require('@eyevinn/hls-vodtolive');
const vod = new HLSVod('https://example.com/vod.m3u8');
const vod2 = new HLSVod('https://example.com/vod2.m3u8');
vod.load().then(() => {
    // Get media sequence no 5 for bitrate 798000
    console.log(vod.getLiveMediaSequences(0, '798000', 5));
    return vod2.loadAfter(vod);
}).then(() => {
    console.log(vod.getLiveMediaSequences(vod.getLiveMediaSequencesCount(), '798000', 0));
}).catch(console.error);
```

One use case for this library is to simulate a linear live HLS stream by concatenating HLS VODs together which live HLS manifests are generated from. The open source library [Channel Engine](https://github.com/Eyevinn/channel-engine) provides an example of this.

What this library does can be illustrated by this simplified example below:

```
#EXTINF:9
seg1.ts
#EXTINF:9
seg2.ts
#EXTINF:9
seg3.ts
#EXTINF:4
seg4.ts
#EXT-X-ENDLIST
```

is made available as:

```
#EXT-X-MEDIA-SEQUENCE:1
#EXTINF:9
seg1.ts
#EXTINF:9
seg2.ts
#EXTINF:9
seg3.ts
```

```
#EXT-X-MEDIA-SEQUENCE:2
#EXTINF:9
seg2.ts
#EXTINF:9
seg3.ts
#EXTINF:4
seg4.ts
```

Another on-demand HLS can be concatenated

```
#EXTINF:9
segB1.ts
#EXTINF:9
segB2.ts
#EXTINF:9
segB3.ts
#EXTINF:4
segB4.ts
#EXT-X-ENDLIST
```
to yield the following media sequences

```
#EXT-X-MEDIA-SEQUENCE:3
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXTINF:9
seg3.ts
#EXTINF:4
seg4.ts
#EXT-X-DISCONTINUITY
#EXTINF:9
segB1.ts
```

```
#EXT-X-MEDIA-SEQUENCE:4
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXTINF:4
seg4.ts
#EXT-X-DISCONTINUITY
#EXTINF:9
segB1.ts
#EXTINF:9
segB2.ts
```

```
#EXT-X-MEDIA-SEQUENCE:5
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXT-X-DISCONTINUITY
#EXTINF:9
segB1.ts
#EXTINF:9
segB2.ts
#EXTINF:9
segB3.ts
```


To use this library with subtitles the following options are required to be supplied when creating a new instance of HLSVod
 ```
shouldContainSubtitles: true, // says that the loaded VOD should contain subtitles and to create dummy if missing.
expectedSubtitleTracks: subtitleTracks, // says that the loaded VOD should contain subtitles and to create dummy if missing
dummySubtitleEndpoint: "/dummysubs.vtt", // it should link to an endpoint that will serve empty vtt files.
subtitleSliceEndpoint: "/subtitlevtt.vtt", // it should link to an endpoint that can splice and vtt file and serve it in case a VOD contains
    subtitle segments longer than video segments.
```

Additional constructor option:
- `calculatePDT: true` - when chaining VODs with `loadAfter`, calculate the next VOD `timeOffset` (PDT) from the previous VOD duration; if the previous VOD has no `timeOffset`, the current time is used.
- `expectedAudioLanguages: ["en", "sv"]` - explicit list of audio language codes that must always be present in the generated live output, regardless of what any individual VOD contains. When a loaded VOD is missing one of these languages, the default (first available) language's audio segments are injected for it so the track keeps playing. When this option is omitted, the set of audio languages is instead determined by the first VOD loaded and is then persisted across all following VODs - it is never shrunk when a later VOD exposes fewer languages (e.g. loading a 2-language VOD followed by a 1-language VOD keeps both languages).
- `expectedAudioCodecs: ["mp4a.40.2", "ec-3"]` - explicit list of audio codecs that the generated live output must contain exactly. Audio groups whose codec is not in this list are dropped, and when a loaded VOD is missing one of the listed codecs the default (first available) codec's audio segments are reused for that codec's track so it keeps playing. When this option is omitted, the set of audio codecs is instead determined by the first VOD loaded and is then persisted across all following VODs - it is never shrunk when a later VOD exposes fewer codecs (e.g. loading a 2-codec VOD followed by a 1-codec VOD keeps both codecs).

# Pass-through model for unknown HLS tags/attributes

HLS manifests can carry vendor or otherwise non-standard tags and attributes that this library
does not natively interpret. By default such data is read-through only where the library
explicitly reads it and is otherwise dropped. The *pass-through model* defines a stable,
serializable representation for preserving that data verbatim so it can later be re-emitted
unchanged.

This section documents the **agreed data-structure shape** (issue #146). It is foundation
scaffolding: the fields exist, default to empty, and round-trip through `toJSON`/`fromJSON`
unchanged. Parse-time capture from `@eyevinn/m3u8` (#147), output re-emission in the manifest
generator (#148) and master-playlist wiring (#149) build on this contract and are tracked
separately — nothing populates the model yet.

### Shape

- **Segment level** — each media-playlist segment object (video, audio and subtitle) *may*
  carry:
  - `unknownTags: string[]` — ordered list of complete, raw tag lines (e.g.
    `"#EXT-X-CUSTOM-MARKER:foo=bar"`) that appeared immediately before the segment's URI and
    that the library does not natively interpret. Source order is preserved.
  - `unknownAttributes: { [name]: string }` — attributes on a tag the library recognizes
    structurally but whose specific attribute it does not read (e.g. a vendor attribute on
    `#EXTINF` or `#EXT-X-KEY`), stored verbatim as raw strings.

  These fields are **optional**: mirroring the existing optional segment fields (`initSegment`,
  `uri`, `keys`), they are attached only when non-empty so the serialized payload is not
  inflated with empty objects for every segment. An absent field is equivalent to an empty bag.

- **Master / stream / media level** — a single container on the VOD instance,
  `vod.unknownMasterData`, always present with the shape:
  ```js
  {
    tags: [],     // raw, uninterpreted master-level tag lines, in source order
    streams: {},  // bandwidth (string) -> { unknownAttributes: { name: rawValue } }  (one per #EXT-X-STREAM-INF)
    media: {}     // `${type}-${groupId}-${language}` -> { unknownAttributes: { name: rawValue } }  (one per #EXT-X-MEDIA)
  }
  ```
  Each stream/media entry exposes its own `unknownAttributes` map of attribute-name to raw,
  uninterpreted string value.

### Intended capture mechanism (wiring is #147)

`@eyevinn/m3u8` exposes the recognized attributes of each item via `item.get(...)`; this
library reads only the ones it understands. Capture will, at parse time, collect the tag lines
and attribute names that are **not** consumed by any `.get(...)` the library performs and store
them verbatim (no interpretation, no normalization) into the bags above — segment-level bags are
filled from each `PlaylistItem` before the segment object is built (see the `unknownSegmentTags`
/ `unknownSegmentAttributes` capture hook in `index.js`), and master-level bags from the
`StreamItem`/`MediaItem`s.

### Ordering / placement rules (re-emission is #148)

- `unknownTags` are re-emitted verbatim, in array order, immediately before the segment's own
  recognized tags and URI.
- `unknownAttributes` are appended to their host tag after the attributes the library itself
  writes; relative order among unknown attributes follows insertion order.
- Master-level `tags` are re-emitted in array order at the top of the master playlist; per-entry
  `unknownAttributes` are appended to the corresponding `#EXT-X-STREAM-INF` / `#EXT-X-MEDIA` line.

### Serialization guarantee

The entire model MUST round-trip through the `toJSON()` / `fromJSON()` (serialize /
`JSON.parse` deserialize) path unchanged. Segment-level bags are serialized as part of
`vod.segments`; `vod.unknownMasterData` is serialized as a top-level field and is backfilled to
the empty shape when deserializing a blob produced before the model existed.

# Documentation

- [API Documentation](API.md)

# Authors

This project was started as vod-to-live.js in 2018 by Eyevinn Technology.

## Contributors

- Jonas Birmé (jonas.birme@eyevinn.se)
- Alan Allard (alan.allard@eyevinn.se)

## Attributions

A special thanks to [OTTera](http://ottera.tv) for funding a number of bugfixes and help to triage issues. OTTera is a US based company that powers OTT and Linear Video services with over 45 million users worldwide.

# [Contributing](CONTRIBUTING.md)

In addition to contributing code, you can help to triage issues. This can include reproducing bug reports, or asking for vital information such as version numbers or reproduction instructions. 

# License (MIT)

Copyright 2020 Eyevinn Technology

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# Support

Join our [community on Slack](http://slack.streamingtech.se) where you can post any questions regarding any of our open source projects. Eyevinn's consulting business can also offer you:

- Further development of this component
- Customization and integration of this component into your platform
- Support and maintenance agreement

Contact [sales@eyevinn.se](mailto:sales@eyevinn.se) if you are interested.

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
