const HLSVod = require("../dist/index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");

describe("HLSVod CMAF with BYTERANGE standalone", () => {
  let mockMasterManifest;
  let mockMasterManifestNoOffset;

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

    mockMasterManifestNoOffset = function () {
      return fs.createReadStream("testvectors/hls_byterange_no_offset/index.m3u8");
    };

    mockMediaManifestNoOffset = function (bandwidth) {
      const bwmap = {
        "783968": "video-avc-480p",
        "1927194": "video-avc-720p",
        "4024553": "video-avc-1080p"
      }
      return fs.createReadStream("testvectors/hls_byterange_no_offset/" + bwmap[bandwidth] + ".m3u8");
    };

    mockAudioManifestNoOffset = function (groupId, lang) {
      const audiomap = {
        "audio": "audio",
      };
      return fs.createReadStream("testvectors/hls_byterange_no_offset/" + audiomap[groupId] + ".m3u8");
    };    
  });

  it("passes through the segments with byterange correctly", (done) => {
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

  it("produces correct slices when offset is not specified on each segment", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifestNoOffset, mockMediaManifestNoOffset, mockAudioManifestNoOffset)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
        expect(seqSegments[4024553][0].initSegment).toEqual("http://mock.com/video-avc_1080p.mp4");
        expect(seqSegments[4024553][0].initSegmentByteRange).toEqual("870@0");
        expect(seqSegments[4024553][0].byteRange).toEqual("1915768@1118");
        expect(seqSegments[4024553][1].byteRange).toEqual(`1783958@${1915768 + 1118}`);
        expect(seqSegments[4024553][2].byteRange).toEqual(`1175162@${1915768 + 1118 + 1783958}`);

        const audioSegments = mockVod.getLiveMediaSequenceAudioSegments("audio", "sv", 0);
        expect(audioSegments[0].byteRange).toEqual("99886@1074");
        expect(audioSegments[1].byteRange).toEqual(`100637@${99886 + 1074}`);
        expect(audioSegments[2].byteRange).toEqual(`100589@${99886 + 1074 + 100637}`);
        done();
      })
      .catch((err) => {
        done(err);
      });
  });  
});

