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

  fit("passes through the segments with byterange correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
        expect(seqSegments[5841380][0].initSegment).toEqual("http://mock.com/media/VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p-video-avc1.mp4");
        expect(seqSegments[5841380][0].initSegmentByteRange).toEqual("731@0");
        expect(seqSegments[5841380][0].byteRange).toEqual("126323@1291");
        expect(seqSegments[5841380][8].byteRange).toEqual("2841047@24149820");

        let m3u8 = mockVod.getLiveMediaSequences(0, "5841380", 0);
        let lines = m3u8.split("\n");

        expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/media/VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p-video-avc1.mp4",BYTERANGE="731@0"')
        expect(lines[7]).toEqual("#EXTINF:6.000,");
        expect(lines[8]).toEqual("#EXT-X-BYTERANGE:126323@1291");
        expect(lines[9]).toEqual("http://mock.com/media/VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_sdr_720p-video-avc1.mp4");

        let m3u8Audio = mockVod.getLiveMediaAudioSequences(0, "audio1_t0", "ja", 0);
        let linesAudio = m3u8Audio.split("\n");

        expect(linesAudio[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/media/VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_stereo_aac-audio-ja-mp4a.mp4",BYTERANGE="660@0"')
        expect(linesAudio[7]).toEqual("#EXTINF:5.995,");
        expect(linesAudio[8]).toEqual("#EXT-X-BYTERANGE:97142@1220");
        expect(linesAudio[9]).toEqual("http://mock.com/media/VIDEO_e4da5fcd-5ffc-4713-bcdd-95ea579d790b_stereo_aac-audio-ja-mp4a.mp4");

        done();
      })
      .catch((err) => {
        done(err);
      })
  });
});