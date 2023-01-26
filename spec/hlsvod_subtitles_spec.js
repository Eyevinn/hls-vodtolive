const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;

describe("HLSVod with subtitles", () => {
    beforeEach(() => {
      mockMasterManifest = function () {
        return fs.createReadStream("testvectors/hls_subs/master.m3u8");
      };
  
      mockMediaManifest = function () {
        return fs.createReadStream("testvectors/hls_subs/b2962000-video.m3u8");
      };
  
  
      mockSubtitleManifest = function (_, lang) {
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
      mockAudioManifest = function () {
        return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
      }
    });
  
    it("returns the correct number of bandwidths", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
        expect(mockVod.getBandwidths().length).toBe(1);
        expect(mockVod.getBandwidths()).toEqual(["2962000"]);
        done();
      });
    });
    it("returns the correct first segment", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
        const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 1, 6);
        const subStrings = m3u8.split("\n")
        expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt?p=1");
        done();
      });
    });
  
    it("returns the correct subtitle URL", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
        const seqSubtitleSegments = mockVod.getLiveMediaSequenceSubtitleSegments("subs", "fr");
        expect(seqSubtitleSegments[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
        done();
      });
    });
    it("returns the correct subtitle URL on next chunck", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
        let m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 24, 6);
        let subStrings = m3u8.split("\n");
        expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt?p=24");
        expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=0");
  
        m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 25, 6);
        subStrings = m3u8.split("\n");
        expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=0");
        expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=1");
        done();
        m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 49, 6);
        subStrings = m3u8.split("\n");
        expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=24");
        done();
      });
    });
    it("returns the correct segment number", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
        const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 20, 6);
        const subStrings = m3u8.split("\n")
        expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt?p=20");
        done();
      });
    });
  });