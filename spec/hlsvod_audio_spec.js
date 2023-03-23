const HLSVod = require("../index.js");

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
});