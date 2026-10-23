const HLSVod = require("../dist/index.js") as typeof import("../dist/index");
const fs = require("fs");

// #149: a master manifest carrying attributes the engine does not natively interpret
// (REQ-VIDEO-LAYOUT on EXT-X-STREAM-INF; INSTREAM-ID / CHARACTERISTICS on EXT-X-MEDIA) must
// have those attributes preserved at parse time and retrievable through the public API.
describe("HLSVod master-playlist unknown attributes", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_master_attrs/master.m3u8");
    };
    // The stream's media playlist content is irrelevant to this test; reuse an existing one.
    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/1497000.m3u8");
    };
  });

  it("preserves and exposes unknown EXT-X-STREAM-INF attributes keyed by bandwidth", (done) => {
    const mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const unknownMasterData = mockVod.getUnknownMasterData();
      expect(unknownMasterData.streams["1497000"]).toBeDefined();
      expect(unknownMasterData.streams["1497000"].unknownAttributes["req-video-layout"]).toEqual(
        '"CH-STEREO,CH-MONO"'
      );
      done();
    });
  });

  it("preserves and exposes unknown EXT-X-MEDIA attributes keyed by type-group-language", (done) => {
    const mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const unknownMasterData = mockVod.getUnknownMasterData();
      const entry = unknownMasterData.media["CLOSED-CAPTIONS-cc-en"];
      expect(entry).toBeDefined();
      expect(entry.unknownAttributes["instream-id"]).toEqual('"CC1"');
      expect(entry.unknownAttributes["characteristics"]).toEqual(
        '"public.accessibility.describes-music-and-sound"'
      );
      done();
    });
  });

  it("does not capture attributes the engine interprets structurally", (done) => {
    const mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const streamEntry = mockVod.getUnknownMasterData().streams["1497000"];
      // bandwidth / resolution / codecs are read by the engine and must not be captured here.
      expect(streamEntry.unknownAttributes["bandwidth"]).toBeUndefined();
      expect(streamEntry.unknownAttributes["resolution"]).toBeUndefined();
      expect(streamEntry.unknownAttributes["codecs"]).toBeUndefined();
      done();
    });
  });

  it("round-trips the preserved master attributes through toJSON/fromJSON", (done) => {
    const mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const restored = new HLSVod("http://mock.com/mock.m3u8");
      restored.fromJSON(mockVod.toJSON());
      const unknownMasterData = restored.getUnknownMasterData();
      expect(unknownMasterData.streams["1497000"].unknownAttributes["req-video-layout"]).toEqual(
        '"CH-STEREO,CH-MONO"'
      );
      expect(unknownMasterData.media["CLOSED-CAPTIONS-cc-en"].unknownAttributes["instream-id"]).toEqual('"CC1"');
      done();
    });
  });
});
