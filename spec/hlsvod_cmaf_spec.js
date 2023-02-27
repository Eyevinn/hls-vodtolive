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
        "audio-aacl-256": "256000",
      };
      return fs.createReadStream("testvectors/hls_cmaf_1/test-audio=" + bw[groupId] + ".m3u8");
    };
  });

  it("passes through the init segment correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(1);
        expect(seqSegments["2500000"][0].initSegment).toEqual("http://mock.com/test-video=2500000.m4s");
        expect(seqSegments["2500000"][1].initSegment).toEqual("http://mock.com/test-video=2500000.m4s");
        expect(seqSegments["3500000"][0].initSegment).toEqual("http://mock.com/test-video=3500000.m4s");
        expect(seqSegments["3500000"][1].initSegment).toEqual("http://mock.com/test-video=3500000.m4s");

        let m3u8 = mockVod.getLiveMediaSequences(0, "2500000", 0);
        let lines = m3u8.split("\n");
        expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-video=2500000.m4s"');

        m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 0);
        lines = m3u8.split("\n");
        expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"');
        done();
      })
      .catch((err) => {
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
      return fs.createReadStream("testvectors/hls_cmaf_1/master_nolang.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_cmaf_1/test-video=" + bandwidth + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const bw = {
        "audio-aacl-256": "256000",
      };
      return fs.createReadStream("testvectors/hls_cmaf_1/test-audio=" + bw[groupId] + ".m3u8");
    };
    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls_cmaf_2/master_nolang.m3u8");
    };

    mockMediaManifest2 = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_cmaf_2/test-video=" + bandwidth + ".m3u8");
    };

    mockAudioManifest2 = function (groupId, lang) {
      const bw = {
        "audio-aacl-128": "256000",
        "audio-aacl-256": "256000",
      };
      return fs.createReadStream("testvectors/hls_cmaf_2/test-audio=" + bw[groupId] + ".m3u8");
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
        expect(lines[48]).toEqual('#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"');

        done();
      });
  });

  fit("handles start time offset correctly when 27 seconds", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 29 * 1000);
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      let m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 0);
      let m3u8v = mockVod.getLiveMediaSequences(0, "2500000", 0);
      // TODO: Verify that all bitrates have the same length
      console.log(m3u8, m3u8v,800);
      done();
    });
  });

  it("inserts init segment after discontinuity, when VOD has multiple init segments", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "2500000", 10);
        let lines = m3u8.split("\n");
        expect(lines[6]).toEqual(`#EXT-X-MAP:URI="http://mock.com/test-video=2500000.m4s"`);
        expect(lines[8]).toEqual(`http://mock.com/test-video=2500000-51.m4s`);
        expect(lines[26]).toEqual(
          `#EXT-X-MAP:URI="https://ovpuspvod.a2d-stage.tv/trailers/63ef9c36e3ffa90028603374/output.ism/hls/output-video=1500000.m4s"`
        );
        expect(lines[27]).toEqual(`#EXT-X-CUE-OUT:DURATION=20`);
        expect(lines[29]).toEqual(`https://ovpuspvod.a2d-stage.tv/trailers/63ef9c36e3ffa90028603374/output.ism/hls/output-video=1500000-1.m4s`);
        expect(lines[41]).toEqual(`#EXT-X-MAP:URI="http://mock.com/test-video=2500000.m4s"`);
        expect(lines[42]).toEqual(`#EXT-X-CUE-IN`);
        expect(lines[44]).toEqual(`http://mock.com/test-video=2500000-1.m4s`);
        m3u8 = mockVod2.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 10);
        lines = m3u8.split("\n");
        expect(lines[6]).toEqual(`#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"`);
        expect(lines[8]).toEqual(`http://mock.com/test-audio=256000-73.m4s`);
        expect(lines[48]).toEqual(
          `#EXT-X-MAP:URI="https://ovpuspvod.a2d-stage.tv/trailers/63ef9c36e3ffa90028603374/output.ism/hls/output-audio=128000.m4s"`
        );
        expect(lines[49]).toEqual(`#EXT-X-CUE-OUT:DURATION=20.032`);
        expect(lines[51]).toEqual(`https://ovpuspvod.a2d-stage.tv/trailers/63ef9c36e3ffa90028603374/output.ism/hls/output-audio=128000-1.m4s`);
        expect(lines[63]).toEqual(`#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"`);
        expect(lines[64]).toEqual(`#EXT-X-CUE-IN`);
        expect(lines[66]).toEqual(`http://mock.com/test-audio=256000-1.m4s`);
        done();
      });
  });
});
