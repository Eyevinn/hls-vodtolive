const HLSVod = require("../index.js");
const fs = require("fs");

describe("HLSVod with demuxed audio", () => {

  describe("utility functions for audio", () => {
    it("generate audio sequences type A", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { subtitleSpliceEndpoint: "/subtitlevtt.vtt" });
      let mockSequence = {
        duration: 10,
        timelinePosition: 0,
        cue: null,
        uri: ""
      };
      let sequences = {};
      const groupId = "audio-aacl-97";
      const lang = "sv";
      sequences[groupId] = {};
      sequences[groupId][lang] = [];
      for (let i = 0; i < 10; i++) {
        mockSequence.uri = "test" + i + ".aac";
        const temp = { ...mockSequence };
        sequences[groupId][lang].push(temp);
      }

      let result = mockVod.generateSequencesTypeAExtraMedia(sequences, groupId, lang, "audio");
      expect(result[0][groupId][lang][0].uri).toEqual("test0.aac")
      expect(result[0][groupId][lang].length).toEqual(5)
      expect(result[0][groupId][lang][4].uri).toEqual("test4.aac")

      expect(result[5][groupId][lang][0].uri).toEqual("test5.aac")
      expect(result[5][groupId][lang].length).toEqual(5)
      expect(result[5][groupId][lang][4].uri).toEqual("test9.aac")

      done();


    });
    it("generate audio sequences type B", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { subtitleSpliceEndpoint: "/subtitlevtt.vtt" });
      let mockSequence = {
        duration: 10,
        timelinePosition: 0,
        cue: null,
        uri: "test"
      };
      let sequences = {};
      const groupId = "audio-aacl-97";
      const lang = "sv";
      sequences[groupId] = {};
      sequences[groupId][lang] = [];
      for (let i = 0; i < 10; i++) {
        mockSequence.uri = "test" + i + ".aac";
        const temp = { ...mockSequence };
        sequences[groupId][lang].push(temp);
      }

      let result = mockVod.generateSequencesTypeBExtraMedia(sequences, groupId, lang, "audio");
      expect(result[0][groupId][lang][0].uri).toEqual("test0.aac")
      expect(result[0][groupId][lang].length).toEqual(5)
      expect(result[0][groupId][lang][4].uri).toEqual("test4.aac")

      expect(result[5][groupId][lang][0].uri).toEqual("test5.aac")
      expect(result[5][groupId][lang].length).toEqual(5)
      expect(result[5][groupId][lang][4].uri).toEqual("test9.aac")

      done();
    });
  });

  describe("can reload media sequences", () => {
    let mockMasterManifest1;
    let mockMediaManifest1;
    let mockAudioManifest1;
    let mockMasterManifest2;
    let mockMediaManifest2;
    let mockAudioManifest2;

    beforeEach(() => {
      mockMasterManifest1 = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/master.m3u8");
      };

      mockMediaManifest1 = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/1.m3u8");
      };

      mockAudioManifest1 = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/aac-en.m3u8");
      };

      mockMasterManifest2 = function () {
        return fs.createReadStream("testvectors/hls_reload2_audio/master.m3u8");
      };

      mockMediaManifest2 = function () {
        return fs.createReadStream("testvectors/hls_reload2_audio/1.m3u8");
      };

      mockAudioManifest2 = function () {
        return fs.createReadStream("testvectors/hls_reload2_audio/aac-en.m3u8");
      };
    });

    it("can reload at the beginning of a HLSVod", (done) => {
      let vod1segments = {};
      let vod1AudioSegments = {};
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

      mockVod
        .load(mockMasterManifest1, mockMediaManifest1, mockAudioManifest1)
        .then(() => {
          vod1segments = mockVod.getLiveMediaSequenceSegments(1);
          vod1AudioSegments = mockVod.getLiveAudioSequenceSegments(1);
        })
        .then(() => {
          mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
            mockVod2.reload(0, vod1segments, vod1AudioSegments).then(() => {
              expect(vod1segments).toEqual(mockVod2.getLiveMediaSequenceSegments(0));
              expect(vod1AudioSegments).toEqual(mockVod2.getLiveAudioSequenceSegments(0));
              done();
            });
          });
        });
    });

    it("can reload at the beginning of a HLSVod, and insert segments after live point", (done) => {
      let vod1segments = {};
      let vod1AudioSegments = {};
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

      mockVod
        .load(mockMasterManifest1, mockMediaManifest1, mockAudioManifest1)
        .then(() => {
          vod1segments = mockVod.getLiveMediaSequenceSegments(1);
          vod1AudioSegments = mockVod.getLiveAudioSequenceSegments(1);
          Object.keys(vod1segments).forEach((bw) => vod1segments[bw].unshift({ discontinuity: true }));
          const groupIds = Object.keys(vod1AudioSegments);
          for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            const langs = Object.keys(vod1AudioSegments[groupId])
            for (let j = 0; j < langs.length; j++) {
              const lang = langs[j];
              vod1AudioSegments[groupId][lang].unshift({ discontinuity: true });
            }
          }
        })
        .then(() => {
          mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
            mockVod2.reload(0, vod1segments, vod1AudioSegments, true).then(() => {
              expect(vod1segments).toEqual(mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 1));
              expect(vod1AudioSegments).toEqual(mockVod2.getLiveAudioSequenceSegments(mockVod2.getLiveMediaSequencesCount("audio") - 1));
              done();
            });
          });
        });
    });

    it("can reload at the middle of a HLSVod", (done) => {
      let vod1segments = {};
      let vod1AudioSegments = {};
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

      mockVod
        .load(mockMasterManifest1, mockMediaManifest1, mockAudioManifest1)
        .then(() => {
          vod1segments = mockVod.getLiveMediaSequenceSegments(1);
          vod1AudioSegments = mockVod.getLiveAudioSequenceSegments(1);
          Object.keys(vod1segments).forEach((bw) => vod1segments[bw].push({ discontinuity: true }));
          const groupIds = Object.keys(vod1AudioSegments);
          for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            const langs = Object.keys(vod1AudioSegments[groupId])
            for (let j = 0; j < langs.length; j++) {
              const lang = langs[j];
              vod1AudioSegments[groupId][lang].push({ discontinuity: true });
            }
          }
        })
        .then(() => {
          mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
            let bottomSegmentPreReload =
              mockVod2.getLiveMediaSequenceSegments(6)["401000"][mockVod2.getLiveMediaSequenceSegments(6)["401000"].length - 1];
            let bottomAudioSegmentPreReload =
              mockVod2.getLiveAudioSequenceSegments(6)["aac"]["en"][mockVod2.getLiveAudioSequenceSegments(6)["aac"]["en"].length - 1];
            mockVod2.reload(6, vod1segments, vod1AudioSegments).then(() => {
              let size = mockVod2.getLiveMediaSequenceSegments(1)["401000"].length;
              expect(mockVod2.getLiveMediaSequenceSegments(1)["401000"][size - 1]).toEqual(bottomSegmentPreReload);
              let sizeAudio = mockVod2.getLiveAudioSequenceSegments(1)["aac"]["en"].length;
              expect(mockVod2.getLiveAudioSequenceSegments(1)["aac"]["en"][sizeAudio - 1]).toEqual(bottomAudioSegmentPreReload);
              done();
            });
          });
        });
    });

    it("can reload at the middle of a HLSVod, and insert segments after live point", (done) => {
      let vod1segments = {};
      let vod1AudioSegments = {};
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

      mockVod
        .load(mockMasterManifest1, mockMediaManifest1, mockAudioManifest1)
        .then(() => {
          vod1segments = mockVod.getLiveMediaSequenceSegments(1);
          vod1AudioSegments = mockVod.getLiveAudioSequenceSegments(1);
          Object.keys(vod1segments).forEach((bw) => vod1segments[bw].unshift({ discontinuity: true }));
          const groupIds = Object.keys(vod1AudioSegments);
          for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            const langs = Object.keys(vod1AudioSegments[groupId])
            for (let j = 0; j < langs.length; j++) {
              const lang = langs[j];
              vod1AudioSegments[groupId][lang].unshift({ discontinuity: true });
            }
          }
        })
        .then(() => {
          mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
            const currentSeq = 7;
            let size = mockVod2.getLiveMediaSequenceSegments(currentSeq)["401000"].length;
            let seqSegs = mockVod2.getLiveMediaSequenceSegments(currentSeq)["401000"];
            let bottomSegmentPreReload = seqSegs[size - 1];

            let sizeAudio = mockVod2.getLiveAudioSequenceSegments(currentSeq)["aac"]["en"].length;
            let seqSegsAudio = mockVod2.getLiveAudioSequenceSegments(currentSeq)["aac"]["en"];
            let bottomAudioSegmentPreReload = seqSegsAudio[sizeAudio - 1];

            mockVod2.reload(7, vod1segments, vod1AudioSegments, true).then(() => {
              expect(mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 2)["401000"][0]).toEqual(
                bottomSegmentPreReload
              );
              expect(mockVod2.getLiveAudioSequenceSegments(mockVod2.getLiveMediaSequencesCount("audio") - 2)["aac"]["en"][0]).toEqual(
                bottomAudioSegmentPreReload
              );
              done();
            });
          });
        });
    });

    it("can reload at the end of a HLSVod", (done) => {
      let vod1segments = {};
      let vod1AudioSegments = {};
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

      mockVod
        .load(mockMasterManifest1, mockMediaManifest1, mockAudioManifest1)
        .then(() => {
          vod1segments = mockVod.getLiveMediaSequenceSegments(1);
          vod1AudioSegments = mockVod.getLiveAudioSequenceSegments(1);
          Object.keys(vod1segments).forEach((bw) => vod1segments[bw].push({ discontinuity: true }));
          const groupIds = Object.keys(vod1AudioSegments);
          for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            const langs = Object.keys(vod1AudioSegments[groupId])
            for (let j = 0; j < langs.length; j++) {
              const lang = langs[j];
              vod1AudioSegments[groupId][lang].push({ discontinuity: true });
            }
          }
        })
        .then(() => {
          mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
            const finalSeqIdx = mockVod2.getLiveMediaSequencesCount() - 1;
            const finalSeqSegs = mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 1)["401000"];
            const bottomSegmentPreReload = finalSeqSegs[finalSeqSegs.length - 1];

            const finalSeqSegsAudio = mockVod2.getLiveAudioSequenceSegments(mockVod2.getLiveMediaSequencesCount("audio") - 1)["aac"]["en"];
            const bottomAudioSegmentPreReload = finalSeqSegsAudio[finalSeqSegsAudio.length - 1];

            mockVod2.reload(finalSeqIdx, vod1segments, vod1AudioSegments).then(() => {
              let size = mockVod2.getLiveMediaSequenceSegments(1)["401000"].length;
              expect(mockVod2.getLiveMediaSequenceSegments(1)["401000"][size - 1]).toEqual(bottomSegmentPreReload);
              let sizeAudio = mockVod2.getLiveAudioSequenceSegments(1)["aac"]["en"].length;
              expect(mockVod2.getLiveAudioSequenceSegments(1)["aac"]["en"][sizeAudio - 1]).toEqual(bottomAudioSegmentPreReload);
              done();
            });
          });
        });
    });

    it("can reload at the end of a HLSVod, and insert segments after live point", (done) => {
      let vod1segments = {};
      let vod1AudioSegments = {};
      mockVod = new HLSVod("http://mock.com/mock.m3u8");
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

      mockVod
        .load(mockMasterManifest1, mockMediaManifest1, mockAudioManifest1)
        .then(() => {
          vod1segments = mockVod.getLiveMediaSequenceSegments(1);
          vod1AudioSegments = mockVod.getLiveAudioSequenceSegments(1);
          Object.keys(vod1segments).forEach((bw) => vod1segments[bw].unshift({ discontinuity: true }));
          const groupIds = Object.keys(vod1AudioSegments);
          for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            const langs = Object.keys(vod1AudioSegments[groupId])
            for (let j = 0; j < langs.length; j++) {
              const lang = langs[j];
              vod1AudioSegments[groupId][lang].unshift({ discontinuity: true });
            }
          }
        })
        .then(() => {
          mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
            let size = mockVod2.getLiveMediaSequenceSegments(12)["401000"].length;
            let bottomSegmentPreReload = mockVod2.getLiveMediaSequenceSegments(12)["401000"][size - 1];

            let sizeAudio = mockVod2.getLiveAudioSequenceSegments(12)["aac"]["en"].length;
            let bottomAudioSegmentPreReload = mockVod2.getLiveAudioSequenceSegments(12)["aac"]["en"][sizeAudio - 1];
            mockVod2.reload(12, vod1segments, vod1AudioSegments, true).then(() => {
              expect(mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 2)["401000"][0]).toEqual(
                bottomSegmentPreReload
              );
              expect(mockVod2.getLiveAudioSequenceSegments(mockVod2.getLiveMediaSequencesCount("audio") - 2)["aac"]["en"][0]).toEqual(
                bottomAudioSegmentPreReload
              );
              done();
            });
          });
        });
    });
  });


  describe("correct language functionality", () => {

    const hlsOpts = {
      forcedDemuxMode: true,
    }


    let mockMasterManifestOneLang;
    let mockMediaManifestOneLang;
    let mockAudioManifestOneLang;
    let mockMasterManifestMultipleLangs;
    let mockMediaManifestMultipleLangs;
    let mockAudioManifestMultipleLangs;

    beforeEach(() => {
      mockMasterManifestOneLang = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/master.m3u8");
      };

      mockMediaManifestOneLang = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/1.m3u8");
      };

      mockAudioManifestOneLang = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/aac-en.m3u8");
      };

      mockMasterManifestMultipleLangs = function () {
        return fs.createReadStream("testvectors/hls_always_0_demux/master.m3u8");
      };

      mockMediaManifestMultipleLangs = function (bw) {
        return fs.createReadStream(`testvectors/hls_always_0_demux/${bw}.m3u8`);
      };

      mockAudioManifestMultipleLangs = function (_, lang) {
        if (lang) {
          return fs.createReadStream(`testvectors/hls_always_0_demux/aac-${lang}.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_always_0_demux/aac-en.m3u8`);
        }
      };
    });

    it("load with the language specified", (done) => {
      const audioTracks = [
        { language: "en", name: "English" },
      ];
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          const audioLanguages = mockVod.getAudioLangsForAudioGroup("aac");
          expect(audioLanguages).toEqual(["en"]);
          done();
        });
    });

    it("load with all the language specified", (done) => {
      const audioTracks = [
        { language: "en", name: "English" },
        { language: "sv", name: "Svenska" },
      ]
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestMultipleLangs, mockMediaManifestMultipleLangs, mockAudioManifestMultipleLangs)
        .then(() => {
          const audioLanguages = mockVod.getAudioLangsForAudioGroup("aac");
          expect(audioLanguages).toEqual(["en", "sv"]);
          done();
        });
    });

    it("load with one of the two languages specified", (done) => {
      const audioTracks = [
        { language: "en", name: "English" },
      ]
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestMultipleLangs, mockMediaManifestMultipleLangs, mockAudioManifestMultipleLangs)
        .then(() => {
          const audioLanguages = mockVod.getAudioLangsForAudioGroup("aac");
          expect(audioLanguages).toEqual(["en"]);
          done();
        });
    });

    it("load without the language specified", (done) => {
      const audioTracks = [
        { language: "es", name: "Espanol" },
      ]
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          const audioLanguages = mockVod.getAudioLangsForAudioGroup("aac");
          expect(audioLanguages).toEqual(["en"]);
          done();
        });
    });
    
    it("load with the language specified", (done) => {
      const audioTracks = [
        { language: "en", name: "English" },
      ];
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });
    });

    it("load with all the language specified", (done) => {
      const audioTracks = [
        { language: "en", name: "English" },
        { language: "sv", name: "Svenska" },
      ]
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });
    });

    it("load with one of the two languages specified", (done) => {
      const audioTracks = [
        { language: "en", name: "English" },
      ]
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });
    });

    it("load without the language specified", (done) => {
      const audioTracks = [
        { language: "es", name: "Espanol" },
      ]
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });
    });
  });
  describe("correct language functionality without allowedAudioLanguages list", () => {

    const hlsOpts = {
      forcedDemuxMode: true,
    }

    let mockMasterManifestOneLang;
    let mockMediaManifestOneLang;
    let mockAudioManifestOneLang;
    let mockMasterManifestMultipleLangs;
    let mockMediaManifestMultipleLangs;
    let mockAudioManifestMultipleLangs;

    beforeEach(() => {
      mockMasterManifestOneLang = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/master.m3u8");
      };

      mockMediaManifestOneLang = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/1.m3u8");
      };

      mockAudioManifestOneLang = function () {
        return fs.createReadStream("testvectors/hls_reload1_audio/aac-en.m3u8");
      };

      mockMasterManifestMultipleLangs = function () {
        return fs.createReadStream("testvectors/hls_always_0_demux/master.m3u8");
      };

      mockMediaManifestMultipleLangs = function (bw) {
        return fs.createReadStream(`testvectors/hls_always_0_demux/${bw}.m3u8`);
      };

      mockAudioManifestMultipleLangs = function (_, lang) {
        if (lang) {
          return fs.createReadStream(`testvectors/hls_always_0_demux/aac-${lang}.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_always_0_demux/aac-en.m3u8`);
        }
      };
    });

    it("load vod after vod with the same languages", (done) => {
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });
    });

    it("load vod after vod with one matching languages", (done) => {
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });

    });

    it("load vod after vod with no matching languages", (done) => {
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });

    });

    it("load vod after vod with the same codecs", (done) => {
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });

    });

    it("load vod after vod with the different codecs", (done) => {
      hlsOpts.allowedAudioLanguages = audioTracks;
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, hlsOpts);
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, hlsOpts);

      mockVod
        .load(mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
        .then(() => {
          mockVod2.loadAfter(mockVod, mockMasterManifestOneLang, mockMediaManifestOneLang, mockAudioManifestOneLang)
            .then(() => {
              const m3u8 = mockVod2.getLiveMediaAudioSequences(0, "acc", "en", 0);
              const m3u8_2 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 1);
              const subStrings = m3u8.split("\n")
              const subStrings2 = m3u8_2.split("\n")
              expect(subStrings[33]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
              expect(subStrings2[32]).toEqual("#EXT-X-DISCONTINUITY")
              expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
              expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
              done();
            });
        });
    });
  });
});