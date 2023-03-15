const HLSVod = require("../index.js");
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