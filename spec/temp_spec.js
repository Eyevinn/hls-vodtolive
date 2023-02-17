const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;

const str = (t) => JSON.stringify(t, null, 2);
describe("HLSVod when loading mux vod after demux vod, with set option-> sequenceAlwaysContainNewSegments", () => {
    let mock1_MasterManifest;
    let mock1_MediaManifest;
    let mock1_AudioManifest;
    let mock2_MasterManifest;
    let mock2_MediaManifest;
    let mock2_AudioManifest;
  
    beforeEach(() => {
      mock1_MasterManifest = function () {
        return fs.createReadStream("testvectors/hls_always_0_demux/master.m3u8");
      };
      mock1_MediaManifest = function (bandwidth) {
        return fs.createReadStream("testvectors/hls_always_0_demux/" + bandwidth + ".m3u8");
      };
      mock1_AudioManifest = function (groupId, lang) {
        if (groupId && lang) {
          return fs.createReadStream(`testvectors/hls_always_0_demux/${groupId}-${lang}.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_always_0_demux/${groupId}.m3u8`);
        }
      };
  
      mock2_MasterManifest = function () {
        return fs.createReadStream("testvectors/hls_always_1/master.m3u8");
      };
      mock2_MediaManifest = function (bandwidth) {
        return fs.createReadStream("testvectors/hls_always_1/" + bandwidth + ".m3u8");
      };
      mock2_AudioManifest = function (groupId, lang) {
        if (groupId && lang) {
          return fs.createReadStream(`testvectors/hls_always_1/${groupId}-${lang}.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_always_1/${groupId}.m3u8`);
        }
      };
    });
  
    it("set to true, will have null segments in the first couple of sequences", (done) => {
      let bool = 1;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
      mockVod
        .load(mock1_MasterManifest, mock1_MediaManifest, mock1_AudioManifest)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest, mock2_AudioManifest);
        })
        .then(() => {
          const expectedSeqAudioSegs = [
            {
              duration: 6.006,
              uri: "http://mock.com/audio/seg_en_50.ts",
            },
            {
              duration: 6.006,
              uri: "http://mock.com/audio/seg_en_51.ts",
            },
            {
              duration: 6.006,
              uri: "http://mock.com/audio/seg_en_52.ts",
            },
            {
              discontinuity: true,
              daterange: null,
            },
            null,
            null,
            null,
            null,
            undefined,
          ];
          const expectedSeqVideoSegs = [
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_50.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_51.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_52.ts",
            },
            {
              discontinuity: true,
              daterange: null,
            },
            {
              duration: 10.88,
              timelinePosition: null,
              cue: {
                out: true,
                cont: null,
                scteData: null,
                in: false,
                duration: 15.120000000000001,
                assetData: null,
              },
              uri: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00000.ts",
            },
            {
              duration: 4.24,
              timelinePosition: null,
              cue: null,
              uri: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00001.ts",
            },
            {
              discontinuity: true,
            },
            {
              duration: 11,
              timelinePosition: null,
              cue: {
                out: false,
                cont: null,
                scteData: null,
                in: true,
                duration: 0,
                assetData: null,
              },
              uri: "http://mock.com/level0/seg_0000.ts",
            },
            {
              duration: 12,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_0001.ts",
            },
          ];
          let sq = 3;
          let _bw = Object.keys(mockVod2.mediaSequences[sq].segments)[0];
          //const seqAudioSegments = mockVod2.mediaSequences[sq].audioSegments["aac"]["en"];
          const seqVideoSegments = mockVod2.mediaSequences[sq].segments[_bw];
          expect(seqVideoSegments).toEqual(expectedSeqVideoSegs);
          console.log(mockVod2.mediaSequences[1].audioSegments["aac"])
          console.log(mockVod2.mediaSequences[1].segments[_bw])
        //   console.log(mockVod2.mediaSequences[1].audioSegments["aac"])
        //   console.log(mockVod2.mediaSequences[1].segments[_bw])
        //   console.log("gej")
        //   console.log(mockVod2.mediaSequences[sq].audioSegments["aac"])
        //   console.log(mockVod2.mediaSequences[sq].segments[_bw])
          //console.log(mockVod2.mediaSequences[2])
          //expect(seqAudioSegments).toEqual(expectedSeqAudioSegs);
          done();
        });
    });
    xit("set to true, will have null segments in the later sequences", (done) => {
      let bool = 1;
      mockVod = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
      mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
      mockVod
        .load(mock2_MasterManifest, mock2_MediaManifest, mock2_AudioManifest)
        .then(() => {
          return mockVod2.loadAfter(mockVod, mock1_MasterManifest, mock1_MediaManifest, mock1_AudioManifest);
        })
        .then(() => {
          const expectedSeqAudioSegs = [
            { duration: 6.006, uri: "http://mock.com/audio/seg_en_47.ts" },
            { duration: 6.006, uri: "http://mock.com/audio/seg_en_48.ts" },
            { duration: 6.006, uri: "http://mock.com/audio/seg_en_49.ts" },
            { duration: 6.006, uri: "http://mock.com/audio/seg_en_50.ts" },
            { duration: 6.006, uri: "http://mock.com/audio/seg_en_51.ts" },
            { duration: 6.006, uri: "http://mock.com/audio/seg_en_52.ts" },
            null,
            null,
            null,
            undefined,
          ];
          const expectedSeqVideoSegs = [
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_43.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_44.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_45.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_46.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_47.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_48.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_49.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_50.ts",
            },
            {
              duration: 6.006,
              timelinePosition: null,
              cue: null,
              uri: "http://mock.com/level0/seg_51.ts",
            },
          ];
          let sq = 17;
          let _bw = Object.keys(mockVod2.mediaSequences[sq].segments)[0];
          const seqAudioSegments = mockVod2.audioSegments["aac"]["en"];
          const seqVideoSegments = mockVod2.mediaSequences[sq].segments[_bw];
          expect(seqVideoSegments).toEqual(expectedSeqVideoSegs);
          //expect(seqAudioSegments).toEqual(expectedSeqAudioSegs);
          done();
        });
    });
  });