const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");

describe("HLSVod CMAF with BYTERANGE standalone", () => {
  let mockMasterManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_byterange/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const bwmap = {
        "3663471": "VIDEO_sdr_360p",
        "5841380": "VIDEO_sdr_720p"
      }
      return fs.createReadStream("testvectors/hls_byterange/" + bwmap[bandwidth] + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const audiomap = {
        "audio1_t0": "stereo_aac",
      };
      return fs.createReadStream("testvectors/hls_byterange/" + audiomap[groupId] + ".m3u8");
    };
  });

  it("passes through the init segment with byterange correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
        console.log(seqSegments);
        expect(seqSegments[5841380][0].initSegment).toEqual("http://mock.com/media/VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p-video-avc1.mp4");
        expect(seqSegments[5841380][0].initSegmentByteRange).toEqual("731@0");
        done();
      })
      .catch((err) => {
        done(err);
      })
  });
});