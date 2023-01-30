const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;


describe("HLSVod CMAF standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;
  let mockMasterManifestNoLang;
  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_cmaf_1/master.m3u8");
    };

    mockMasterManifestNoLang = function () {
      return fs.createReadStream("testvectors/hls_cmaf_1/master_nolang.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_cmaf_1/test-video=" + bandwidth + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const bw = {
        'audio-aacl-256': '256000'
      };
      return fs.createReadStream("testvectors/hls_cmaf_1/test-audio=" + bw[groupId] + ".m3u8");
    };    
  });

  it("passes through the init segment correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(1);
      expect(seqSegments['2500000'][0].initSegment).toEqual("http://mock.com/test-video=2500000.m4s");
      expect(seqSegments['2500000'][1].initSegment).toEqual("http://mock.com/test-video=2500000.m4s");
      expect(seqSegments['3500000'][0].initSegment).toEqual("http://mock.com/test-video=3500000.m4s");
      expect(seqSegments['3500000'][1].initSegment).toEqual("http://mock.com/test-video=3500000.m4s");

      let m3u8 = mockVod.getLiveMediaSequences(0, "2500000", 0);
      let lines = m3u8.split("\n");
      expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-video=2500000.m4s"');

      m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 0);
      lines = m3u8.split("\n");
      expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"');
      done();
    }).catch(err => {
      done(err);
    });
  });

  it("can handle audio group without LANGUAGE attribute", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifestNoLang, mockMediaManifest, mockAudioManifest).then(() => {
      let m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 0);
      let lines = m3u8.split("\n");
      expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"');
      done();
    });
  });
});

describe("HLSVod CMAF after another CMAF VOD", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;
  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_cmaf_1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_cmaf_1/test-video=" + bandwidth + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const bw = {
        'audio-aacl-256': '256000'
      };
      return fs.createReadStream("testvectors/hls_cmaf_1/test-audio=" + bw[groupId] + ".m3u8");
    };    
  });

  it("inserts init segment after discontinuity", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "2500000", 10);
        let lines = m3u8.split("\n");
        expect(lines[26]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-video=2500000.m4s"');

        m3u8 = mockVod2.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 10);
        lines = m3u8.split("\n");
        expect(lines[26]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"');
  
        done();
      });
  });
});

