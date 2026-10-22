const HLSVod = require("../dist/index.js") as typeof import("../dist/index");
const fs = require("fs");
const Readable = require("stream").Readable;

describe("HLSVod Multi Audio Codec standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_dolby/index.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        "4301519": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8",
        "3663471": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8",
        "3725519": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8",
        "6479428": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8",
        "5841380": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8",
        "5903428": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8"
      };
      return fs.createReadStream("testvectors/hls_dolby/" + fname[bandwidth]);
    };

    mockAudioManifest = function (groupId, lang) {
      const fname = {
        "audio1_t0": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_stereo_aac.m3u8",
        "audio12_t0": "sollevante_lp_v01_DAMF_Nearfield_48k_24b_24_DDP_51.m3u8",
        "audio6_t0": "sollevante_lp_v01_DAMF_Nearfield_48k_24b_24_DDPJOC.m3u8",
      };
      return fs.createReadStream("testvectors/hls_dolby/" + fname[groupId]);
    };
  });

  it("returns correct audio group for codec", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        expect(mockVod.getAudioCodecsAndChannelsForGroupId("audio1_t0")).toEqual(["mp4a.40.2", "2"]);
        expect(mockVod.getAudioCodecsAndChannelsForGroupId("audio12_t0")).toEqual(["ec-3", "6"]);
        expect(mockVod.getAudioCodecsAndChannelsForGroupId("audio6_t0")).toEqual(["ec-3", "16/JOC"]);

        expect(mockVod.getAudioGroupIdForCodecs("ec-3", "6")).toEqual("audio12_t0");
        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it("handles missing audio codec", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        expect(mockVod.getAudioGroupIdForCodecs("eac-3", "6")).toBeUndefined();
        expect(mockVod.getAudioCodecsAndChannelsForGroupId("audio16_t0")).toEqual([undefined, undefined]);
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});

describe("HLSVod persists audio codecs across VOD transitions", () => {
  // hls_dolby exposes two audio codecs: mp4a.40.2 (group audio1_t0) and ec-3 (groups
  // audio12_t0 + audio6_t0). The "single" master below is the same content exposing only the
  // mp4a.40.2 group, i.e. a VOD that has dropped the ec-3 codec.
  const mockMasterDual = () => fs.createReadStream("testvectors/hls_dolby/index.m3u8");
  const mockMediaDolby = (bandwidth) => {
    const fname = {
      "4301519": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8",
      "3663471": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8",
      "3725519": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8",
      "6479428": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8",
      "5841380": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8",
      "5903428": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8"
    };
    return fs.createReadStream("testvectors/hls_dolby/" + fname[bandwidth]);
  };
  const mockAudioDolby = (groupId) => {
    const fname = {
      "audio1_t0": "VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_stereo_aac.m3u8",
      "audio12_t0": "sollevante_lp_v01_DAMF_Nearfield_48k_24b_24_DDP_51.m3u8",
      "audio6_t0": "sollevante_lp_v01_DAMF_Nearfield_48k_24b_24_DDPJOC.m3u8",
    };
    return fs.createReadStream("testvectors/hls_dolby/" + fname[groupId]);
  };
  const singleCodecMaster =
    `#EXTM3U\n` +
    `#EXT-X-VERSION:6\n` +
    `#EXT-X-INDEPENDENT-SEGMENTS\n` +
    `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio1_t0",NAME="日本語",LANGUAGE="ja",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2",URI="VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_stereo_aac.m3u8"\n` +
    `#EXT-X-STREAM-INF:BANDWIDTH=3663471,AVERAGE-BANDWIDTH=2152794,FRAME-RATE=24.000,CODECS="avc1.64001F,mp4a.40.2",RESOLUTION=640x360,VIDEO-RANGE="SDR",AUDIO="audio1_t0"\n` +
    `VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_360p.m3u8\n` +
    `#EXT-X-STREAM-INF:BANDWIDTH=5841380,AVERAGE-BANDWIDTH=3573448,FRAME-RATE=24.000,CODECS="avc1.64001F,mp4a.40.2",RESOLUTION=1280x720,VIDEO-RANGE="SDR",AUDIO="audio1_t0"\n` +
    `VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p.m3u8\n`;
  const mockMasterSingle = () => Readable.from([singleCodecMaster]);

  it("keeps both audio codecs when a 2-codec VOD is followed by a 1-codec VOD", (done) => {
    const vod1 = new HLSVod("http://mock.com/dual.m3u8");
    const vod2 = new HLSVod("http://mock.com/single.m3u8");

    vod1
      .load(mockMasterDual, mockMediaDolby, mockAudioDolby)
      .then(() => {
        // Sanity: first VOD exposes both codecs.
        expect(vod1.getAudioGroupIdForCodecs("mp4a.40.2", "2")).toEqual("audio1_t0");
        expect(vod1.getAudioGroupIdForCodecs("ec-3", "6")).toEqual("audio12_t0");
        return vod2.loadAfter(vod1, mockMasterSingle, mockMediaDolby, mockAudioDolby);
      })
      .then(() => {
        // Regression: the ec-3 codec (absent from the 2nd VOD) must NOT be lost.
        expect(vod2.getAudioGroupIdForCodecs("mp4a.40.2", "2")).toEqual("audio1_t0");
        expect(vod2.getAudioGroupIdForCodecs("ec-3", "6")).toEqual("audio12_t0");
        expect(vod2.getAudioGroupIdForCodecs("ec-3", "16/JOC")).toEqual("audio6_t0");
        // All three audio groups must still be present in the live output...
        expect(vod2.getAudioGroups().sort()).toEqual(["audio12_t0", "audio1_t0", "audio6_t0"]);
        // ...and the missing-codec groups must keep full-length segments so audio does not
        // starve relative to video (before the fix the audio sequence count collapsed to 1).
        const audioSeqCount = vod2.getLiveMediaSequencesCount("audio");
        expect(audioSeqCount).toEqual(vod2.getLiveMediaSequencesCount());
        const ecSegments = vod2.getLiveAudioSequenceSegments(audioSeqCount - 1)["audio12_t0"]["en"];
        expect(ecSegments.length).toBeGreaterThan(0);
        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it("restricts the live output to exactly the explicitly expected audio codecs", (done) => {
    // The VOD contains both mp4a.40.2 and ec-3, but only mp4a.40.2 is expected.
    const opts = { expectedAudioCodecs: ["mp4a.40.2"] };
    const vod = new HLSVod("http://mock.com/dual.m3u8", null, 0, 0, null, opts);

    vod
      .load(mockMasterDual, mockMediaDolby, mockAudioDolby)
      .then(() => {
        // Only the expected codec's group remains; the ec-3 groups are dropped.
        expect(vod.getAudioGroups()).toEqual(["audio1_t0"]);
        expect(vod.getAudioGroupIdForCodecs("mp4a.40.2", "2")).toEqual("audio1_t0");
        expect(vod.getAudioGroupIdForCodecs("ec-3", "6")).toBeUndefined();
        expect(vod.getAudioGroupIdForCodecs("ec-3", "16/JOC")).toBeUndefined();
        // The kept codec's audio still lines up with video.
        expect(vod.getLiveMediaSequencesCount("audio")).toEqual(vod.getLiveMediaSequencesCount());
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});