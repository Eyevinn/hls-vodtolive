const HLSVod = require("../index.js");
const fs = require("fs");
const Readable = require("stream").Readable;

describe("HLSVod with subtitles", () => {

  const subtitleTracks = [
    { language: "fr", name: "French" },
    { language: "zh", name: "Chinese" },
    { language: "en", name: "English" },
    { language: "sv", name: "Swedish" }
  ]

  const hlsOptsAlwaysNewSegmentsFalse = {
    dummySubtitleEndpoint: "/dummysubs.vtt",
    subtitleSliceEndpoint: "/subtitlevtt.vtt",
    shouldContainSubtitles: true,
    expectedSubtitleTracks: subtitleTracks,
    sequenceAlwaysContainNewSegments: false
  }

  const hlsOptsAlwaysNewSegmentsTrue = {
    dummySubtitleEndpoint: "/dummysubs.vtt",
    subtitleSliceEndpoint: "/subtitlevtt.vtt",
    shouldContainSubtitles: true,
    expectedSubtitleTracks: subtitleTracks,
    sequenceAlwaysContainNewSegments: true
  }

  describe("", () => {
    let mockMasterManifestLongSegments;
    let mockMediaManifestLongSegments;
    let mockAudioManifestLongSegments;
    let mockSubtitleManifestLongSegments;

    let mockMasterManifestShortSegments;
    let mockMediaManifestShortSegments;
    let mockSubtitleManifestShortSegments;

    let mockMasterManifestShortSegments2;
    let mockMediaManifestShortSegments2;
    let mockSubtitleManifestShortSegments2;

    let mockMasterManifestNoSubs;
    let mockMediaManifestNoSubs;
    let mockAudioManifestNoSubs;

    let mockMasterPlaylistUnevenSubVideoSegments;
    let mockMediaPlaylistUnevenSubVideoSegments;
    let mockSubtitlePlaylistUnevenSubVideoSegments;

    beforeEach(() => {
      mockMasterManifestLongSegments = function () {
        return fs.createReadStream("testvectors/hls_subs/master.m3u8");
      };

      mockMasterManifestShortSegments = function () {
        return fs.createReadStream("testvectors/hls_subs2/master.m3u8");
      };

      mockMasterManifestShortSegments2 = function () {
        return fs.createReadStream("testvectors/hls_subs4/index.m3u8");
      };

      mockMasterManifestNoSubs = function () {
        return fs.createReadStream("testvectors/hls_subs_no_subs/master.m3u8");
      };

      mockMasterPlaylistUnevenSubVideoSegments = function () {
        return fs.createReadStream("testvectors/hls_subs3/index.m3u8");
      };

      mockMediaManifestLongSegments = function () {
        return fs.createReadStream("testvectors/hls_subs/b2962000-video.m3u8");
      };

      mockMediaManifestShortSegments = function () {
        return fs.createReadStream("testvectors/hls_subs2/video.m3u8");
      };

      mockMediaManifestShortSegments2 = function () {
        return fs.createReadStream("testvectors/hls_subs4/stream_0/index.m3u8");
      };

      mockMediaManifestNoSubs = function () {
        return fs.createReadStream("testvectors/hls_subs_no_subs/b2962000-video.m3u8");
      };

      mockMediaPlaylistUnevenSubVideoSegments = function () {
        return fs.createReadStream("testvectors/hls_subs3/stream_0/index.m3u8");
      };

      mockAudioManifestLongSegments = function () {
        return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
      }

      mockAudioManifestNoSubs = function () {
        return fs.createReadStream(`testvectors/hls_subs_no_subs/b160000-english.m3u8`);
      }

      mockSubtitleManifestLongSegments = function (_, lang) {
        const langs = {
          "zh": "chinese",
          "fr": "french",
          "sv": "french"
        }
        if (lang) {
          return fs.createReadStream(`testvectors/hls_subs/${langs[lang]}-ed.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_subs/french-ed.m3u8`);
        }
      };

      mockSubtitleManifestShortSegments = function () {
        return fs.createReadStream(`testvectors/hls_subs2/subs.m3u8`);
      };

      mockSubtitleManifestShortSegments2 = function () {
        return fs.createReadStream(`testvectors/hls_subs4/subs/sub.m3u8`);
      };

      mockSubtitlePlaylistUnevenSubVideoSegments = function () {
        return fs.createReadStream(`testvectors/hls_subs3/subs/sub.m3u8`);
      };

    });

    it("returns the correct number of bandwidths", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestNoSubs, mockMediaManifestNoSubs, mockAudioManifestNoSubs)
        .then(() => {
          expect(mockVod.getBandwidths().length).toBe(1);
          expect(mockVod.getBandwidths()).toEqual(["2962000"]);
          done();
        });
    });

    it("checks serialize size", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          return mockVod2.load(mockMasterManifestNoSubs, mockMediaManifestNoSubs, mockAudioManifestNoSubs)
        })
        .then(() => {
          const serialized = mockVod.toJSON()
          const size = Buffer.byteLength(JSON.stringify(serialized))
          const serialized2 = mockVod2.toJSON()
          const size2 = Buffer.byteLength(JSON.stringify(serialized2))
          expect(size2).toBeLessThan(size);
          done();
        });
    });

    it("no splice subtitle url", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { dummySubtitleEndpoint: "/dummysubs.vtt", shouldContainSubtitles: true, expectedSubtitleTracks: subtitleTracks });
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .catch((e) => {
          expect(e.message).toEqual("Missing subtitle slice URL");
          done();
        });
    });

    it("no subtitle tracks", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { dummySubtitleEndpoint: "/dummysubs.vtt", subtitleSliceEndpoint: "/subtitlevtt.vtt", shouldContainSubtitles: true });
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .catch((e) => {
          expect(e.message).toEqual("There are no expected subtitle tracks");
          done();
        });
    });

    it("returns the correct first segment", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const subStrings = m3u8.split("\n")
          expect(subStrings[7]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=0&endtime=6&elapsedtime=0");
          done();
        });
    });

    it("returns the correct third sequence", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 2);
          const subStrings = m3u8.split("\n")
          expect(subStrings[7]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=12&endtime=18&elapsedtime=0");
          done();
        });
    });

    it("handles split segments correctly", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterPlaylistUnevenSubVideoSegments, mockMediaPlaylistUnevenSubVideoSegments, null, mockSubtitlePlaylistUnevenSubVideoSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "en", 0);
          const subStrings = m3u8.split("\n");
          const url = new URL("http://temp" + subStrings[9]);
          const params = url.searchParams;
          expect(params.get("vtturi")).toEqual("http://mock.com/subs/2.webvtt");
          expect(params.get("previousvtturi")).toEqual("vtturi=http%3A%2F%2Fmock.com%2Fsubs%2F1.webvtt&starttime=4&endtime=6&elapsedtime=0");
          expect(params.get("elapsedtime")).toEqual("6");
          done();
        });
    });

    it("returns the correct segment when using offset (27sec) with short segments", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 27 * 1000, 0, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestShortSegments, mockMediaManifestShortSegments, null, mockSubtitleManifestShortSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 0);
          const m3u8_2 = mockVod.getLiveMediaSequences(0, "455000", 0);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[7]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
          expect(subStrings2[8]).toEqual("https://vod.streaming.a2d.tv/ys/1/4/0/1/88485/u-6600-a-128-1-2.mp4");
          done();
        });
    });
    it("returns the correct segment when using offset (27sec) with long segments", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 27 * 1000, 0, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const m3u8_2 = mockVod.getLiveMediaSequences(0, "2962000", 0);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[7]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=30&endtime=36&elapsedtime=0");
          expect(subStrings2[7]).toEqual("http://mock.com/media/media_w1204859437_b2962000_vo_slen_t64TWFpbg==_5.ts");
          done();
        });
    });

    it("returns the correct segment when using offset (150sec) with long segments", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 150 * 1000, 0, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const m3u8_2 = mockVod.getLiveMediaSequences(0, "455000", 0);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[7]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_25.webvtt&starttime=0&endtime=6&elapsedtime=150");
          expect(subStrings2[7]).toEqual("http://mock.com/media/media_w1204859437_b2962000_vo_slen_t64TWFpbg==_25.ts");
          done();
        });
    });
    it("returns the correct last segment sequenceAlwaysContainNewSegments(true)", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod.load(mockMasterManifestShortSegments, mockMediaManifestShortSegments, null, mockSubtitleManifestShortSegments)
        .then(() => {
          const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 0);
          const m3u8_2 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 1);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[41]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-7.webvtt");
          expect(subStrings2[40]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-8.webvtt");
          expect(subStrings[41]).not.toEqual(subStrings2[40])//comparing last segment in both playlists
          done();
        });
    });
    it("subs after vod with subs with short segments", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestShortSegments, mockMediaManifestShortSegments, null, mockSubtitleManifestShortSegments)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestShortSegments, mockMediaManifestShortSegments, null, mockSubtitleManifestShortSegments)
        }).then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "textstream", "sv", 0);
          const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "textstream", "sv", 1);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
          expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
          expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
          done();
        });
    });
    it("subs with long segments after vod with subs with short segments", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestShortSegments2, mockMediaManifestShortSegments2, null, mockSubtitleManifestShortSegments2)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        }).then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
          const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 2);
          const subStrings = m3u8.split("\n");
          const subStrings2 = m3u8_2.split("\n");
          expect(subStrings[16]).toEqual("#EXTINF:2.000,");
          expect(subStrings[17]).toEqual("http://mock.com/subs/7.webvtt");
          expect(subStrings2[16]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings2[17]).toEqual("#EXTINF:6.000,");
          expect(subStrings2[18]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=0&endtime=6&elapsedtime=0");
          done();
        });
    });
    it("subs with short segments after vod with subs with long segments", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestShortSegments2, mockMediaManifestShortSegments2, null, mockSubtitleManifestShortSegments2);
        }).then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
          const subStrings = m3u8.split("\n");
          const subStrings2 = m3u8_2.split("\n");
          expect(subStrings[20]).toEqual("#EXTINF:6.000,");
          expect(subStrings[21]).toEqual("/dummysubs.vtt?p=107");
          expect(subStrings2[20]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings2[21]).toEqual("#EXTINF:4.000,");
          expect(subStrings2[22]).toEqual("http://mock.com/subs/0.webvtt");
          done();
        });
    });
    it("subs with long segments after vod with subs with short segments and alwaysNewSegments(true)", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod.load(mockMasterManifestShortSegments2, mockMediaManifestShortSegments2, null, mockSubtitleManifestShortSegments2)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        })
        .then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[20]).toEqual("#EXTINF:2.000,");
          expect(subStrings[21]).toEqual("http://mock.com/subs/7.webvtt");
          expect(subStrings2[20]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings2[21]).toEqual("#EXTINF:6.000,");
          expect(subStrings2[22]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=0&endtime=6&elapsedtime=0");
          done();

        });
    });
    it("subs with short segments after vod with subs with long segments and alwaysNewSegments(true)", (done) => {
      const bool = 1;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestShortSegments2, mockMediaManifestShortSegments2, null, mockSubtitleManifestShortSegments2)
        }).then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
          const subStrings = m3u8.split("\n")
          const subStrings2 = m3u8_2.split("\n")
          expect(subStrings[22]).toEqual("#EXTINF:6.000,");
          expect(subStrings[23]).toEqual("/dummysubs.vtt?p=107");
          expect(subStrings2[22]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings2[23]).toEqual("#EXTINF:4.000,");
          expect(subStrings2[24]).toEqual("http://mock.com/subs/0.webvtt");
          done();
        });
    });
    it("deltaTimes and playheadPos, alwaysNewSegments(true)", (done) => {
      const bool = 1;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          const deltaV = mockVod.getDeltaTimes()
          const deltaS = mockVod.getDeltaTimes("subtitle")

          const playheadPosV = mockVod.getPlayheadPositions()
          const playheadPosS = mockVod.getPlayheadPositions("subtitle")
          expect(deltaV).toEqual(deltaS);
          expect(playheadPosV).toEqual(playheadPosS);
          done();
        });
    });
    it("deltaTimes and playheadPos, alwaysNewSegments(false)", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestLongSegments, mockMediaManifestLongSegments, mockAudioManifestLongSegments, mockSubtitleManifestLongSegments)
        .then(() => {
          const deltaV = mockVod.getDeltaTimes()
          const deltaS = mockVod.getDeltaTimes("subtitle")

          const playheadPosV = mockVod.getPlayheadPositions()
          const playheadPosS = mockVod.getPlayheadPositions("subtitle")
          expect(deltaV).toEqual(deltaS);
          expect(playheadPosV).toEqual(playheadPosS);
          done();
        });
    });
  });

  describe("mixing vod with subtitles and without", () => {
    let mockMasterManifestWithSubs;
    let mockMediaManifestWithSubs;
    let mockAudioManifestWithSubs;
    let mockSubtitleManifestWithSubs;
    let mockMasterManifestNoSubs;
    let mockMediaManifestNoSubs;
    let mockhls1;
    let mockhls2;
    beforeEach(() => {
      mockMasterManifestWithSubs = function () {
        return fs.createReadStream("testvectors/hls_subs/master.m3u8");
      };

      mockMasterManifestNoSubs = function () {
        return fs.createReadStream("testvectors/hls15/master.m3u8");
      };


      mockMediaManifestWithSubs = function () {
        return fs.createReadStream("testvectors/hls_subs/b2962000-video.m3u8");
      };

      mockMediaManifestNoSubs = function () {
        return fs.createReadStream("testvectors/hls15/index_1010931.m3u8");
      };

      mockSubtitleManifestWithSubs = function (_, lang) {
        const langs = {
          "zh": "chinese",
          "fr": "french"
        }
        if (lang) {
          return fs.createReadStream(`testvectors/hls_subs/${langs[lang]}-ed.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_subs/french-ed.m3u8`);
        }
      };

      mockAudioManifestWithSubs = function () {
        return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
      }

      mockhls1 = {
        master: function () {
          return fs.createReadStream("testvectors/hls_subs5_preroll/master.m3u8");
        },
        media: function () {
          return fs.createReadStream("testvectors/hls_subs5_preroll/level_0.m3u8");
        },
        audio: function () {
          return fs.createReadStream(`testvectors/hls_subs5_preroll/audio.m3u8`);
        },
      };

      mockhls2 = {
        master: function () {
          return fs.createReadStream("testvectors/hls_subs6_preroll/master.m3u8");
        },
        media: function () {
          return fs.createReadStream("testvectors/hls_subs6_preroll/level_0.m3u8");
        },
        audio: function () {
          return fs.createReadStream(`testvectors/hls_subs6_preroll/audio.m3u8`);
        },
      };

    })
    it("no subs after vod with subs with fallback URL", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestWithSubs, mockMediaManifestWithSubs, mockAudioManifestWithSubs, mockSubtitleManifestWithSubs)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestNoSubs, mockMediaManifestNoSubs)
        })
        .then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const subStrings = m3u8.split("\n")
          expect(subStrings[21]).toEqual("/dummysubs.vtt?p=107");
          expect(subStrings[22]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings[23]).toEqual("#EXTINF:2.000,");
          expect(subStrings[24]).toEqual("/dummysubs.vtt?p=9");
          done();
        });
    });
    it("subs after vod with no subs with fallback URL", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestNoSubs, mockMediaManifestNoSubs)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestWithSubs, mockMediaManifestWithSubs, mockAudioManifestWithSubs, mockSubtitleManifestWithSubs)
        })
        .then(() => {
          const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
          const subStrings = m3u8.split("\n")
          expect(subStrings[17]).toEqual("/dummysubs.vtt?p=6");
          expect(subStrings[18]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings[19]).toEqual("#EXTINF:6.000,");
          expect(subStrings[20]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=0&endtime=6&elapsedtime=0");
          done();
        });
    });
    it("subs after vod without subs", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod3 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestWithSubs, mockMediaManifestWithSubs, mockAudioManifestWithSubs, mockSubtitleManifestWithSubs)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestNoSubs, mockMediaManifestNoSubs)
        })
        .then(() => {
          return mockVod3.loadAfter(mockVod2, mockMasterManifestWithSubs, mockMediaManifestWithSubs, mockAudioManifestWithSubs, mockSubtitleManifestWithSubs)
        })
        .then(() => {
          const m3u8_3 = mockVod3.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
          const subStrings3 = m3u8_3.split("\n")
          expect(subStrings3[29]).toEqual("#EXTINF:2.000,");
          expect(subStrings3[30]).toEqual("/dummysubs.vtt?p=15");
          expect(subStrings3[31]).toEqual("#EXT-X-DISCONTINUITY")
          expect(subStrings3[32]).toEqual("#EXTINF:6.000,");
          expect(subStrings3[33]).toEqual("/subtitlevtt.vtt?vtturi=http%3A%2F%2Fmock.com%2Fsubtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA%3D%3D_0.webvtt&starttime=0&endtime=6&elapsedtime=0");
          done();
        });
    });

    it("no subs after vod without subs, and no fallback URL", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod3 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsTrue);
      mockVod.load(mockhls1.master, mockhls1.media, mockhls1.audio, null)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockhls2.master, mockhls2.media, mockhls2.audio, null)
        })
        .then(() => {
          const m3u8_3 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
          const subStrings3 = m3u8_3.split("\n")
          expect(subStrings3[32]).toEqual("#EXTINF:1.320,");
          expect(subStrings3[33]).toEqual("/dummysubs.vtt?p=62");
          expect(subStrings3[34]).toEqual("#EXT-X-DISCONTINUITY");
          expect(subStrings3[35]).toEqual("#EXTINF:3.840,");
          expect(subStrings3[36]).toEqual("/dummysubs.vtt?p=16");
          done();
        });
    });

    it("no subs after vod with subs without fallback URL", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { subtitleSliceEndpoint: "/subtitlevtt.vtt", shouldContainSubtitles: true, expectedSubtitleTracks: subtitleTracks });
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { subtitleSliceEndpoint: "/subtitlevtt.vtt", shouldContainSubtitles: true, expectedSubtitleTracks: subtitleTracks });
      mockVod.load(mockMasterManifestWithSubs, mockMediaManifestWithSubs, mockAudioManifestWithSubs, mockSubtitleManifestWithSubs)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mockMasterManifestNoSubs, mockMediaManifestNoSubs)
        })
        .catch((e) => {
          expect(e.message).toEqual("Loaded VOD does not contain subtitles and there is no dummy subtitle segment URL configured");
          done();
        });

    });
  });

  describe("support function", () => {
    let mockMasterManifestNoSubs;
    let mockMediaManifestNoSubs;

    beforeEach(() => {
      mockMasterManifestNoSubs = function () {
        return fs.createReadStream("testvectors/hls15/master.m3u8");
      };

      mockMediaManifestNoSubs = function () {
        return fs.createReadStream("testvectors/hls15/index_1010931.m3u8");
      };
    });

    it("generateSmallerSubtitleSegments with one segment", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestNoSubs, mockMediaManifestNoSubs)
        .then(() => {
          const segment = {
            duration: 15.5,
            timelinePosition: 0,
            cue: null,
            uri: "test.webvtt",
          };
          const result = mockVod.generateSmallerSubtitleSegments(segment, 0, null, false, false, 0);
          expect(result.elapsedTime).toEqual(15.5)
          expect(result.offset).toEqual(7)
          expect(result.leftover).toEqual({})
          expect(result.newSegments.length).toEqual(7)
          expect(result.newSegments[3].duration).toEqual(3.5)
          expect(result.newSegments[3].uri).toEqual("/subtitlevtt.vtt?vtturi=test.webvtt&starttime=6&endtime=9.5&elapsedtime=0")
          done();
        })
    });

    it("generateSmallerSubtitleSegments with two segment and uneven", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      mockVod.load(mockMasterManifestNoSubs, mockMediaManifestNoSubs)
        .then(() => {
          const segment = {
            duration: 7,
            timelinePosition: 0,
            cue: null,
            uri: "test1.webvtt",
          };
          const segment1 = {
            duration: 8.5,
            timelinePosition: 0,
            cue: null,
            uri: "test2.webvtt",
          };
          const segments = [segment, segment1];
          let results = [];
          let elapsedTime = 0;
          let offset = 0;
          let leftover = null;
          for (let i = 0; i < segments.length; i++) {
            const result = mockVod.generateSmallerSubtitleSegments(segments[i], offset, leftover, false, false, elapsedTime);
            elapsedTime += result.elapsedTime;
            offset += result.offset;
            leftover = result.leftover;
            results.push(result);
          }

          expect(results[0].elapsedTime).toEqual(7)
          expect(results[0].offset).toEqual(3)
          expect(results[0].leftover.duration).toEqual(2.5)
          expect(results[0].leftover.previousSegmentUri.toString()).toEqual("vtturi=test1.webvtt&starttime=6&endtime=7&elapsedtime=0")
          expect(results[0].leftover.consumedVideoDuration).toEqual(1)
          expect(results[0].newSegments.length).toEqual(3)
          expect(results[0].newSegments[2].duration).toEqual(2)
          expect(results[0].newSegments[2].uri).toEqual("/subtitlevtt.vtt?vtturi=test1.webvtt&starttime=4&endtime=6&elapsedtime=0")

          expect(results[1].elapsedTime).toEqual(15.5)
          expect(results[1].offset).toEqual(7)
          expect(results[1].leftover).toEqual({})
          expect(results[1].newSegments.length).toEqual(4)
          expect(results[1].newSegments[0].duration).toEqual(3.5)
          expect(results[1].newSegments[0].uri).toEqual("/subtitlevtt.vtt?vtturi=test2.webvtt&previousvtturi=vtturi%3Dtest1.webvtt%26starttime%3D6%26endtime%3D7%26elapsedtime%3D0&starttime=0&endtime=2.5&elapsedtime=7")
          done();
        });
    });
    it("generate subtitle sequences type A", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      let mockSequence = {
        duration: 10,
        timelinePosition: 0,
        cue: null,
        uri: "test"
      };
      let sequences = {};
      const groupId = "text";
      const lang = "sv";
      sequences[groupId] = {};
      sequences[groupId][lang] = [];
      for (let i = 0; i < 10; i++) {
        mockSequence.uri = "test" + i + ".vtt";
        const temp = { ...mockSequence };
        sequences[groupId][lang].push(temp);
      }

      let result = mockVod.generateSequencesTypeAExtraMedia(sequences, groupId, lang, "subtitle");
      expect(result[0][groupId][lang][0].uri).toEqual("test0.vtt")
      expect(result[0][groupId][lang].length).toEqual(5)
      expect(result[0][groupId][lang][4].uri).toEqual("test4.vtt")

      expect(result[5][groupId][lang][0].uri).toEqual("test5.vtt")
      expect(result[5][groupId][lang].length).toEqual(5)
      expect(result[5][groupId][lang][4].uri).toEqual("test9.vtt")

      done();


    });
    it("generate subtitle sequences type B", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOptsAlwaysNewSegmentsFalse);
      let mockSequence = {
        duration: 10,
        timelinePosition: 0,
        cue: null,
        uri: "test"
      };
      let sequences = {};
      const groupId = "text";
      const lang = "sv";
      sequences[groupId] = {};
      sequences[groupId][lang] = [];
      for (let i = 0; i < 10; i++) {
        mockSequence.uri = "test" + i + ".vtt";
        const temp = { ...mockSequence };
        sequences[groupId][lang].push(temp);
      }

      let result = mockVod.generateSequencesTypeBExtraMedia(sequences, groupId, lang, "subtitle");
      expect(result[0][groupId][lang][0].uri).toEqual("test0.vtt")
      expect(result[0][groupId][lang].length).toEqual(5)
      expect(result[0][groupId][lang][4].uri).toEqual("test4.vtt")

      expect(result[5][groupId][lang][0].uri).toEqual("test5.vtt")
      expect(result[5][groupId][lang].length).toEqual(5)
      expect(result[5][groupId][lang][4].uri).toEqual("test9.vtt")

      done();
    });
  });
});