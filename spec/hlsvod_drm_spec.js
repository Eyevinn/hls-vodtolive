const HLSVod = require("../dist/index.js");
const fs = require("fs");
const Readable = require("stream").Readable;

describe("HLSVod DRM standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_widevine/index.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        "831086": "playlist_v-0144p-0100k-libx264.mp4",
        "8065760": "playlist_v-0576p-1400k-libx264.mp4",
        "6099164": "playlist_v-0480p-1000k-libx264.mp4",
        "2193558": "playlist_v-0240p-0400k-libx264.mp4",
        "4008262": "playlist_v-0360p-0750k-libx264.mp4",
      };
      return fs.createReadStream("testvectors/hls_widevine/" + fname[bandwidth] + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const langCode = {
        "en": "eng"
      };
      const fname = {
        "default-audio-group": `playlist_a-${langCode[lang]}-0384k-aac-6c.mp4`,
      };
      return fs.createReadStream("testvectors/hls_widevine/" + fname[groupId] + ".m3u8");
    };
  });

  it("passes through the KEY tags correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
        expect(seqSegments["8065760"][2].discontinuity).toEqual(true);
        expect(seqSegments["8065760"][0].keys).toBeUndefined();
        expect(seqSegments["8065760"][1].keys).toBeUndefined();
        for (let i = 3; i < seqSegments["8065760"].length - 1; i++) {
          expect(seqSegments["8065760"][i].keys).not.toBeUndefined();
        }

        let m3u8 = mockVod.getLiveMediaSequences(0, "8065760", 0);
        let lines = m3u8.split("\n");
        expect(lines[13]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');

        const seqAudioSegments = mockVod.getLiveMediaSequenceAudioSegments("default-audio-group", "en", 0);
        expect(seqAudioSegments[2].discontinuity).toEqual(true);
        expect(seqAudioSegments[0].keys).toBeUndefined();
        expect(seqAudioSegments[1].keys).toBeUndefined();
        for (let i = 3; i < seqAudioSegments.length - 1; i++) {
          expect(seqAudioSegments[i].keys).not.toBeUndefined();
        }
        
        m3u8 = mockVod.getLiveMediaAudioSequences(0, "default-audio-group", "en", 0);
        lines = m3u8.split("\n");
        expect(lines[13]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x67B30C86756F57C5A0A38A23AC8C9178,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');

        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it("always provides KEY tags for all media sequences", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        for (let i = 0; i < mockVod.getLiveMediaSequencesCount() - 1; i++) {
          const seqSegments = mockVod.getLiveMediaSequenceSegments(i);
        }
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});

describe("HLSVod DRM after another DRM VOD", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_widevine/index.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        "831086": "playlist_v-0144p-0100k-libx264.mp4",
        "8065760": "playlist_v-0576p-1400k-libx264.mp4",
        "6099164": "playlist_v-0480p-1000k-libx264.mp4",
        "2193558": "playlist_v-0240p-0400k-libx264.mp4",
        "4008262": "playlist_v-0360p-0750k-libx264.mp4",
      };
      return fs.createReadStream("testvectors/hls_widevine/" + fname[bandwidth] + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const langCode = {
        "en": "eng"
      };
      const fname = {
        "default-audio-group": `playlist_a-${langCode[lang]}-0384k-aac-6c.mp4`,
      };
      return fs.createReadStream("testvectors/hls_widevine/" + fname[groupId] + ".m3u8");
    };
  });

  it("inserts key tags after discontinuity", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "8065760", 10);
        let lines = m3u8.split("\n");
        expect(lines[7]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');
        expect(lines[14]).toEqual('#EXT-X-DISCONTINUITY');
        expect(lines[15]).toEqual('#EXT-X-MAP:URI="http://mock.com/v-0576p-1400k-libx264-init.mp4"');
        expect(lines[22]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');

        m3u8 = mockVod2.getLiveMediaAudioSequences(0, "default-audio-group", "en", 10);
        lines = m3u8.split("\n");
        expect(lines[14]).toEqual('#EXT-X-DISCONTINUITY');
        expect(lines[15]).toEqual('#EXT-X-MAP:URI="http://mock.com/a-eng-0384k-aac-6c-init.mp4"');
        expect(lines[22]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x67B30C86756F57C5A0A38A23AC8C9178,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');

        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it("always has the correct EXT-KEY on top", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest);
      })
      .then(() => {
        let m3u8;
        for (let i = 0; i < 12; i++) {
          m3u8 = mockVod2.getLiveMediaSequences(0, "8065760", i);
          lines = m3u8.split("\n");
          expect(lines[7]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');
        }
        for (let i = 13; i < 15; i++) {
          m3u8 = mockVod2.getLiveMediaSequences(0, "8065760", i);
          lines = m3u8.split("\n");
          expect(lines[6]).toEqual('#EXT-X-MAP:URI="http://mock.com/v-0576p-1400k-libx264-init.mp4"');
        }
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});

describe("HLSVod Fairplay TS standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_fairplay_ts/index.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        "1044594": "video_index",
      };
      return fs.createReadStream("testvectors/hls_fairplay_ts/" + fname[bandwidth] + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const fname = {
        "audio": "audio_index",
      };
      return fs.createReadStream("testvectors/hls_fairplay_ts/" + fname[groupId] + ".m3u8");
    };
  });

  it("passes through the KEY tags correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
        expect(seqSegments["1044594"][0].keys).not.toBeUndefined();

        let m3u8 = mockVod.getLiveMediaSequences(0, "1044594", 0);
        let lines = m3u8.split("\n");
        expect(lines[6]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://twelve",KEYFORMATVERSIONS="1",KEYFORMAT="com.apple.streamingkeydelivery"');

        const seqAudioSegments = mockVod.getLiveMediaSequenceAudioSegments("audio", "en", 0);
        expect(seqAudioSegments[0].keys).not.toBeUndefined();

        m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio", "en", 0);
        lines = m3u8.split("\n");
        expect(lines[6]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://twelve",KEYFORMATVERSIONS="1",KEYFORMAT="com.apple.streamingkeydelivery"');

        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});

describe("HLSVod Fairplay and CENC standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_wv_fairplay/index.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        "1044594": "video_index",
      };
      return fs.createReadStream("testvectors/hls_wv_fairplay/" + fname[bandwidth] + ".m3u8");
    };

    mockAudioManifest = function (groupId, lang) {
      const fname = {
        "audio": "audio_index",
      };
      return fs.createReadStream("testvectors/hls_wv_fairplay/" + fname[groupId] + ".m3u8");
    };
  });

  it("passes through the KEY tags correctly", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
        expect(seqSegments["1044594"][3].keys).not.toBeUndefined();

        let m3u8 = mockVod.getLiveMediaSequences(0, "1044594", 0);
        let lines = m3u8.split("\n");
        expect(lines[13]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://dummy",IV=0xe4f4c12d42d269912a8bb26db5535752,KEYFORMATVERSIONS="1",KEYFORMAT="com.apple.streamingkeydelivery"');
        expect(lines[14]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');

        const seqAudioSegments = mockVod.getLiveMediaSequenceAudioSegments("audio", "en", 0);
        expect(seqAudioSegments[3].keys).not.toBeUndefined();

        m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio", "en", 0);
        lines = m3u8.split("\n");
        expect(lines[13]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://dummy",IV=0xe4f4c12d42d269912a8bb26db5535752,KEYFORMATVERSIONS="1",KEYFORMAT="com.apple.streamingkeydelivery"');
        expect(lines[14]).toEqual('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x67B30C86756F57C5A0A38A23AC8C9178,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"');

        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});