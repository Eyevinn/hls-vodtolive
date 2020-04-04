[![MIT License][license-image]][license-url] [![Coverage Status](https://coveralls.io/repos/github/Eyevinn/hls-vodtolive/badge.svg?branch=master)](https://coveralls.io/github/Eyevinn/hls-vodtolive?branch=master)

Node library for the conversion of HLS VOD to HLS Live

(A continuation and rebranding of vod-to-live.js library that is now deprecated)
  
A library that is used to slice on-demand audio and video packaged in Apple HLS streaming format
into a list of HLS live media sequences, e.g:

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

One of the use cases for this library is when to "simulate" a simulcast of a TV channel based on
a sequence of on-demand content (playlist). The video player will playback the playlist as one
live HLS stream.

## Example

    $ npm install --save vod-to-live.js

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

# License (MIT)

Copyright 2020 Eyevinn Technology

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

