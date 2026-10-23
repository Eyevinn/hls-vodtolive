const HLSVod = require("../dist/index.js") as typeof import("../dist/index");
const fs = require("fs");

describe("HLSVod unknown-tag pass-through (#148)", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_unknown_tags/master.m3u8");
    };
    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_unknown_tags/" + bandwidth + ".m3u8");
    };
  });

  it("captures an unknown media-playlist tag on parse", (done) => {
    const mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const segments = mockVod.getMediaSegments();
      const bw = mockVod.getBandwidths()[0];
      expect(segments[bw][0].unknownData).toBeDefined();
      expect(segments[bw][0].unknownData.unknownTags).toEqual(["#EXT-X-CUSTOM-MARKER:FOO=bar"]);
      done();
    });
  });

  it("re-emits the preserved unknown tag in generated live media sequences", (done) => {
    const mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const bw = mockVod.getBandwidths()[0];
      const m3u8 = mockVod.getLiveMediaSequences(0, bw, 0);
      // The unknown tag round-trips verbatim ...
      expect(m3u8).toContain("#EXT-X-CUSTOM-MARKER:FOO=bar");
      // ... positioned immediately before the segment's own EXTINF/URI ...
      expect(m3u8).toContain("#EXT-X-CUSTOM-MARKER:FOO=bar\n#EXTINF:9.00000,\nhttps://example.com/segment1.ts");
      // ... and existing known-tag output is unchanged.
      expect(m3u8).toContain("#EXT-X-TARGETDURATION:9");
      expect(m3u8).toContain("#EXTINF:9.00000,");
      expect(m3u8).toContain("https://example.com/segment1.ts");
      expect(m3u8).toContain("https://example.com/segment2.ts");
      expect(m3u8).toContain("https://example.com/segment3.ts");
      // The unknown tag appears exactly once (only on the segment that carried it).
      expect(m3u8.match(/#EXT-X-CUSTOM-MARKER:FOO=bar/g).length).toBe(1);
      done();
    });
  });
});
