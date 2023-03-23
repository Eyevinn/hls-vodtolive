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
