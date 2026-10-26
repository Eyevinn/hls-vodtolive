const HLSVod = require("../dist/index.js") as typeof import("../dist/index");
const fs = require("fs");

// #150: test vectors + specs for HLS tag/attribute pass-through.
//
// This suite covers the pass-through behaviour that `master` actually implements today:
//   - #149 (merged): unknown MASTER-playlist attributes (REQ-VIDEO-LAYOUT on EXT-X-STREAM-INF;
//     INSTREAM-ID / CHARACTERISTICS on EXT-X-MEDIA) are captured at parse time, survive a
//     toJSON/fromJSON cycle, and are re-exposed through the public getUnknownMasterData() API.
//   - #147 (merged): unknown MEDIA-playlist / segment-level tags (e.g. a vendor
//     #EXT-X-CUSTOM-* tag) are captured verbatim at parse time onto the segment pass-through
//     bag (segment.unknownData) and survive a toJSON/fromJSON cycle.
//
// SCOPING NOTE — acceptance sub-point (3) for the media/segment level is intentionally NOT
// asserted here: re-emitting captured segment-level unknown tags back into the generated live
// media sequences is `segToM3u8`'s job and is tracked by #148, which is NOT merged into
// `master` at the time these specs were written. Writing a spec that expects the custom tag in
// getLiveMediaSequences() output would fail on `master` (and asserting its ABSENCE would break
// #148 when it lands), so this file only documents the deferral and verifies that generating
// live sequences from a manifest that carries an unknown tag still succeeds. Master-level
// sub-point (3) IS covered, because getUnknownMasterData() is the exposed master API and is
// implemented in `master`.

describe("HLSVod tag/attribute pass-through (#150)", () => {
  // A master manifest carrying the three named master-level attributes.
  const masterWithAttrs = () =>
    fs.createReadStream("testvectors/hls_tag_passthrough/master.m3u8");
  // A media playlist carrying an unknown media-playlist-level tag.
  const mediaWithUnknownTag = () =>
    fs.createReadStream("testvectors/hls_tag_passthrough/video-1497000.m3u8");
  // A master + media pair with ONLY attributes/tags the engine interprets structurally.
  const masterClean = () =>
    fs.createReadStream("testvectors/hls_tag_passthrough/master_clean.m3u8");
  const mediaClean = () =>
    fs.createReadStream("testvectors/hls_tag_passthrough/video-1497000-clean.m3u8");

  describe("master-level attributes (REQ-VIDEO-LAYOUT, INSTREAM-ID, CHARACTERISTICS)", () => {
    // (1) parse preserves the data
    it("captures the unknown master attributes verbatim at parse time", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterWithAttrs, mediaWithUnknownTag).then(() => {
        const data = vod.getUnknownMasterData();
        expect(data.streams["1497000"].unknownAttributes["req-video-layout"]).toEqual(
          '"CH-STEREO,CH-MONO"'
        );
        const media = data.media["CLOSED-CAPTIONS-cc-en"];
        expect(media.unknownAttributes["instream-id"]).toEqual('"CC1"');
        expect(media.unknownAttributes["characteristics"]).toEqual(
          '"public.accessibility.describes-music-and-sound"'
        );
        done();
      });
    });

    // (2) serialize/deserialize round-trips the data
    it("round-trips the master attributes through toJSON/fromJSON", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterWithAttrs, mediaWithUnknownTag).then(() => {
        const restored = new HLSVod("http://mock.com/mock.m3u8");
        restored.fromJSON(vod.toJSON());
        const data = restored.getUnknownMasterData();
        expect(data.streams["1497000"].unknownAttributes["req-video-layout"]).toEqual(
          '"CH-STEREO,CH-MONO"'
        );
        expect(data.media["CLOSED-CAPTIONS-cc-en"].unknownAttributes["instream-id"]).toEqual(
          '"CC1"'
        );
        expect(data.media["CLOSED-CAPTIONS-cc-en"].unknownAttributes["characteristics"]).toEqual(
          '"public.accessibility.describes-music-and-sound"'
        );
        done();
      });
    });

    // (3) exposed master API re-emits the data — getUnknownMasterData() is that API.
    it("re-exposes the attributes through the public getUnknownMasterData() API", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterWithAttrs, mediaWithUnknownTag).then(() => {
        const data = vod.getUnknownMasterData();
        expect(Object.keys(data.streams)).toContain("1497000");
        expect(Object.keys(data.media)).toContain("CLOSED-CAPTIONS-cc-en");
        // Structurally-interpreted attributes must NOT leak into the pass-through bag.
        expect(data.streams["1497000"].unknownAttributes["bandwidth"]).toBeUndefined();
        expect(data.streams["1497000"].unknownAttributes["resolution"]).toBeUndefined();
        expect(data.streams["1497000"].unknownAttributes["codecs"]).toBeUndefined();
        done();
      });
    });

    // (4) regression guard: a master with only interpreted attributes captures nothing
    it("captures nothing for a master without unknown attributes", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterClean, mediaClean).then(() => {
        const data = vod.getUnknownMasterData();
        expect(data.streams).toEqual({});
        expect(data.media).toEqual({});
        done();
      });
    });
  });

  describe("media-playlist / segment-level unknown tag (#EXT-X-CUSTOM-PASSTHROUGH)", () => {
    // (1) parse preserves the data — the unknown playlist-level tag is attached verbatim to the
    // first segment's pass-through bag.
    it("captures the unknown media-playlist tag verbatim at parse time", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterWithAttrs, mediaWithUnknownTag).then(() => {
        const segments = vod.getMediaSegments();
        const bw = Object.keys(segments)[0];
        expect(segments[bw][0].unknownData.unknownTags).toEqual([
          "#EXT-X-CUSTOM-PASSTHROUGH:vendor-data-123",
        ]);
        done();
      });
    });

    // (2) serialize/deserialize round-trips the data
    it("round-trips the segment-level unknown tag through toJSON/fromJSON", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterWithAttrs, mediaWithUnknownTag).then(() => {
        const restored = new HLSVod("http://mock.com/mock.m3u8");
        restored.fromJSON(vod.toJSON());
        const segments = restored.getMediaSegments();
        const bw = Object.keys(segments)[0];
        expect(segments[bw][0].unknownData.unknownTags).toEqual([
          "#EXT-X-CUSTOM-PASSTHROUGH:vendor-data-123",
        ]);
        done();
      });
    });

    // (3) re-emission into generated live media sequences is #148 (NOT in `master`) — see the
    // SCOPING NOTE at the top of this file. We therefore only assert that live-sequence
    // generation still succeeds when an unknown tag is present, rather than asserting on the
    // tag's presence/absence in the output (which would couple this spec to unmerged work).
    it("still generates valid live media sequences when an unknown tag is present", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterWithAttrs, mediaWithUnknownTag).then(() => {
        const bw = Object.keys(vod.getMediaSegments())[0];
        const output = vod.getLiveMediaSequences(0, bw, 0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain("#EXTM3U");
        done();
      });
    });

    // (4) regression guard: a media playlist with no unknown tags captures no segment data
    it("captures no segment pass-through data for a plain media playlist", (done) => {
      const vod = new HLSVod("http://mock.com/mock.m3u8");
      vod.load(masterClean, mediaClean).then(() => {
        const segments = vod.getMediaSegments();
        const bw = Object.keys(segments)[0];
        const anyUnknown = segments[bw].some((s) => s.unknownData);
        expect(anyUnknown).toBe(false);
        done();
      });
    });
  });
});
