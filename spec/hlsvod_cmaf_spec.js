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

  it("handles start time offset correctly when 28 seconds", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 28 * 1000);
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      let m3u8Audio = mockVod.getLiveMediaAudioSequences(0, "audio-aacl-256", "sv", 0);
      let m3u8Video = mockVod.getLiveMediaSequences(0, "2500000", 0);
      const linesVideo = m3u8Video.split("\n");
      const linesAudio = m3u8Audio.split("\n");
      expect(linesVideo[6]).toEqual(`#EXT-X-MAP:URI="http://mock.com/test-video=2500000.m4s"`);
      expect(linesVideo[8]).toEqual(`http://mock.com/test-video=2500000-11.m4s`);
      expect(linesAudio[6]).toEqual(`#EXT-X-MAP:URI="http://mock.com/test-audio=256000.m4s"`);
      expect(linesAudio[8]).toEqual(`http://mock.com/test-audio=256000-16.m4s`);
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

describe("HLSVod CMAF after another CMAF VOD, for demuxed tracks with unmatching lengths", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;
  let mockMasterManifest2;
  let mockMediaManifest2;
  let mockAudioManifest2;
  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_cmaf_demux_1/master.m3u8");
    };

    mockMediaManifest = function () {
      return fs.createReadStream("testvectors/hls_cmaf_demux_1/test-video=2500000.m3u8");
    };

    mockAudioManifest = function () {
      return fs.createReadStream("testvectors/hls_cmaf_demux_1/test-audio=256000.m3u8");
    };
    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls_cmaf_demux_2_pre/master.m3u8");
    };

    mockMediaManifest2 = function () {
      return fs.createReadStream("testvectors/hls_cmaf_demux_2_pre/test-video=2500000.m3u8");
    };

    mockAudioManifest2 = function () {
      return fs.createReadStream("testvectors/hls_cmaf_demux_2_pre/test-audio=256000.m3u8");
    };
  });

  it("and with 'sequenceAlwaysContainNewSegments=true' will have correct positions", (done) => {
    process.env.SEQUENCE_DURATION = 59;
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: 1, forcedDemuxMode: 1 });
    mockVod2 = new HLSVod("http://mock.com/mock_2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: 1, forcedDemuxMode: 1 });
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
        let m3u8_audio_before_ad_start = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 0);
        let m3u8_video_before_ad_start = mockVod2.getLiveMediaSequences(0, "1120000", 0);
        let m3u8_audio_on_ad_start = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
        let m3u8_video_on_ad_start = mockVod2.getLiveMediaSequences(0, "1120000", 1);

        let m3u8_audio_before_ad_end = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 22);
        let m3u8_video_before_ad_end = mockVod2.getLiveMediaSequences(0, "1120000", 23);
        let m3u8_audio_on_ad_end = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 24);
        let m3u8_video_on_ad_end = mockVod2.getLiveMediaSequences(0, "1120000", 24);

        let lines_1 = m3u8_audio_before_ad_start.split("\n");
        let lines_2 = m3u8_video_before_ad_start.split("\n");
        let lines_3 = m3u8_audio_on_ad_start.split("\n");
        let lines_4 = m3u8_video_on_ad_start.split("\n");

        let lines_5 = m3u8_audio_before_ad_end.split("\n");
        let lines_6 = m3u8_video_before_ad_end.split("\n");
        let lines_7 = m3u8_audio_on_ad_end.split("\n");
        let lines_8 = m3u8_video_on_ad_end.split("\n");

        const playheadPositionsV = mockVod2.getPlayheadPositions().map((i) => i.toFixed(2));
        const playheadPositionsA = mockVod2.getPlayheadPositions("audio").map((i) => i.toFixed(2));
        function mapPositions(listA, listB) {
          // Function simulates how the CE will select mseq index for audio
          const matches = {};
          let uu = [];
          for (let i = 0; i < listA.length; i++) {
            let closestIndex = null;
            let closestDiff = Infinity;
            for (let j = 0; j < listB.length; j++) {
              const diff = listB[j] - listA[i];
              if (diff >= 0 && diff < closestDiff) {
                closestIndex = j;
                closestDiff = diff;
              }
            }
            if (closestIndex !== null) {
              uu.push({
                v_i: i,
                a_i: closestIndex,
                v_p: listA[i],
                a_p: listB[closestIndex],
              });
              matches[listA[i]] = { _a: listB[closestIndex], [`_z_${i}`]: closestIndex };
            }
          }
          return uu;
        }

        const expectedPositionAndIndexMapping = [
          { v_i: 0, a_i: 0, v_p: "0.00", a_p: "0.00" },
          { v_i: 1, a_i: 1, v_p: "3.00", a_p: "6.87" },
          { v_i: 2, a_i: 1, v_p: "6.84", a_p: "6.87" },
          { v_i: 3, a_i: 2, v_p: "10.68", a_p: "10.71" },
          { v_i: 4, a_i: 3, v_p: "14.52", a_p: "14.55" },
          { v_i: 5, a_i: 4, v_p: "18.36", a_p: "18.39" },
          { v_i: 6, a_i: 5, v_p: "22.20", a_p: "22.23" },
          { v_i: 7, a_i: 6, v_p: "26.84", a_p: "26.90" },
          { v_i: 8, a_i: 7, v_p: "30.68", a_p: "30.74" },
          { v_i: 9, a_i: 8, v_p: "34.52", a_p: "34.58" },
          { v_i: 10, a_i: 9, v_p: "38.36", a_p: "38.42" },
          { v_i: 11, a_i: 10, v_p: "42.20", a_p: "42.26" },
          { v_i: 12, a_i: 11, v_p: "46.04", a_p: "46.10" },
          { v_i: 13, a_i: 12, v_p: "49.88", a_p: "49.94" },
          { v_i: 14, a_i: 13, v_p: "53.00", a_p: "53.10" },
          { v_i: 15, a_i: 14, v_p: "56.84", a_p: "56.94" },
          { v_i: 16, a_i: 15, v_p: "60.00", a_p: "60.14" },
          { v_i: 17, a_i: 16, v_p: "63.84", a_p: "63.98" },
          { v_i: 18, a_i: 17, v_p: "67.68", a_p: "67.82" },
          { v_i: 19, a_i: 18, v_p: "71.52", a_p: "71.66" },
          { v_i: 20, a_i: 19, v_p: "75.36", a_p: "75.50" },
          { v_i: 21, a_i: 20, v_p: "79.20", a_p: "79.34" },
          { v_i: 22, a_i: 21, v_p: "80.00", a_p: "80.17" },
          { v_i: 23, a_i: 22, v_p: "83.00", a_p: "83.20" },
          { v_i: 24, a_i: 24, v_p: "89.00", a_p: "90.88" },
          { v_i: 25, a_i: 25, v_p: "92.00", a_p: "94.72" },
          { v_i: 26, a_i: 26, v_p: "95.00", a_p: "98.56" },
          { v_i: 27, a_i: 27, v_p: "101.00", a_p: "102.40" },
          { v_i: 28, a_i: 28, v_p: "104.00", a_p: "106.24" },
          { v_i: 29, a_i: 29, v_p: "107.00", a_p: "110.08" },
          { v_i: 30, a_i: 29, v_p: "110.00", a_p: "110.08" },
          { v_i: 31, a_i: 31, v_p: "116.00", a_p: "117.76" },
          { v_i: 32, a_i: 32, v_p: "119.00", a_p: "121.60" },
          { v_i: 33, a_i: 33, v_p: "122.00", a_p: "125.44" },
          { v_i: 34, a_i: 34, v_p: "128.00", a_p: "129.90" },
          { v_i: 35, a_i: 34, v_p: "129.64", a_p: "129.90" },
        ];

        //console.log(mapPositions(playheadPositionsV, playheadPositionsA), m3u8_audio_on_ad_end, m3u8_video_on_ad_end);
        expect(mapPositions(playheadPositionsV, playheadPositionsA)).toEqual(expectedPositionAndIndexMapping);

        expect(lines_1[36]).toBe("http://mock.com/vod1-audio=256000-78.m4s");
        expect(lines_2[36]).toBe("http://mock.com/vod1-video=300000-77.m4s");
        expect(lines_3[37]).toBe("#EXT-X-CUE-OUT:DURATION=83");
        expect(lines_4[37]).toBe("#EXT-X-CUE-OUT:DURATION=83");
        expect(lines_5[44]).toBe("http://mock.com/bumper1-audio=128000-1.m4s");
        expect(lines_6[44]).toBe("http://mock.com/bumper1-video=300000-1.m4s");
        expect(lines_7[43]).toBe("#EXT-X-CUE-IN");
        expect(lines_8[45]).toBe("#EXT-X-CUE-IN");
        process.env.SEQUENCE_DURATION = 60;
        done();
      });
    });
  });
});
