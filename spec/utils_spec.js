const {
  urlResolve,
  segToM3u8,
  findBottomSegItem,
  fixedNumber,
  inspectForVodTransition,
  playlistItemWithInterstitialsMetadata,
  appendHlsInterstitialLineWithCUE,
  findIndexReversed,
} = require("../utils.js");

describe("utils", () => {
  describe("urlResolve", () => {
    it("resolves relative paths against absolute and relative bases", () => {
      expect(urlResolve("http://example.com/a/b", "../c")).toBe("http://example.com/c");
      expect(urlResolve("/a/b", "../c")).toBe("/c");
    });
  });

  describe("segToM3u8", () => {
    it("adds init segment, keys and cue-out when previous segment is a discontinuity", () => {
      const previousSegment = { discontinuity: true };
      const segment = {
        duration: 4,
        uri: "s1.ts",
        initSegment: "init.mp4",
        initSegmentByteRange: "0@100",
        keys: { aes: { method: "SAMPLE-AES", uri: "https://k", iv: "0x1" } },
        cue: { out: true, duration: 10 },
      };

      const out = segToM3u8(segment, 1, 2, null, previousSegment);

      expect(out).toContain("#EXT-X-CUE-OUT:DURATION=10");
      expect(out).toContain('#EXT-X-MAP:URI="init.mp4",BYTERANGE="0@100"');
      expect(out).toContain("#EXT-X-KEY:METHOD=SAMPLE-AES,URI=https://k,IV=0x1");
    });

    it("omits cue-in when the next item is the trailing discontinuity", () => {
      const segment = { duration: 3, uri: "mid.ts", cue: { in: true } };
      const nextSegment = { discontinuity: true };

      const out = segToM3u8(segment, 1, 3, nextSegment, { duration: 2 });

      expect(out).not.toContain("#EXT-X-CUE-IN");
      expect(out).toContain("mid.ts");
    });

    it("skips daterange output for interstitial CUE discontinuities", () => {
      const interstitial = {
        discontinuity: true,
        daterange: { CLASS: "com.apple.hls.interstitial", CUE: true },
      };

      const out = segToM3u8(interstitial, 1, 3, {}, { duration: 2 });

      expect(out.trim()).toBe("#EXT-X-DISCONTINUITY");
      expect(out).not.toContain("DATERANGE");
    });
  });

  describe("helpers", () => {
    it("finds the bottom most segment item", () => {
      const segments = [
        { duration: 3, uri: "a.ts" },
        { vodTransition: true },
        { discontinuity: true },
      ];
      expect(findBottomSegItem(segments)).toEqual({ duration: 3, uri: "a.ts" });
    });

    it("rounds floating point numbers deterministically", () => {
      expect(fixedNumber(0.1 + 0.2)).toBe(0.3);
      expect(fixedNumber(1.015)).toBe(1.01);
    });

    it("counts items after first vod transition", () => {
      const [count, found] = inspectForVodTransition([{ a: 1 }, { vodTransition: true }, {}, {}]);
      expect(found).toBeTrue();
      expect(count).toBe(2);
    });

    it("detects interstitial playlist items", () => {
      const pli = { attributes: { attributes: { daterange: { CLASS: "com.apple.hls.interstitial" } } } };
      expect(playlistItemWithInterstitialsMetadata(pli)).toBeTrue();
      expect(playlistItemWithInterstitialsMetadata({ attributes: { attributes: {} } })).toBeFalse();
    });

    it("appends daterange with properly formatted cue data", () => {
      const out = appendHlsInterstitialLineWithCUE("", {
        ID: "ad1",
        "planned-duration": 3.4567,
        "start-date": "2020-01-01T00:00:00Z",
      });
      expect(out).toContain("#EXT-X-DATERANGE:ID=\"ad1\"");
      expect(out).toContain("PLANNED-DURATION=3.457");
      expect(out).toContain('START-DATE="2020-01-01T00:00:00Z"');
    });

    it("finds last matching index when searching from the end", () => {
      expect(findIndexReversed([1, 3, 5, 3], (n) => n === 3)).toBe(3);
      expect(findIndexReversed([1, 2, 3], (n) => n > 5)).toBe(-1);
    });
  });
});
