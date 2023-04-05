const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;

const str = (t) => JSON.stringify(t, null, 2);

describe("HLSVod standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockMasterManifest2;
  let mockMediaManifest2;
  let mockMasterNoAudioOnly;
  let mockMediaNoAudioOnly;
  let mockMasterManifestNoUri;
  let mockAudioManifest;
  let mockMediaManifest3;
  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };

    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls15/master.m3u8");
    };

    mockMediaManifest2 = function (bandwidth) {
      return fs.createReadStream("testvectors/hls15/index_" + bandwidth + ".m3u8");
    };

    mockMasterNoAudioOnly = function () {
      return fs.createReadStream("testvectors/hls_noaudioonly/master.m3u8");
    };

    mockMediaNoAudioOnly = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_noaudioonly/index_" + bandwidth + ".m3u8");
    };

    mockMasterManifestNoUri = function () {
      return fs.createReadStream("testvectors/hls7/master.m3u8");
    };
    mockAudioManifest = (groupId) => {
      return fs.createReadStream("testvectors/hls7/audio-96000.m3u8");
    };
    mockMediaManifest3 = function (bandwidth) {
      return fs.createReadStream("testvectors/hls7/video-241929.m3u8");
    };
  });

  it("return the correct vod URI", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      expect(mockVod.getVodUri()).toBe("http://mock.com/mock.m3u8");
      done();
    });
  });

  it("return the correct loaded segments", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let allHLSVodSegments = mockVod.getMediaSegments();
      expect(Object.keys(allHLSVodSegments)).toEqual(mockVod.getBandwidths());
      expect(allHLSVodSegments["1497000"][0].uri).toBe(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_3_av.ts"
      );
      expect(allHLSVodSegments["1497000"][allHLSVodSegments["1497000"].length - 1].uri).toBe(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment295_3_av.ts"
      );
      done();
    });
  });

  it("returns the correct number of media sequences", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      expect(mockVod.getLiveMediaSequencesCount()).toBe(290);
      done();
    });
  });

  it("returns the correct number of bandwidths", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      expect(mockVod.getBandwidths().length).toBe(4);
      expect(mockVod.getBandwidths()).toEqual(["1497000", "2497000", "3496000", "4497000"]);
      done();
    });
  });

  it("can handle VOD without resolution specified in master manifest", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest2, mockMediaManifest2).then(() => {
      expect(mockVod.getBandwidths().length).toBe(1);
      expect(mockVod.getBandwidths()).toEqual(["1010931"]);
      done();
    });
  });

  it("can handle VOD without audio-only", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterNoAudioOnly, mockMediaNoAudioOnly).then(() => {
      expect(mockVod.getBandwidths().length).toBe(5);
      expect(mockVod.getBandwidths()).toEqual(["404000", "884000", "1626000", "2620000", "3578000"]);
      done();
    });
  });

  it("has the first segments in the first media sequence and that they are ABR aligned", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments["2497000"].length).toBe(6);
      expect(seqSegments["2497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
      );
      expect(seqSegments["1497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_3_av.ts"
      );
      expect(seqSegments["2497000"][5].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment6_2_av.ts"
      );
      expect(seqSegments["1497000"][5].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment6_3_av.ts"
      );
      done();
    });
  });

  it("has the second media sequence not containing the first segment", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(1);
      expect(seqSegments["2497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment2_2_av.ts"
      );
      expect(seqSegments["1497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment2_3_av.ts"
      );
      done();
    });
  });

  it("has the last media sequence containing the last segments and that they are ABR aligned", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const lastMediaSeq = mockVod.getLiveMediaSequencesCount() - 1;
      const seqSegments = mockVod.getLiveMediaSequenceSegments(lastMediaSeq);
      expect(seqSegments["2497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment290_2_av.ts"
      );
      expect(seqSegments["1497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment290_3_av.ts"
      );
      expect(seqSegments["2497000"][5].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment295_2_av.ts"
      );
      expect(seqSegments["1497000"][5].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment295_3_av.ts"
      );
      done();
    });
  });

  it("handles start time offset correctly when 0", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 0);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments["2497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
      );
      done();
    });
  });

  it("handles start time offset correctly when 27 seconds", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 27 * 1000);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      // TODO: Verify that all bitrates have the same length
      expect(seqSegments["2497000"][0].uri).toEqual(
        "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment4_2_av.ts"
      );
      done();
    });
  });

  it("handles start time offset correctly when it is longer than the total duration", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 2660 * 1000);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments).toEqual({});
      done();
    });
  });

  it("handles start time offset when loading after another VOD", (done) => {
    mockVod1 = new HLSVod("http://mock.com/mock.m3u8", null, null, 0);
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, null, 27 * 1000);
    mockVod1
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["1497000"][5].discontinuity).toBe(true);
        expect(seqSegments["1497000"][6].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment4_3_av.ts"
        );
        done();
      });
  });

  it("handles start time offset of 0 when loading after another VOD", (done) => {
    mockVod1 = new HLSVod("http://mock.com/mock.m3u8", null, null, 0);
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, null, 0);
    mockVod1
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["1497000"][5].discontinuity).toBe(true);
        expect(seqSegments["1497000"][6].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_3_av.ts"
        );
        done();
      });
  });
});

describe("HLSVod after another VOD", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockMasterNoAudioOnly;
  let mockMediaNoAudioOnly;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };
    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };
    mockMasterNoAudioOnly = function () {
      return fs.createReadStream("testvectors/hls_noaudioonly/master.m3u8");
    };
    mockMediaNoAudioOnly = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_noaudioonly/index_" + bandwidth + ".m3u8");
    };
  });

  it("has the first segments from the previous VOD", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][0].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment291_2_av.ts"
        );
        expect(seqSegments["1497000"][0].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment291_3_av.ts"
        );
        expect(seqSegments["2497000"][[seqSegments["2497000"].length - 1 - 1]].discontinuity).toBe(true); // Discontinuity
        expect(seqSegments["2497000"][[seqSegments["2497000"].length - 1]].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
        );
        done();
      });
  });

  it("never contains duplicate segments for two consecutive media sequences", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(async () => {
        let promises = [];
        let count = mockVod2.getLiveMediaSequencesCount();
        count = 7;
        for (let i = 0; i < count; i++) {
          promises.push(() => {
            return new Promise((resolve, reject) => {
              const manifest = mockVod2.getLiveMediaSequences(0, "2497000", i);
              const parser = m3u8.createStream();
              let manifestStream = new Readable();
              manifestStream.push(manifest);
              manifestStream.push(null);
              manifestStream.pipe(parser);
              parser.on("m3u", (m3u) => {
                const firstItem = m3u.items.PlaylistItem[0];
                resolve({ uri: firstItem.get("uri"), manifest: manifest });
              });
            });
          });
        }
        let lastUri = null;
        let lastManifest = null;
        for (promiseFn of promises) {
          const res = await promiseFn();
          if (lastUri && res.uri === lastUri) {
            console.error(lastManifest);
            console.error(res.manifest);
            fail(`${res.uri} was included in last media sequence ${lastUri}`);
          }
          lastUri = res.uri;
          lastManifest = res.manifest;
        }
        done();
      });
  });

  it("can handle next VOD without audio-only", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mocknoaudioonly.m3u8");

    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterNoAudioOnly, mockMediaNoAudioOnly);
      })
      .then(() => {
        expect(mockVod2.getBandwidths().length).toBe(5);
        expect(mockVod2.getBandwidths()).toEqual(["884000", "1497000", "1626000", "2497000", "3496000"]);
        done();
      });
  });

  it("does not leave dangling pointers to previous VOD", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterNoAudioOnly, mockMediaNoAudioOnly);
      })
      .then(() => {
        expect(mockVod._inspect().previousVod).toBeNull();
        done();
      });
  });

  it("provides the correct duration", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        expect(mockVod.getDuration()).toEqual(2652.266);
        return mockVod2.loadAfter(mockVod, mockMasterNoAudioOnly, mockMediaNoAudioOnly);
      })
      .then(() => {
        expect(mockVod2.getDuration()).toEqual(57.766);
        done();
      });
  });
});

describe("HLSVod with ad splicing", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };
    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };
  });

  it("has an ad splice at ~10 seconds and ~176 seconds from the start", (done) => {
    const splices = [
      {
        position: 10.0,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
      {
        position: 176.5,
        segments: {
          2497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
          1497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
        },
      },
    ];
    let mockVod = new HLSVod("http://mock.com/mock.m3u8", splices);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments["2497000"][1].discontinuity).toBe(true);
      seqSegments = mockVod.getLiveMediaSequenceSegments(18);
      expect(seqSegments["2497000"][3].discontinuity).toBe(true);
      expect(seqSegments["2497000"][4].duration).toBe(3);
      expect(seqSegments["2497000"][4].uri).toBe("ad11.ts");
      seqSegments = mockVod.getLiveMediaSequenceSegments(20);
      expect(seqSegments["2497000"][5].discontinuity).toBe(true);
      done();
    });
  });

  it("does not start with a discontinuity if ad is the first segment", (done) => {
    const splices = [
      {
        position: 5.0,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
    ];
    let mockVod = new HLSVod("http://mock.com/mock.m3u8", splices);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments["2497000"][0].discontinuity).not.toBe(true);
      done();
    });
  });

  it("has an ad splice at ~10 seconds from where the new VOD starts", (done) => {
    const splices = [
      {
        position: 10.0,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
      {
        position: 176.5,
        segments: {
          2497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
          1497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
        },
      },
    ];
    let mockVod = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", splices);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(1);
        expect(seqSegments["2497000"][4].discontinuity).toBe(true);
        expect(seqSegments["2497000"][6].discontinuity).toBe(true);
        done();
      });
  });

  it("does not contain ad splice outside of content duration", (done) => {
    const splices = [
      {
        position: 5430.5,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
    ];
    let mockVod = new HLSVod("http://mock.com/mock.m3u8", splices);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const count = mockVod.getLiveMediaSequencesCount();
      let seqSegments = mockVod.getLiveMediaSequenceSegments(count - 1);
      const seqLength = seqSegments["2497000"].length;
      expect(seqSegments["2497000"][seqLength - 1].uri).not.toEqual("ad03.ts");
      done();
    });
  });

  it("can handle ad that does not match current vod usage profile", (done) => {
    const splices = [
      {
        position: 10.0,
        segments: {
          2498000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1494000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
    ];
    let mockVod = new HLSVod("http://mock.com/mock.m3u8", splices);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments["2497000"][2].uri).toEqual("ad01.ts");
      done();
    });
  });

  it("can handle two ads back-to-back", (done) => {
    const splices = [
      {
        position: 0.0,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
      {
        position: 9.0,
        segments: {
          2497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
          1497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
        },
      },
    ];
    let mockVod = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", splices);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(1);
        expect(seqSegments["2497000"][4].discontinuity).toBe(true);
        expect(seqSegments["2497000"][5].discontinuity).not.toBe(true);
        expect(seqSegments["2497000"][7].uri).toBe("ad03.ts");
        expect(seqSegments["2497000"][8].discontinuity).toBe(true);
        expect(seqSegments["2497000"][9].uri).toBe("ad11.ts");
        done();
      });
  });
});

describe("HLSVod with timeline", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };
    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };
  });

  it("can be initiated with a non-zero timeoffset", (done) => {
    const now = Date.now();
    let mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      const count = mockVod.getLiveMediaSequencesCount();
      let seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments["2497000"][0].timelinePosition).toEqual(now);
      seqSegments = mockVod.getLiveMediaSequenceSegments(1);
      expect(seqSegments["2497000"][5].timelinePosition).toEqual(now + 9 * 6 * 1000);
      seqSegments = mockVod.getLiveMediaSequenceSegments(count - 1);
      expect(seqSegments["2497000"][5].timelinePosition).toEqual(now + 2646 * 1000);
      done();
    });
  });

  it("can handle vod after another vod", (done) => {
    const now = Date.now();
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][4].timelinePosition).toEqual(now + 2646 * 1000);
        expect(seqSegments["2497000"][6].timelinePosition).toEqual(now + 2646 * 1000 + 6266);
        done();
      });
  });

  it("can handle vod after another vod with two ads back-to-back", (done) => {
    const splices = [
      {
        position: 0.0,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
      {
        position: 9.0,
        segments: {
          2497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
          1497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
        },
      },
    ];
    const now = Date.now();
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", splices);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][4].timelinePosition).toEqual(now + 2646 * 1000);
        expect(seqSegments["2497000"][6].timelinePosition).toEqual(now + 2646 * 1000 + 6266);
        done();
      });
  });

  it("outputs EXT-X-PROGRAM-DATE-TIME after discontinuity", (done) => {
    const now = Date.now();
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 0);
        let m = m3u8.match("#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:(.*)\n");
        expect(m).not.toBeNull();
        // Make sure date-time is unchanged on next media sequence
        d = m[1];
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 1);
        m = m3u8.match("#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:(.*)\n");
        expect(d).toEqual(m[1]);
        done();
      });
  });

  it("outputs the correct EXT-X-DISCONTINUITY-SEQUENCE", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", []);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 0);
        let m;
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:0\n");
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 5);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:1\n");
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 6);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:1\n");
        expect(m).not.toBeNull();
        expect(mockVod2.getLastDiscontinuity()).toEqual(1);
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 6, 7);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:8\n");
        expect(m).not.toBeNull();
        done();
      });
  });

  it("outputs the correct EXT-X-DISCONTINUITY-SEQUENCE with ads", (done) => {
    const splices = [
      {
        position: 0.0,
        segments: {
          2497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
          1497000: [
            [3, "ad01.ts"],
            [3, "ad02.ts"],
            [3, "ad03.ts"],
          ],
        },
      },
      {
        position: 9.0,
        segments: {
          2497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
          1497000: [
            [3, "ad11.ts"],
            [3, "ad12.ts"],
            [3, "ad13.ts"],
          ],
        },
      },
    ];
    mockVod = new HLSVod("http://mock.com/mock.m3u8", []);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", splices);
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 0);
        let m;
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:0\n");
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 5);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:1\n");
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 6);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:1\n");
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 10);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:2\n");
        expect(m).not.toBeNull();
        expect(mockVod2.getLastDiscontinuity()).toEqual(3);
        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 10, 7);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:9\n");
        expect(m).not.toBeNull();
        done();
      });
  });
});

describe("HLSVod with not equal usage profiles", () => {
  let mockMasterManifest = [];
  let mockMediaManifest = [];

  beforeEach(() => {
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    });
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls2/master.m3u8");
    });
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls3/master.m3u8");
    });
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls_abr3/master.m3u8");
    });
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls16/master.m3u8");
    });
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls_abr5/master.m3u8");
    });
    mockMasterManifest.push(function () {
      return fs.createReadStream("testvectors/hls_abr4/master.m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls2/" + bandwidth + ".m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls3/" + bandwidth + ".m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls_abr3/" + bandwidth + ".m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls16/" + bandwidth + ".m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls_abr5/" + bandwidth + ".m3u8");
    });
    mockMediaManifest.push(function (bandwidth) {
      return fs.createReadStream("testvectors/hls_abr4/" + bandwidth + ".m3u8");
    });
  });

  it("can find a correct match", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8");
    mockVod
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][6].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
        );
        return mockVod3.loadAfter(mockVod2, mockMasterManifest[2], mockMediaManifest[2]);
      })
      .then(() => {
        const seqSegments = mockVod3.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][6].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
        );
        done();
      });
  });

  it("can find a correct match with ad splices", (done) => {
    const splices = [
      {
        position: 0.0,
        segments: {
          4497000: [
            [3, "ad01-4.ts"],
            [3, "ad02-4.ts"],
            [3, "ad03-4.ts"],
          ],
          3496000: [
            [3, "ad01-3.ts"],
            [3, "ad02-3.ts"],
            [3, "ad03-3.ts"],
          ],
          2497000: [
            [3, "ad01-2.ts"],
            [3, "ad02-2.ts"],
            [3, "ad03-2.ts"],
          ],
          1497000: [
            [3, "ad01-1.ts"],
            [3, "ad02-1.ts"],
            [3, "ad03-1.ts"],
          ],
        },
      },
      {
        position: 9.0,
        segments: {
          4497000: [
            [3, "ad01-4.ts"],
            [3, "ad02-4.ts"],
            [3, "ad03-4.ts"],
          ],
          3496000: [
            [3, "ad01-3.ts"],
            [3, "ad02-3.ts"],
            [3, "ad03-3.ts"],
          ],
          2497000: [
            [3, "ad01-2.ts"],
            [3, "ad02-2.ts"],
            [3, "ad03-2.ts"],
          ],
          1497000: [
            [3, "ad01-1.ts"],
            [3, "ad02-1.ts"],
            [3, "ad03-1.ts"],
          ],
        },
      },
    ];
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", splices);
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8", splices);
    mockVod
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][6].uri).toEqual("ad01-2.ts");
        return mockVod3.loadAfter(mockVod2, mockMasterManifest[2], mockMediaManifest[2]);
      })
      .then(() => {
        const seqSegments = mockVod3.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][6].uri).toEqual("ad01-2.ts");
        done();
      });
  });

  it("can find a correct match with ad splices not matching", (done) => {
    const splices = [
      {
        position: 0.0,
        segments: {
          3496000: [
            [3, "ad01-3.ts"],
            [3, "ad02-3.ts"],
            [3, "ad03-3.ts"],
          ],
          2497000: [
            [3, "ad01-2.ts"],
            [3, "ad02-2.ts"],
            [3, "ad03-2.ts"],
          ],
          1497000: [
            [3, "ad01-1.ts"],
            [3, "ad02-1.ts"],
            [3, "ad03-1.ts"],
          ],
        },
      },
      {
        position: 9.0,
        segments: {
          4497000: [
            [3, "ad01-4.ts"],
            [3, "ad02-4.ts"],
            [3, "ad03-4.ts"],
          ],
          3496000: [
            [3, "ad01-3.ts"],
            [3, "ad02-3.ts"],
            [3, "ad03-3.ts"],
          ],
          2497000: [
            [3, "ad01-2.ts"],
            [3, "ad02-2.ts"],
            [3, "ad03-2.ts"],
          ],
          1497000: [
            [3, "ad01-1.ts"],
            [3, "ad02-1.ts"],
            [3, "ad03-1.ts"],
          ],
        },
      },
    ];
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", splices);
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8", splices);
    mockVod
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][6].uri).toEqual("ad01-2.ts");
        return mockVod3.loadAfter(mockVod2, mockMasterManifest[2], mockMediaManifest[2]);
      })
      .then(() => {
        const seqSegments = mockVod3.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][6].uri).toEqual("ad01-2.ts");
        done();
      });
  });

  it("can match a VOD with more ladder steps", (done) => {
    mockVod = new HLSVod("http://mock.com/abr3.m3u8");
    mockVod2 = new HLSVod("http://mock.com/abr4.m3u8");
    // 1497k=768x432, 2497k=1024x576, 3000k=1024x576
    mockVod
      .load(mockMasterManifest[3], mockMediaManifest[3])
      .then(() => {
        // 1497k=768x432, 2497k=1024x576, 3496k=1280x720, 4497k=1280x720
        return mockVod2.loadAfter(mockVod, mockMasterManifest[0], mockMediaManifest[0]);
      })
      .then(() => {
        const bandwidths = Object.keys(mockVod2.getLiveMediaSequenceSegments(0));
        expect(bandwidths.length).toEqual(4);
        expect(bandwidths.includes("4497000")).toBeTrue();
        done();
      });
  });

  it("can match a VOD with fewer ladder steps", (done) => {
    mockVod = new HLSVod("http://mock.com/abr4.m3u8");
    mockVod2 = new HLSVod("http://mock.com/abr3.m3u8");
    // 1497k=768x432, 2497k=1024x576, 3496k=1280x720, 4497k=1280x720
    mockVod
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        // 1497k=768x432, 2497k=1024x576, 3000k=1024x576
        return mockVod2.loadAfter(mockVod, mockMasterManifest[3], mockMediaManifest[3]);
      })
      .then(() => {
        const bandwidths = Object.keys(mockVod2.getLiveMediaSequenceSegments(0));
        expect(bandwidths.length).toEqual(3);
        expect(bandwidths.includes("4497000")).toBeFalse();
        done();
      });
  });

  it("can avoid matching two ladder steps into the same one", (done) => {
    // VOD A:
    // 1497k, 2497k, 3496k, 4497k
    // VOD B:
    // 1497k, 3220k, 3496k
    // Expected:
    // 1497k, 3220k, 3496k
    // Not expected:
    // 1497k, 3496k
    mockVod = new HLSVod("http://mock.com/voda.m3u8");
    mockVod2 = new HLSVod("http://mock.com/vodb.m3u8");
    mockVod
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[4], mockMediaManifest[4]);
      })
      .then(() => {
        const bandwidths = Object.keys(mockVod2.getLiveMediaSequenceSegments(0));
        expect(bandwidths.length).not.toEqual(2);
        expect(bandwidths.length).toEqual(3);
        expect(bandwidths).toEqual(["1497000", "3220000", "3496000"]);
        done();
      });
  });

  it("can handle when needle is higher than available ones", (done) => {
    // VOD A:
    // 1497k, 3220k, 3496k
    // VOD B:
    // 1497k, 2497k, 3496k, 4497k
    mockVod = new HLSVod("http://mock.com/voda.m3u8");
    mockVod2 = new HLSVod("http://mock.com/vodb.m3u8");
    mockVod
      .load(mockMasterManifest[4], mockMediaManifest[4])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[0], mockMediaManifest[0]);
      })
      .then(() => {
        const bandwidths = Object.keys(mockVod2.getLiveMediaSequenceSegments(0));
        expect(bandwidths.length).toEqual(4);
        const sorted = bandwidths.sort((a, b) => b - a);
        expect(sorted[0]).toEqual("4497000");
        done();
      });
  });

  it("can handle when more than one new higher ladder step is to be added", (done) => {
    // VOD A:
    // 1497k, 3220k, 3496k
    // VOD B:
    // 1497k, 2497k, 3496k, 4497k, 5800k
    mockVod = new HLSVod("http://mock.com/voda.m3u8");
    mockVod2 = new HLSVod("http://mock.com/vodb.m3u8");
    mockVod
      .load(mockMasterManifest[4], mockMediaManifest[4])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[5], mockMediaManifest[5]);
      })
      .then(() => {
        const bandwidths = Object.keys(mockVod2.getLiveMediaSequenceSegments(0));
        expect(bandwidths.length).toEqual(5);
        done();
      });
  });

  it("does not incorrectly copy previous bandwidth", (done) => {
    // VOD A:
    // 1497k, 3220k, 3496k
    // VOD B:
    // 1000k, 1497k, 3220k, 3496k
    // Expected:
    // 1000k, 3220k, 3496k
    // Not expected: internal datastructure error exception
    mockVod = new HLSVod("http://mock.com/voda.m3u8");
    mockVod2 = new HLSVod("http://mock.com/vodb.m3u8");
    mockVod
      .load(mockMasterManifest[4], mockMediaManifest[4])
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest[6], mockMediaManifest[6]);
      })
      .then(() => {
        const bandwidths = Object.keys(mockVod2.getLiveMediaSequenceSegments(0));
        expect(bandwidths.length).toEqual(3);
        done();
      });
  });
});
/**
 *  Changes:
 *  - Read from new mock manifests and
 *    update input arguments for vod.getLiveMediaSequenceAudioSegments(id, *new*->lang, seqIdx)
 *  - Added 3 more unittests for different VOD after VOD cases.
 */
describe("HLSVod with separate audio variants", () => {
  beforeEach(() => {
    mockMasterManifest = function () {
      //return fs.createReadStream("testvectors/hls4/master.m3u8");
      return fs.createReadStream("testvectors/hls_multiaudiotracks/master.m3u8");
    };
    mockMasterManifest2 = function () {
      //return fs.createReadStream("testvectors/hls4/master.m3u8");
      return fs.createReadStream("testvectors/hls_multiaudiotracks2/master.m3u8");
    };
    mockMasterManifestNoUri = function () {
      return fs.createReadStream("testvectors/hls4/master-nouri.m3u8");
    };
    mockMediaManifest = function (bandwidth) {
      const fname = {
        354000: "video-241929.m3u8",
        819000: "video-680761.m3u8",
        1538000: "video-1358751.m3u8",
        2485000: "video-2252188.m3u8",
        3396000: "video-3112126.m3u8",
      };
      return fs.createReadStream("testvectors/hls_multiaudiotracks/" + fname[bandwidth]);
    };
    mockMediaManifest2 = function (bandwidth) {
      const fname = {
        354000: "video-241929.m3u8",
        819000: "video-680761.m3u8",
        1538000: "video-1358751.m3u8",
        2485000: "video-2252188.m3u8",
        3396000: "video-3112126.m3u8",
      };
      return fs.createReadStream("testvectors/hls_multiaudiotracks2/" + fname[bandwidth]);
    };
    mockAudioManifest = function (groupId, lang) {
      const fname = {
        "audio-aacl-96": "audio-96000",
        "audio-aacl-97": "audio-96000",
      };
      if (groupId && lang !== "audio") {
        return fs.createReadStream(`testvectors/hls_multiaudiotracks/${fname[groupId]}-${lang}.m3u8`);
      } else {
        return fs.createReadStream(`testvectors/hls_multiaudiotracks/${fname[groupId]}.m3u8`);
      }
    };
    mockAudioManifest2 = function (groupId, lang) {
      const fname = {
        aac: "audio",
        "audio-aacl-96": "audio",
        "audio-aacl-97": "audio",
      };
      if (groupId && lang) {
        return fs.createReadStream(`testvectors/hls_multiaudiotracks2/${fname[groupId]}-${lang}.m3u8`);
      } else {
        return fs.createReadStream(`testvectors/hls_multiaudiotracks2/${fname[groupId]}.m3u8`);
      }
    };
    mockMasterManifest3 = function () {
      //return fs.createReadStream("testvectors/hls4/master.m3u8");
      return fs.createReadStream("testvectors/hls_multiaudiotracks3/master.m3u8");
    };
    mockMediaManifest3 = function (bandwidth) {
      const fname = {
        354000: "video-241929.m3u8",
        819000: "video-680761.m3u8",
        1538000: "video-1358751.m3u8",
        2485000: "video-2252188.m3u8",
        3396000: "video-3112126.m3u8",
      };
      return fs.createReadStream("testvectors/hls_multiaudiotracks3/" + fname[bandwidth]);
    };
    mockAudioManifest3 = function (groupId, lang) {
      const fname = {
        "audio-aacl-96": "audio-96000",
        "audio-aacl-97": "audio-96000",
      };
      if (groupId && lang) {
        return fs.createReadStream(`testvectors/hls_multiaudiotracks3/${fname[groupId]}-${lang}.m3u8`);
      } else {
        return fs.createReadStream(`testvectors/hls_multiaudiotracks3/${fname[groupId]}.m3u8`);
      }
    };
  });

  it("returns the correct number of bandwidths", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      expect(mockVod.getBandwidths().length).toBe(5);
      expect(mockVod.getBandwidths()).toEqual(["354000", "819000", "1538000", "2485000", "3396000"]);
      done();
    });
  });

  it("handles master manifest with audiogroup without uri attribute", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifestNoUri, mockMediaManifest, mockAudioManifest).then(() => {
      expect(mockVod.getAudioGroups().length).toBe(1);
      done();
    });
  });

  it("returns the correct number of audio groups", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      expect(mockVod.getAudioGroups().length).toBe(2);
      expect(mockVod.getAudioGroups()).toEqual(["audio-aacl-96", "audio-aacl-97"]);
      const seqAudioSegments = mockVod.getLiveMediaSequenceAudioSegments("audio-aacl-96", "en", 0);
      expect(seqAudioSegments[4].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_en-5.aac");
      done();
    });
  });

  it("returns correct first and last media sequence", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      const count = mockVod.getLiveMediaSequencesCount();
      let seqVideoSegments = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqVideoSegments["354000"][0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts");
      seqVideoSegments = mockVod.getLiveMediaSequenceSegments(count - 1);
      expect(seqVideoSegments["354000"][seqVideoSegments["354000"].length - 1].uri).toEqual(
        "http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-26.ts"
      );
      done();
    });
  });

  it("can handle vod after another vod, loading same groupId & languages", (done) => {
    const now = Date.now();
    // # Two demuxed vods with some different languages.
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
        const seqSegments2 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments1["354000"][0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts");
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1 - 1].discontinuity).toBe(true);
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts"
        );
        const seqAudioSegments1 = mockVod.getLiveMediaSequenceAudioSegments("audio-aacl-96", "de", 0);
        const seqAudioSegments2 = mockVod2.getLiveMediaSequenceAudioSegments("audio-aacl-96", "de", 0);
        expect(seqAudioSegments1[0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_de-1.aac");
        expect(seqAudioSegments2[[seqAudioSegments2.length - 1 - 1]].discontinuity).toBe(true);
        expect(seqAudioSegments2[seqAudioSegments2.length - 1].uri).toEqual("http://mock.com/media_mock/audioplaylist/i-audio_de-1.aac");
        done();
      });
  });

  it("can handle vod after another vod, loading same groupId but missing a language, type 1", (done) => {
    const now = Date.now();
    // # Two demuxed vods with some different languages.
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
        const seqSegments2 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments1["354000"][0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts");
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1 - 1].discontinuity).toBe(true);
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts"
        );
        // Doesn't have norwegian. Puts polish (the deafault) instead
        const seqAudioSegments1 = mockVod.getLiveMediaSequenceAudioSegments("audio-aacl-96", "no", 0);
        // Does have norwegian, stiches with a copy of segs from polish last seq.
        const seqAudioSegments2 = mockVod2.getLiveMediaSequenceAudioSegments("audio-aacl-96", "no", 0);
        expect(seqAudioSegments1[0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_pl-1.aac");
        expect(seqAudioSegments2[seqAudioSegments2.length - 1 - 1 - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_pl-26.aac"
        );
        expect(seqAudioSegments2[seqAudioSegments2.length - 1 - 1].discontinuity).toBe(true);
        expect(seqAudioSegments2[seqAudioSegments2.length - 1].uri).toEqual("http://mock.com/media_mock/audioplaylist/i-audio_no-1.aac");
        done();
      });
  });

  it("can handle vod after another vod, loading same groupId but missing a language, type 2", (done) => {
    const now = Date.now();
    // # Two demuxed vods with some different languages.
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
        const seqSegments2 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments1["354000"][0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts");
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1 - 1].discontinuity).toBe(true);
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts"
        );
        // Does have zxx.
        const seqAudioSegments1 = mockVod.getLiveMediaSequenceAudioSegments("audio-aacl-96", "zxx", 0);
        // Does not have zxx, points to default lang ('de') segments instead and
        // stitches with a copy of default segs from prev vod's last seq.
        const seqAudioSegments2 = mockVod2.getLiveMediaSequenceAudioSegments("audio-aacl-96", "zxx", 0);
        expect(seqAudioSegments1[0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_zxx-1.aac");
        expect(seqAudioSegments2[seqAudioSegments2.length - 1 - 1 - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_de-26.aac"
        );
        expect(seqAudioSegments2[seqAudioSegments2.length - 1 - 1].discontinuity).toBe(true);
        expect(seqAudioSegments2[seqAudioSegments2.length - 1].uri).toEqual("http://mock.com/media_mock/audioplaylist/i-audio_de-1.aac");
        done();
      });
  });

  it("can handle vod after another vod that has different Group ID & Language", (done) => {
    const now = Date.now();
    // # Two demuxed vods with different languages.
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
        const seqSegments2 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments1["354000"][0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts");
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1 - 1].discontinuity).toBe(true);
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts"
        );
        const seqAudioSegments1 = mockVod.getLiveMediaSequenceAudioSegments("audio-aacl-96", "pl", 0);
        const seqAudioSegments2 = mockVod2.getLiveMediaSequenceAudioSegments("aac", "sv", 0);
        expect(seqAudioSegments1[0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_pl-1.aac");
        //expect(seqAudioSegments2[seqAudioSegments2.length - 1 - 1].discontinuity).toBe(true);
        // # This isn't the final expected behavior.
        // # Right now Test fails.
        expect(seqAudioSegments2[0].uri).toEqual("http://mock.com/media_mock/audioplaylist/i-audio_sv-1.aac");
        done();
      });
  });

  it("can handle vod after another vod that has different Group ID & same Language", (done) => {
    const now = Date.now();
    // # Two demuxed vods with different languages.
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
        const seqSegments2 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments1["354000"][0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts");
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1 - 1].discontinuity).toBe(true);
        expect(seqSegments2["354000"][seqSegments2["354000"].length - 1].uri).toEqual(
          "http://mock.com/1woxvooiidb(11186147_ISMUSP)-video=241929-1.ts"
        );
        const seqAudioSegments1 = mockVod.getLiveMediaSequenceAudioSegments("audio-aacl-96", "de", 0);
        const seqAudioSegments2 = mockVod2.getLiveMediaSequenceAudioSegments("aac", "de", 0);
        expect(seqAudioSegments1[0].uri).toEqual("http://mock.com/1woxvooiidb(11186147_ISMUSP)-audio=96000_de-1.aac");
        //expect(seqAudioSegments2[seqAudioSegments2.length - 1 - 1].discontinuity).toBe(true);
        // # This isn't the final expected behavior.
        // # Right now Test fails.
        //expect(seqAudioSegments2[0].uri).toEqual("http://mock.com/media_mock/audioplaylist/i-audio_de-1.aac);
        done();
      });
  });

  it("can return an audio variant manifest", (done) => {
    const now = Date.now();
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaAudioSequences(0, "audio-aacl-96", "en", 0);
        let m = m3u8.match("#EXT-X-DISCONTINUITY\n");
        expect(m).not.toBeNull();
        done();
      });
  });

  it("handles start time offset correctly when 27 seconds", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 27 * 1000);
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      const seqSegments = mockVod.getLiveMediaSequenceSegments(0);
      let m3u8 = mockVod.getLiveMediaAudioSequences(0, "audio-aacl-96", "en", 0);
      let m3u8v = mockVod.getLiveMediaSequences(0, "354000", 0);
      // TODO: Verify that all bitrates have the same length
      //console.log(m3u8, m3u8v, 123);
      done();
    });
  });
});

describe("HLSVod with discontinuites in the source", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;
  let mockMasterManifest2;
  let mockMediaManifest2;
  let mockAudioManifest2;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls5/master.m3u8");
    };
    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls6/master.m3u8");
    };
    mockMediaManifest = function (bandwidth) {
      const fname = {
        401000: "1.m3u8",
      };
      return fs.createReadStream("testvectors/hls5/" + fname[bandwidth]);
    };
    mockAudioManifest = function (groupId) {
      const fname = {
        aac: "7.m3u8",
      };
      return fs.createReadStream("testvectors/hls5/" + fname[groupId]);
    };
    mockMediaManifest2 = function (bandwidth) {
      const fname = {
        401000: "1.m3u8",
      };
      return fs.createReadStream("testvectors/hls6/" + fname[bandwidth]);
    };
    mockAudioManifest2 = function (groupId) {
      const fname = {
        aac: "7.m3u8",
      };
      return fs.createReadStream("testvectors/hls6/" + fname[groupId]);
    };
  });

  it("maintain discontinuities", (done) => {
    const now = Date.now();
    mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
      expect(seqSegments1["401000"][2].discontinuity).toBe(true);

      let m3u8 = mockVod.getLiveMediaAudioSequences(0, "aac", "en", 0);
      let m = m3u8.match("#EXT-X-DISCONTINUITY\n");
      expect(m).not.toBeNull();
      done();
    });
  });

  it("increments discontinuity sequence correctly, and update and stores last used discontinuity counter", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8");
    let i = 0;
    mockVod
      .load(mockMasterManifest, mockMediaManifest, mockAudioManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest2);
      })
      .then(() => {
        let m3u8 = mockVod.getLiveMediaSequences(0, "401000", 1, 0);
        let m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:0");
        expect(m).not.toBeNull();
        expect(mockVod.getLastUsedDiscSeq()).toEqual(0);
        let l = mockVod.getLastDiscontinuity();
        m3u8 = mockVod.getLiveMediaSequences(0, "401000", 2, 0);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:1");
        expect(m).not.toBeNull();
        expect(mockVod.getLastUsedDiscSeq()).toEqual(1);
        let c = mockVod.getLiveMediaSequencesCount();
        m3u8 = mockVod2.getLiveMediaSequences(c, "401000", 13, l);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:1");
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(c, "401000", 14, l);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:2");
        expect(mockVod2.getLastUsedDiscSeq()).toEqual(2);
        expect(m).not.toBeNull();
        m3u8 = mockVod2.getLiveMediaSequences(c, "401000", 17, l);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:3");
        expect(mockVod2.getLastUsedDiscSeq()).toEqual(3);
        expect(m).not.toBeNull();
        expect(mockVod2.getLastDiscontinuity()).toEqual(4);
        i = c + mockVod2.getLiveMediaSequencesCount();
        return mockVod3.loadAfter(mockVod2, mockMasterManifest, mockMediaManifest, mockAudioManifest);
      })
      .then(() => {
        let j = mockVod2.getLastDiscontinuity();
        let m3u8 = mockVod3.getLiveMediaSequences(i, "401000", 0, j);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:4");
        expect(mockVod3.getLastUsedDiscSeq()).toEqual(4);
        expect(m).not.toBeNull();
        m3u8 = mockVod3.getLiveMediaSequences(i, "401000", 14, j);
        m = m3u8.match("#EXT-X-DISCONTINUITY-SEQUENCE:5");
        expect(mockVod3.getLastUsedDiscSeq()).toEqual(5);
        expect(m).not.toBeNull();
        done();
      });
  });
});

describe("HLSVod with ad tags", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls8/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls8/" + fname[bandwidth]);
    };
  });

  it("includes ad tags", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let m3u8 = mockVod.getLiveMediaSequences(0, "1010931", 0);
      let m = m3u8.match("#EXT-X-CUE-OUT:DURATION=30");
      expect(m).not.toBeNull();
      m = m3u8.match("#EXT-X-CUE-IN");
      expect(m).not.toBeNull();
      done();
    });
  });
});

describe("HLSVod with audio manifest and ad tags", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls7/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        354000: "video-241929.m3u8",
        819000: "video-680761.m3u8",
        1538000: "video-1358751.m3u8",
        2485000: "video-2252188.m3u8",
        3396000: "video-3112126.m3u8",
      };
      return fs.createReadStream("testvectors/hls7/" + fname[bandwidth]);
    };
    mockAudioManifest = function (groupId) {
      const fname = {
        "audio-aacl-96": "audio-96000.m3u8",
      };
      return fs.createReadStream("testvectors/hls7/" + fname[groupId]);
    };
  });

  it("includes ad tags", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      let m3u8 = mockVod.getLiveMediaSequences(0, "354000", 0);
      let m = m3u8.match("#EXT-X-CUE-OUT:DURATION=30");
      expect(m).not.toBeNull();
      done();
    });
  });
});

describe("HLSVod with ad tags after another VOD", () => {
  let mockMasterManifest1;
  let mockMediaManifest1;
  let mockMasterManifest2;
  let mockMediaManifest2;

  beforeEach(() => {
    mockMasterManifest1 = function () {
      return fs.createReadStream("testvectors/hls9/master.m3u8");
    };

    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls8/master.m3u8");
    };

    mockMediaManifest1 = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls9/" + fname[bandwidth]);
    };

    mockMediaManifest2 = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls8/" + fname[bandwidth]);
    };
  });

  it("includes ad tags", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2);
      })
      .then(() => {
        let m3u8 = mockVod2.getLiveMediaSequences(0, "1010931", 0);
        let m;
        m = m3u8.match(/#EXT-X-TARGETDURATION:\d+/);
        expect(m).not.toBeNull();
        m = m3u8.match("#EXT-X-CUE-OUT:DURATION=30");
        expect(m).not.toBeNull();
        done();
      });
  });
});

describe("Two short HLSVods", () => {
  let mockMasterManifest = [];
  let mockMediaManifest = [];
  const vectorPath = "hls9";
  const vectorPath2 = "hls10";
  const vectorPath3 = "hls13";
  const vectorPath4 = "hls12";
  beforeEach(() => {
    mockMasterManifest[0] = function () {
      return fs.createReadStream("testvectors/" + vectorPath + "/master.m3u8");
    };
    mockMediaManifest[0] = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/" + vectorPath + "/" + fname[bandwidth]);
    };
    mockMasterManifest[1] = function () {
      return fs.createReadStream("testvectors/" + vectorPath2 + "/master.m3u8");
    };
    mockMediaManifest[1] = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/" + vectorPath2 + "/" + fname[bandwidth]);
    };
    mockMasterManifest[2] = function () {
      return fs.createReadStream("testvectors/" + vectorPath3 + "/master.m3u8");
    };
    mockMediaManifest[2] = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/" + vectorPath3 + "/" + fname[bandwidth]);
    };
    mockMasterManifest[3] = function () {
      return fs.createReadStream("testvectors/" + vectorPath4 + "/master.m3u8");
    };
    mockMediaManifest[3] = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/" + vectorPath4 + "/" + fname[bandwidth]);
    };
  });

  it("provides a correct mediasequence when first VOD has no discontinuity", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod1
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const segsVod1_0 = mockVod1.getLiveMediaSequenceSegments(0);
        const segsVod2_0 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(mockVod1.getLiveMediaSequencesCount()).toEqual(1);
        expect(mockVod2.getLiveMediaSequencesCount()).toEqual(1);

        expect(segsVod2_0["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-2-v1-a1.ts");
        expect(segsVod2_0["1010931"][[segsVod1_0["1010931"].length - 1]].discontinuity).toBe(true); // Identifies discontinuity right after vod1
        expect(segsVod2_0["1010931"][[segsVod2_0["1010931"].length - 1]].uri).toEqual("http://mock.com/1010931/seg-7-v2-a1.ts");
        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });

  it("provides a correct mediasequence when first VOD has discontinuity", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod1
      .load(mockMasterManifest[1], mockMediaManifest[1])
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const segsVod1_0 = mockVod1.getLiveMediaSequenceSegments(0);
        const segsVod2_0 = mockVod2.getLiveMediaSequenceSegments(0);
        expect(segsVod1_0["1010931"][0].discontinuity).toBe(true);
        expect(segsVod2_0["1010931"][0].uri).toEqual(
          "http://mock.com/1010931/seg-2-v2-a1.ts" // Pop seg-1 together with discontinuity tag, to match media sequence count
        );
        expect(segsVod2_0["1010931"][[segsVod1_0["1010931"].length - 1 - 1]].discontinuity).toBe(true); // Identifies discontinuity right after vod1 (takes into account removed disc at start of vod1)
        // With node-m3u8@0.4.1, expect last SegItem to include CUE data
        expect(segsVod2_0["1010931"][[segsVod2_0["1010931"].length - 1]].cue.in).toBe(true);
        expect(segsVod2_0["1010931"][[segsVod2_0["1010931"].length - 1]].uri).toEqual("http://mock.com/1010931/seg-7-v2-a1.ts");
        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });

  it("provides a correct mediasequence when first VOD has no discontinuity and 1 min long", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod1
      .load(mockMasterManifest[2], mockMediaManifest[2])
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const segsVod1_0 = mockVod1.getLiveMediaSequenceSegments(0);
        const segsVod2_0 = mockVod2.getLiveMediaSequenceSegments(0);
        const segsVod2_1 = mockVod2.getLiveMediaSequenceSegments(1);
        expect(segsVod1_0["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-1-v1-a1.ts");
        expect(segsVod2_0["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-3-v1-a1.ts");
        expect(segsVod2_1["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-4-v1-a1.ts");
        expect(segsVod2_0["1010931"][[segsVod2_0["1010931"].length - 2]].discontinuity).toBe(true); // Identifies discontinuity right after vod1
        expect(segsVod2_1["1010931"][[segsVod2_1["1010931"].length] - 1].uri).toEqual("http://mock.com/1010931/seg-2-v2-a1.ts");
        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });

  it("provides a correct mediasequence when loading a VOD shorter than 1 min", (done) => {
    let longVod = new HLSVod("http://mock.com/mock.m3u8");
    let shortVod = new HLSVod("http://mock.com/mock.m3u8");

    longVod
      .load(mockMasterManifest[3], mockMediaManifest[3])
      .then(() => {
        return shortVod.loadAfter(longVod, mockMasterManifest[0], mockMediaManifest[0]);
      })
      .then(() => {
        const segsShortVod_0 = shortVod.getLiveMediaSequenceSegments(0);
        expect(segsShortVod_0["1010931"][segsShortVod_0["1010931"].length - 2].discontinuity).toBe(true);
        expect(segsShortVod_0["1010931"][segsShortVod_0["1010931"].length - 1].uri).toEqual("http://mock.com/1010931/seg-1-v1-a1.ts");
        done();
      });
  });

  it("provides a correct mediasequence when first VOD has no discontinuity and longer than 1 min", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod1
      .load(mockMasterManifest[3], mockMediaManifest[3])
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        const segsVod1_0 = mockVod1.getLiveMediaSequenceSegments(0);
        const segsVod2_0 = mockVod2.getLiveMediaSequenceSegments(0);
        const segsVod2_1 = mockVod2.getLiveMediaSequenceSegments(1);
        expect(segsVod2_0["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-9-v1-a1.ts");
        expect(segsVod2_1["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-10-v1-a1.ts");
        expect(segsVod2_0["1010931"][[segsVod2_0["1010931"].length - 2]].discontinuity).toBe(true);
        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });

  it("provides a correct mediasequence with parts from all three VODs", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    let mockVod3 = new HLSVod("http://mock.com/mock3.m3u8");
    mockVod1
      .load(mockMasterManifest[0], mockMediaManifest[0])
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest[1], mockMediaManifest[1]);
      })
      .then(() => {
        return mockVod3.loadAfter(mockVod2, mockMasterManifest[2], mockMediaManifest[2]);
      })
      .then(() => {
        expect(mockVod1.getLiveMediaSequencesCount()).toEqual(1);
        expect(mockVod2.getLiveMediaSequencesCount()).toEqual(1);
        expect(mockVod3.getLiveMediaSequencesCount()).toEqual(13);

        const seqSegments2_0 = mockVod2.getLiveMediaSequenceSegments(0);
        const seqSegments3_0 = mockVod3.getLiveMediaSequenceSegments(0);
        expect(seqSegments2_0["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-2-v1-a1.ts");
        expect(seqSegments3_0["1010931"][0].uri).toEqual("http://mock.com/1010931/seg-3-v1-a1.ts");
        expect(seqSegments3_0["1010931"][11].discontinuity).toBe(true);
        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });
});

describe("HLSVod with alternative ad tags", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls10/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls10/" + fname[bandwidth]);
    };
  });

  it("includes ad tags when EXT-X-CUE-OUT has no attribute duration", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let m3u8 = mockVod.getLiveMediaSequences(0, "1010931", 0);
      let m = m3u8.match("#EXT-X-CUE-OUT:DURATION=30");
      expect(m).not.toBeNull();
      done();
    });
  });
});

describe("HLSVod with cue-out-cont tags", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls11/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls11/" + fname[bandwidth]);
    };
  });

  it("includes cue-out-cont tags in media sequence", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      let m3u8 = mockVod.getLiveMediaSequences(0, "1010931", 0);
      let m = m3u8.match("#EXT-X-CUE-OUT-CONT:18/28");
      expect(m).not.toBeNull();
      done();
    });
  });
});

describe("HLSVod with mixed target durations", () => {
  let mockMasterManifest1;
  let mockMediaManifest1;
  let mockMasterManifest2;
  let mockMediaManifest2;

  beforeEach(() => {
    mockMasterManifest1 = function () {
      return fs.createReadStream("testvectors/hls14/master.m3u8");
    };

    mockMediaManifest1 = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls14/" + fname[bandwidth]);
    };

    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls12/master.m3u8");
    };

    mockMediaManifest2 = function (bandwidth) {
      const fname = {
        1010931: "index_1010931.m3u8",
      };
      return fs.createReadStream("testvectors/hls12/" + fname[bandwidth]);
    };
  });

  it("sets correct EXT-X-TARGETDURATION", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
    mockVod1
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest2, mockMediaManifest2);
      })
      .then(() => {
        expect(mockVod1.getLiveMediaSequences(0, "1010931", 0).match("EXT-X-TARGETDURATION:4")).not.toBeNull();
        expect(mockVod2.getLiveMediaSequences(0, "1010931", 0).match("EXT-X-TARGETDURATION:10")).not.toBeNull();
        done();
      });
  });

  it("sets correct EXT-X-TARGETDURATION when added 1 second extra 'padding'", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
    mockVod1
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest2, mockMediaManifest2);
      })
      .then(() => {
        expect(mockVod1.getLiveMediaSequences(0, "1010931", 0, 0, 1).match("EXT-X-TARGETDURATION:5")).not.toBeNull();
        expect(mockVod2.getLiveMediaSequences(0, "1010931", 0, 0, 1).match("EXT-X-TARGETDURATION:11")).not.toBeNull();
        done();
      });
  });

  it("sets correct EXT-X-TARGETDURATION with enforced target duration", (done) => {
    let mockVod1 = new HLSVod("http://mock.com/mock.m3u8");
    let mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
    mockVod1
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        return mockVod2.loadAfter(mockVod1, mockMasterManifest2, mockMediaManifest2);
      })
      .then(() => {
        expect(mockVod1.getLiveMediaSequences(0, "1010931", 0, 0, 0, 5).match("EXT-X-TARGETDURATION:5")).not.toBeNull();
        expect(mockVod2.getLiveMediaSequences(0, "1010931", 0, 0, 0, 5).match("EXT-X-TARGETDURATION:5")).not.toBeNull();
        done();
      });
  });

  it("can download and parse a manifest", (done) => {
    let hlsVod = new HLSVod("https://maitv-vod.lab.eyevinn.technology/VINN.mp4/master.m3u8");
    hlsVod.load().then(() => {
      expect(hlsVod.getLiveMediaSequencesCount()).toBeGreaterThan(0);
      done();
    });
  });
});

describe("HLSVod serializing", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };
  });

  it("can be serialized", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest).then(() => {
      expect(mockVod.getLiveMediaSequencesCount()).toBe(290);
      const serialized = mockVod.toJSON();
      let deserializedVod = new HLSVod();
      deserializedVod.fromJSON(serialized);
      expect(deserializedVod.getLiveMediaSequencesCount()).toBe(290);
      done();
    });
  });

  it("can handle a sequence of VODs", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        let seqSegments = mockVod2.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][0].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment291_2_av.ts"
        );
        expect(seqSegments["1497000"][0].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment291_3_av.ts"
        );
        expect(seqSegments["2497000"][[seqSegments["2497000"].length - 1 - 1]].discontinuity).toBe(true); // Discontinuity
        expect(seqSegments["2497000"][[seqSegments["2497000"].length - 1]].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
        );

        const serialized = mockVod2.toJSON();
        let deserializedVod = new HLSVod();
        deserializedVod.fromJSON(serialized);
        seqSegments = deserializedVod.getLiveMediaSequenceSegments(0);
        expect(seqSegments["2497000"][0].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment291_2_av.ts"
        );
        expect(seqSegments["1497000"][0].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment291_3_av.ts"
        );
        expect(seqSegments["2497000"][[seqSegments["2497000"].length - 1 - 1]].discontinuity).toBe(true); // Discontinuity
        expect(seqSegments["2497000"][[seqSegments["2497000"].length - 1]].uri).toEqual(
          "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_2_av.ts"
        );

        done();
      });
  });
});

describe("HLSVod time metadata", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };
  });

  it("can handle inserting start-date and end-date for an asset", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod.addMetadata("start-date", "2020-11-21T10:00:00.000Z");
    mockVod.addMetadata("end-date", "2020-11-21T11:00:00.000Z");
    mockVod.addMetadata("duration", 3600);
    mockVod2.addMetadata("start-date", "2020-11-21T10:00:00.000Z");
    mockVod2.addMetadata("x-title", "Hej hopp");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        let m3u8 = mockVod.getLiveMediaSequences(0, "2497000", 0);
        let m = m3u8.match(
          '#EXT-X-PROGRAM-DATE-TIME:2020-11-21T10:00:00.000Z\n#EXT-X-DATERANGE:START-DATE="2020-11-21T10:00:00.000Z",END-DATE="2020-11-21T11:00:00.000Z",DURATION=3600.000\n#EXTINF:9.000,'
        );
        expect(m).not.toBeNull();

        m3u8 = mockVod2.getLiveMediaSequences(0, "2497000", 0);
        m = m3u8.match(
          '#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:2020-11-21T10:00:00.000Z\n#EXT-X-DATERANGE:START-DATE="2020-11-21T10:00:00.000Z",X-TITLE="Hej hopp"'
        );
        expect(m).not.toBeNull();
        done();
      });
  });
});

describe("HLSVod delta time", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };
  });

  it("is calculated and available for each media sequence", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        let mockVod2Positions = mockVod2.getPlayheadPositions();
        const deltas2 = mockVod2.getDeltaTimes();
        expect(mockVod2Positions.slice(-9)).toEqual([2574, 2583, 2592, 2601, 2610, 2619, 2628, 2637, 2643.266]);
        expect(deltas2.slice(-9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, -2.734]);
        done();
      });
  });
});

describe("HLSVod playhead positions", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockMasterRepeat;
  let mockMediaRepeat;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };

    mockMasterRepeat = function () {
      return fs.createReadStream("testvectors/hls_repeat/master.m3u8");
    };

    mockMediaRepeat = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_repeat/index_" + bandwidth + ".m3u8");
    };
  });

  it("is available for each media sequence", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const positions = mockVod.getPlayheadPositions();
        const positions2 = mockVod2.getPlayheadPositions();
        expect(positions.slice(0, 9)).toEqual([0, 9, 18, 27, 36, 45, 54, 63, 72]);
        expect(positions2.slice(0, 9)).toEqual([0, 9, 18, 27, 36, 45, 54, 63, 72]);
        done();
      });
  });

  it("is handling repeat VODs", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterRepeat, mockMediaRepeat).then(() => {
      const positions = mockVod.getPlayheadPositions();
      expect(positions).toEqual([0]);
      done();
    });
  });
});

describe("HLSVod reload media sequences", () => {
  let mockMasterManifest1;
  let mockMediaManifest1;
  let mockMasterManifest2;
  let mockMediaManifest2;

  beforeEach(() => {
    mockMasterManifest1 = function () {
      return fs.createReadStream("testvectors/hls_reload1/master.m3u8");
    };

    mockMediaManifest1 = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_reload1/1.m3u8");
    };

    mockMasterManifest2 = function () {
      return fs.createReadStream("testvectors/hls_reload2/master.m3u8");
    };

    mockMediaManifest2 = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_reload2/1.m3u8");
    };
  });

  it("can reload at the beginning of a HLSVod", (done) => {
    let vod1segments = {};
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        vod1segments = mockVod.getLiveMediaSequenceSegments(1);
      })
      .then(() => {
        mockVod2.load(mockMasterManifest2, mockMediaManifest2).then(() => {
          mockVod2.reload(0, vod1segments, null).then(() => {
            expect(vod1segments).toEqual(mockVod2.getLiveMediaSequenceSegments(0));
            done();
          });
        });
      });
  });

  it("can reload at the beginning of a HLSVod, and insert segments after live point", (done) => {
    let vod1segments = {};
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        vod1segments = mockVod.getLiveMediaSequenceSegments(1);
        Object.keys(vod1segments).forEach((bw) => vod1segments[bw].unshift({ discontinuity: true }));
      })
      .then(() => {
        mockVod2.load(mockMasterManifest2, mockMediaManifest2).then(() => {
          mockVod2.reload(0, vod1segments, null, true).then(() => {
            expect(vod1segments).toEqual(mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 1));
            done();
          });
        });
      });
  });

  it("can reload at the middle of a HLSVod", (done) => {
    let vod1segments = {};
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        vod1segments = mockVod.getLiveMediaSequenceSegments(1);
        Object.keys(vod1segments).forEach((bw) => vod1segments[bw].push({ discontinuity: true }));
      })
      .then(() => {
        mockVod2.load(mockMasterManifest2, mockMediaManifest2).then(() => {
          const seqSegs = mockVod2.getLiveMediaSequenceSegments(6)["401000"];
          let bottomSegmentPreReload =
            mockVod2.getLiveMediaSequenceSegments(6)["401000"][mockVod2.getLiveMediaSequenceSegments(6)["401000"].length - 1];
          mockVod2.reload(6, vod1segments, null).then(() => {
            let size = mockVod2.getLiveMediaSequenceSegments(1)["401000"].length;
            const seqSegs = mockVod2.getLiveMediaSequenceSegments(1)["401000"];
            expect(mockVod2.getLiveMediaSequenceSegments(1)["401000"][size - 1]).toEqual(bottomSegmentPreReload);
            done();
          });
        });
      });
  });

  it("can reload at the middle of a HLSVod, and insert segments after live point", (done) => {
    let vod1segments = {};
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        vod1segments = mockVod.getLiveMediaSequenceSegments(1);
        Object.keys(vod1segments).forEach((bw) => vod1segments[bw].unshift({ discontinuity: true }));
      })
      .then(() => {
        mockVod2.load(mockMasterManifest2, mockMediaManifest2).then(() => {
          const currentSeq = 7;
          let size = mockVod2.getLiveMediaSequenceSegments(currentSeq)["401000"].length;
          let seqSegs = mockVod2.getLiveMediaSequenceSegments(currentSeq)["401000"];
          let bottomSegmentPreReload = seqSegs[size - 1];
          mockVod2.reload(7, vod1segments, null, true).then(() => {
            expect(mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 2)["401000"][0]).toEqual(
              bottomSegmentPreReload
            );
            done();
          });
        });
      });
  });

  it("can reload at the end of a HLSVod", (done) => {
    let vod1segments = {};
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        vod1segments = mockVod.getLiveMediaSequenceSegments(1);
        Object.keys(vod1segments).forEach((bw) => vod1segments[bw].push({ discontinuity: true }));
      })
      .then(() => {
        mockVod2.load(mockMasterManifest2, mockMediaManifest2).then(() => {
          const finalSeqIdx = mockVod2.getLiveMediaSequencesCount() - 1;
          const finalSeqSegs = mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount(finalSeqIdx) - 1)["401000"];
          const bottomSegmentPreReload = finalSeqSegs[finalSeqSegs.length - 1];
          mockVod2.reload(finalSeqIdx, vod1segments, null).then(() => {
            let size = mockVod2.getLiveMediaSequenceSegments(1)["401000"].length;
            expect(mockVod2.getLiveMediaSequenceSegments(1)["401000"][size - 1]).toEqual(bottomSegmentPreReload);
            done();
          });
        });
      });
  });

  it("can reload at the end of a HLSVod, and insert segments after live point", (done) => {
    let vod1segments = {};
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest1, mockMediaManifest1)
      .then(() => {
        vod1segments = mockVod.getLiveMediaSequenceSegments(1);
        Object.keys(vod1segments).forEach((bw) => vod1segments[bw].unshift({ discontinuity: true }));
      })
      .then(() => {
        mockVod2.load(mockMasterManifest2, mockMediaManifest2).then(() => {
          let size = mockVod2.getLiveMediaSequenceSegments(12)["401000"].length;

          let bottomSegmentPreReload = mockVod2.getLiveMediaSequenceSegments(12)["401000"][size - 1];
          mockVod2.reload(12, vod1segments, null, true).then(() => {
            expect(mockVod2.getLiveMediaSequenceSegments(mockVod2.getLiveMediaSequencesCount() - 2)["401000"][0]).toEqual(
              bottomSegmentPreReload
            );
            done();
          });
        });
      });
  });
});

describe("HLSVod error handling", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockMediaBrokenManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
    };

    mockMediaBrokenManifest = function (bandwidth) {
      if (bandwidth === 3496000) {
        return fs.createReadStream("testvectors/hls1/ERROR.m3u8");
      } else {
        return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
      }
    };
  });

  it("can handle when one of the media manifests fails to load", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    spyOn(mockVod, "_cleanupOnFailure");
    mockVod
      .load(mockMasterManifest, mockMediaBrokenManifest)
      .then(() => {
        fail("Should have rejected");
        done();
      })
      .catch((err) => {
        expect(mockVod._cleanupOnFailure).toHaveBeenCalled();
        done();
      });
  });

  it("can handle when one of the media manifests in next VOD fails to load", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");
    const cleanUpOnFailure = spyOn(mockVod2, "_cleanupOnFailure").and.callThrough();
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaBrokenManifest);
      })
      .then(() => {
        fail("Should have rejected");
        done();
      })
      .catch((err) => {
        expect(cleanUpOnFailure).toHaveBeenCalled();
        expect(mockVod2._inspect().previousVod).toBeNull();
        expect(mockVod2._inspect().segmentsInitiated).toEqual({});
        expect(mockVod2._inspect().segments).toEqual({});
        expect(mockVod2._inspect().discontinuities).toEqual({});
        done();
      });
  });

  it("can handle when a VOD fails to load and a slate is loaded instead", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8");

    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.load(mockMasterManifest, mockMediaBrokenManifest);
      })
      .then(() => {
        fail("Should have rejected");
        done();
      })
      .catch((err) => {
        const mockVodSlate = new HLSVod("http://mock.com/slate.m3u8");
        mockVodSlate.loadAfter(mockVod, mockMasterManifest, mockMediaManifest).then(() => {
          expect(mockVodSlate.getLiveMediaSequenceSegments(0)["2497000"].length).toEqual(7);
          expect(mockVod2._inspect().previousVod).toBeNull();
          expect(mockVod2._inspect().segmentsInitiated).toEqual({});
          expect(mockVod2._inspect().segments).toEqual({});
          expect(mockVod2._inspect().discontinuities).toEqual({});
          done();
        });
      });
  });
});

describe("HLSVod with set option-> sequenceAlwaysContainNewSegments", () => {
  let mock1_MasterManifest;
  let mock1_MediaManifest;
  let mock2_MasterManifest;
  let mock2_MediaManifest;

  beforeEach(() => {
    mock1_MasterManifest = function () {
      return fs.createReadStream("testvectors/hls_always_0/master.m3u8");
    };

    mock1_MediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_always_0/" + bandwidth + ".m3u8");
    };

    mock2_MasterManifest = function () {
      return fs.createReadStream("testvectors/hls_always_1/master.m3u8");
    };

    mock2_MediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_always_1/" + bandwidth + ".m3u8");
    };
  });

  it("set to true, will never create media sequences that have the same last segment", (done) => {
    const getDur = (list) => {
      let t = 0;
      list.forEach((i) => {
        if (i.duration) {
          t += i.duration;
        }
      });
      return t;
    };
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: true });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: true });
    mockVod
      .load(mock1_MasterManifest, mock1_MediaManifest)
      .then(() => {
        const someBW = Object.keys(mockVod.segments)[0];
        const mseqs = mockVod.mediaSequenceValues;
        const dseqs = mockVod.discontinuities;
        const lastMseq = mockVod.mediaSequences[mockVod.mediaSequences.length - 1]["segments"][someBW];
        const lastMseqTopAndBottomSegURI = {
          top: lastMseq[0].uri,
          bottom: lastMseq[lastMseq.length - 1].uri,
        };

        const expectedMseqVals = {
          0: 0,
          1: 1,
          2: 2,
          3: 3,
          4: 4,
          5: 5,
          6: 6,
          7: 7,
          8: 8,
          9: 9,
          10: 10,
          11: 11,
          12: 12,
          13: 13,
        };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
          10: 1,
          11: 1,
          12: 1,
          13: 1,
        };
        const expectedLastMseqTopAndBottomSegURI = {
          top: "http://mock.com/level0/seg_43.ts",
          bottom: "http://mock.com/level0/seg_52.ts",
        };
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(lastMseqTopAndBottomSegURI).toEqual(expectedLastMseqTopAndBottomSegURI);

        return mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest);
      })
      .then(() => {
        const someBW = Object.keys(mockVod2.segments)[0];
        const mseqs = mockVod2.mediaSequenceValues;
        const dseqs = mockVod2.discontinuities;
        const mseq_0 = mockVod2.mediaSequences[0]["segments"][someBW];
        const mseq_1 = mockVod2.mediaSequences[1]["segments"][someBW];
        const mseq_2 = mockVod2.mediaSequences[2]["segments"][someBW];
        const topAndBottomSegURIList = [];
        topAndBottomSegURIList.push({
          top: mseq_0[0].uri,
          bottom: mseq_0[mseq_0.length - 1 - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_1[0].uri,
          bottom: mseq_1[mseq_1.length - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_2[0].uri,
          bottom: mseq_2[mseq_2.length - 1 - 1].uri,
        });
        const expectedMseqVals = {
          0: 0,
          1: 1,
          2: 2,
          3: 3,
          4: 5,
          5: 7,
          6: 11,
          7: 12,
          8: 13,
        };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 1,
          7: 2,
          8: 2,
        };
        const expectedTopAndBottomSegURIList = [
          {
            top: "http://mock.com/level0/seg_43.ts",
            bottom: "http://mock.com/level0/seg_52.ts",
          },
          {
            top: "http://mock.com/level0/seg_44.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00000.ts",
          },
          {
            top: "http://mock.com/level0/seg_45.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00001.ts",
          },
        ];
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(topAndBottomSegURIList).toEqual(expectedTopAndBottomSegURIList);
        done();
      });
  });

  it("set to false, may create media sequences that have the same last segment, and always steps a mseq by 1", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false });
    mockVod
      .load(mock1_MasterManifest, mock1_MediaManifest)
      .then(() => {
        const someBW = Object.keys(mockVod.segments)[0];
        const mseqs = mockVod.mediaSequenceValues;
        const dseqs = mockVod.discontinuities;
        const lastMseq = mockVod.mediaSequences[mockVod.mediaSequences.length - 1]["segments"][someBW];
        const lastMseqTopAndBottomSegURI = {
          top: lastMseq[0].uri,
          bottom: lastMseq[lastMseq.length - 1].uri,
        };
        // Assert
        const expectedMseqVals = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12 };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
          10: 1,
          11: 1,
          12: 1,
        };
        const expectedLastMseqTopAndBottomSegURI = {
          top: "http://mock.com/level0/seg_42.ts",
          bottom: "http://mock.com/level0/seg_52.ts",
        };
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(lastMseqTopAndBottomSegURI).toEqual(expectedLastMseqTopAndBottomSegURI);

        return mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest);
      })
      .then(() => {
        const someBW = Object.keys(mockVod2.segments)[0];
        const mseqs = mockVod2.mediaSequenceValues;
        const dseqs = mockVod2.discontinuities;
        const mseq_0 = mockVod2.mediaSequences[0]["segments"][someBW];
        const mseq_1 = mockVod2.mediaSequences[1]["segments"][someBW];
        const mseq_2 = mockVod2.mediaSequences[2]["segments"][someBW];
        const mseq_3 = mockVod2.mediaSequences[3]["segments"][someBW];
        const mseq_4 = mockVod2.mediaSequences[4]["segments"][someBW];
        const topAndBottomSegURIList = [];
        topAndBottomSegURIList.push({
          top: mseq_0[0].uri,
          bottom: undefined,
        });
        topAndBottomSegURIList.push({
          top: mseq_1[0].uri,
          bottom: mseq_1[mseq_1.length - 1 - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_2[0].uri,
          bottom: mseq_2[mseq_2.length - 1 - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_3[0].uri,
          bottom: mseq_3[mseq_3.length - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_4[0].uri,
          bottom: mseq_4[mseq_4.length - 1].uri,
        });
        // Assert
        const expectedMseqVals = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13 };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          10: 1,
          11: 1,
          12: 2,
          13: 2,
        };
        const sameSegment1 = "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00001.ts";
        const sameSegment2 = "http://mock.com/level0/seg_0000.ts";
        const expectedTopAndBottomSegURIList = [
          {
            top: "http://mock.com/level0/seg_43.ts",
            bottom: undefined,
          },
          {
            top: "http://mock.com/level0/seg_44.ts",
            bottom: sameSegment1,
          },
          {
            top: "http://mock.com/level0/seg_45.ts",
            bottom: sameSegment1,
          },
          {
            top: "http://mock.com/level0/seg_46.ts",
            bottom: sameSegment2,
          },
          {
            top: "http://mock.com/level0/seg_47.ts",
            bottom: sameSegment2,
          },
        ];
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(topAndBottomSegURIList).toEqual(expectedTopAndBottomSegURIList);
        done();
      });
  });
});

describe("HLSVod for demuxed audio, with set option-> sequenceAlwaysContainNewSegments", () => {
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
      return fs.createReadStream("testvectors/hls_always_1_demux/master.m3u8");
    };
    mock2_MediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_always_1_demux/" + bandwidth + ".m3u8");
    };
    mock2_AudioManifest = function (groupId, lang) {
      if (groupId && lang) {
        return fs.createReadStream(`testvectors/hls_always_1_demux/${groupId}-${lang}.m3u8`);
      } else {
        return fs.createReadStream(`testvectors/hls_always_1_demux/${groupId}.m3u8`);
      }
    };
  });

  it("set to true, will never create media sequences that have the same last segment", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: 1 });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: 1 });
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: 1 });
    mockVod
      .load(mock1_MasterManifest, mock1_MediaManifest, mock1_AudioManifest)
      .then(() => {
        const someBW = Object.keys(mockVod.segments)[0];
        const someGroupId = Object.keys(mockVod.audioSegments)[0];
        const someLang = Object.keys(mockVod.audioSegments[someGroupId])[0];
        const mseqs = mockVod.mediaSequenceValues;
        const mseqsa = mockVod.mediaSequenceValuesAudio;
        const dseqs = mockVod.discontinuities;
        const daseqs = mockVod.discontinuitiesAudio;
        const lastMseq = mockVod.mediaSequences[mockVod.mediaSequences.length - 1]["segments"][someBW];
        const lastMseqTopAndBottomSegURI = {
          top: lastMseq[0].uri,
          bottom: lastMseq[lastMseq.length - 1].uri,
        };
        const lastMseqAudio = mockVod.mediaSequences[mockVod.mediaSequences.length - 1]["audioSegments"][someGroupId][someLang];
        const lastMseqTopAndBottomSegURIAudio = {
          top: lastMseqAudio[0].uri,
          bottom: lastMseqAudio[lastMseqAudio.length - 1].uri,
        };
        const expectedMseqVals = {
          0: 0,
          1: 1,
          2: 2,
          3: 3,
          4: 4,
          5: 5,
          6: 6,
          7: 7,
          8: 8,
          9: 9,
          10: 10,
          11: 11,
          12: 12,
          13: 13,
          14: 14,
        };
        const expectedMseqValsAudio = {
          0: 0,
          1: 1,
          2: 2,
          3: 3,
          4: 4,
          5: 5,
          6: 6,
          7: 7,
          8: 8,
          9: 9,
          10: 10,
          11: 11,
          12: 12,
          13: 13,
          14: 14,
        };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
          10: 1,
          11: 1,
          12: 1,
          13: 1,
          14: 1,
        };
        const expectedDseqValsAudio = {
          0: 0,
          1: 0,
          2: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
          10: 1,
          11: 1,
          12: 1,
          13: 1,
          14: 1,
        };
        const expectedLastMseqTopAndBottomSegURI = {
          top: "http://mock.com/level0/seg_44.ts",
          bottom: "http://mock.com/level0/seg_52.ts",
        };
        const expectedLastMseqTopAndBottomSegURIAudio = {
          top: "http://mock.com/audio/seg_en_44.ts",
          bottom: "http://mock.com/audio/seg_en_52.ts",
        };
        expect(mseqs).toEqual(expectedMseqVals);
        expect(mseqsa).toEqual(expectedMseqValsAudio);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(daseqs).toEqual(expectedDseqValsAudio);
        expect(lastMseqTopAndBottomSegURI).toEqual(expectedLastMseqTopAndBottomSegURI);
        expect(lastMseqTopAndBottomSegURIAudio).toEqual(expectedLastMseqTopAndBottomSegURIAudio);

        return mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest, mock2_AudioManifest);
      })
      .then(() => {
        const someBW = Object.keys(mockVod2.segments)[0];
        const someGroupId = Object.keys(mockVod2.audioSegments)[0];
        const someLang = Object.keys(mockVod2.audioSegments[someGroupId])[0];
        const mseqs = mockVod2.mediaSequenceValues;
        const dseqs = mockVod2.discontinuities;
        const mseq_0_v = mockVod2.mediaSequences[0]["segments"][someBW];
        const mseq_1_v = mockVod2.mediaSequences[1]["segments"][someBW];
        const mseq_2_v = mockVod2.mediaSequences[2]["segments"][someBW];
        const mseq_0_a = mockVod2.mediaSequences[0]["audioSegments"][someGroupId][someLang];
        const mseq_1_a = mockVod2.mediaSequences[1]["audioSegments"][someGroupId][someLang];
        const mseq_2_a = mockVod2.mediaSequences[2]["audioSegments"][someGroupId][someLang];

        const topAndBottomSegURIList = [];
        topAndBottomSegURIList.push({
          top: mseq_0_v[0].uri,
          bottom: mseq_0_v[mseq_0_v.length - 1 - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_1_v[0].uri,
          bottom: mseq_1_v[mseq_1_v.length - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_2_v[0].uri,
          bottom: mseq_2_v[mseq_2_v.length - 1].uri,
        });

        const topAndBottomSegURIListAudio = [];
        topAndBottomSegURIListAudio.push({
          top: mseq_0_a[0].uri,
          bottom: mseq_0_a[mseq_0_a.length - 1 - 1].uri,
        });
        topAndBottomSegURIListAudio.push({
          top: mseq_1_a[0].uri,
          bottom: mseq_1_a[mseq_1_a.length - 1].uri,
        });
        topAndBottomSegURIListAudio.push({
          top: mseq_2_a[0].uri,
          bottom: mseq_2_a[mseq_2_a.length - 1].uri,
        });

        const expectedMseqVals = {
          0: 0,
          1: 1,
          2: 2,
          3: 4,
          4: 6,
          5: 8,
          6: 10,
          7: 11,
          8: 12,
        };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 1,
          7: 2,
          8: 2,
        };
        const expectedTopAndBottomSegURIList = [
          {
            top: "http://mock.com/level0/seg_44.ts",
            bottom: "http://mock.com/level0/seg_52.ts",
          },
          {
            top: "http://mock.com/level0/seg_45.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00000.ts",
          },
          {
            top: "http://mock.com/level0/seg_46.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00001.ts",
          },
        ];
        const expectedTopAndBottomSegURIListAudio = [
          {
            top: "http://mock.com/audio/seg_en_44.ts",
            bottom: "http://mock.com/audio/seg_en_52.ts",
          },
          {
            top: "http://mock.com/audio/seg_en_45.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/audio/en-00000.ts",
          },
          {
            top: "http://mock.com/audio/seg_en_46.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/audio/en-00001.ts",
          },
        ];
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(topAndBottomSegURIList).toEqual(expectedTopAndBottomSegURIList);
        expect(topAndBottomSegURIListAudio).toEqual(expectedTopAndBottomSegURIListAudio);
        done();
      });
  });

  it("set to false, may create media sequences that have the same last segment, and always steps a mseq by 1", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false });
    mockVod3 = new HLSVod("http://mock.com/mock3.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false });
    mockVod
      .load(mock1_MasterManifest, mock1_MediaManifest, mock1_AudioManifest)
      .then(() => {
        const someBW = Object.keys(mockVod.segments)[0];
        const someGroupId = Object.keys(mockVod.audioSegments)[0];
        const someLang = Object.keys(mockVod.audioSegments[someGroupId])[0];
        const mseqs = mockVod.mediaSequenceValues;
        const dseqs = mockVod.discontinuities;
        const lastMseq = mockVod.mediaSequences[mockVod.mediaSequences.length - 1]["segments"][someBW];
        const lastMseqTopAndBottomSegURI = {
          top: lastMseq[0].uri,
          bottom: lastMseq[lastMseq.length - 1].uri,
        };
        const lastMseqAudio = mockVod.mediaSequences[mockVod.mediaSequences.length - 1]["audioSegments"][someGroupId][someLang];
        const lastMseqTopAndBottomSegURIAudio = {
          top: lastMseqAudio[0].uri,
          bottom: lastMseqAudio[lastMseqAudio.length - 1].uri,
        };

        // Assert
        const expectedMseqVals = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14 };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
          10: 1,
          11: 1,
          12: 1,
          13: 1,
          14: 1,
        };
        const expectedLastMseqTopAndBottomSegURI = {
          top: "http://mock.com/level0/seg_44.ts",
          bottom: "http://mock.com/level0/seg_52.ts",
        };
        const expectedLastMseqTopAndBottomSegURIAudio = {
          top: "http://mock.com/audio/seg_en_44.ts",
          bottom: "http://mock.com/audio/seg_en_52.ts",
        };
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(lastMseqTopAndBottomSegURI).toEqual(expectedLastMseqTopAndBottomSegURI);
        expect(lastMseqTopAndBottomSegURIAudio).toEqual(expectedLastMseqTopAndBottomSegURIAudio);

        return mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest, mock2_AudioManifest);
      })
      .then(() => {
        const someBW = Object.keys(mockVod2.segments)[0];
        const someGroupId = Object.keys(mockVod2.audioSegments)[0];
        const someLang = Object.keys(mockVod2.audioSegments[someGroupId])[0];
        const mseqs = mockVod2.mediaSequenceValues;
        const dseqs = mockVod2.discontinuities;
        const mseq_0_v = mockVod2.mediaSequences[0]["segments"][someBW];
        const mseq_1_v = mockVod2.mediaSequences[1]["segments"][someBW];
        const mseq_2_v = mockVod2.mediaSequences[2]["segments"][someBW];
        const mseq_3_v = mockVod2.mediaSequences[3]["segments"][someBW];
        const mseq_4_v = mockVod2.mediaSequences[4]["segments"][someBW];
        const mseq_0_a = mockVod2.mediaSequences[0]["audioSegments"][someGroupId][someLang];
        const mseq_1_a = mockVod2.mediaSequences[1]["audioSegments"][someGroupId][someLang];
        const mseq_2_a = mockVod2.mediaSequences[2]["audioSegments"][someGroupId][someLang];
        const mseq_3_a = mockVod2.mediaSequences[3]["audioSegments"][someGroupId][someLang];
        const mseq_4_a = mockVod2.mediaSequences[4]["audioSegments"][someGroupId][someLang];

        const topAndBottomSegURIList = [];
        topAndBottomSegURIList.push({
          top: mseq_0_v[0].uri,
          bottom: mseq_0_v[mseq_0_v.length - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_1_v[0].uri,
          bottom: mseq_1_v[mseq_1_v.length - 1 - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_2_v[0].uri,
          bottom: mseq_2_v[mseq_2_v.length - 1 - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_3_v[0].uri,
          bottom: mseq_3_v[mseq_3_v.length - 1].uri,
        });
        topAndBottomSegURIList.push({
          top: mseq_4_v[0].uri,
          bottom: mseq_4_v[mseq_4_v.length - 1].uri,
        });

        const topAndBottomSegURIListAudio = [];
        topAndBottomSegURIListAudio.push({
          top: mseq_0_a[0].uri,
          bottom: mseq_0_a[mseq_0_a.length - 1].uri,
        });
        topAndBottomSegURIListAudio.push({
          top: mseq_1_a[0].uri,
          bottom: mseq_1_a[mseq_1_a.length - 1 - 1].uri,
        });
        topAndBottomSegURIListAudio.push({
          top: mseq_2_a[0].uri,
          bottom: mseq_2_a[mseq_2_a.length - 1 - 1].uri,
        });
        topAndBottomSegURIListAudio.push({
          top: mseq_3_a[0].uri,
          bottom: mseq_3_a[mseq_3_a.length - 1].uri,
        });
        topAndBottomSegURIListAudio.push({
          top: mseq_4_a[0].uri,
          bottom: mseq_4_a[mseq_4_a.length - 1].uri,
        });
        // Assert
        const expectedMseqVals = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11 };
        const expectedDseqVals = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 1,
          9: 1,
          10: 2,
          11: 2,
        };

        const sameSegment1 = "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00001.ts";
        const sameSegment2 = "http://mock.com/level0/seg_0000.ts";
        const expectedTopAndBottomSegURIList = [
          {
            top: "http://mock.com/level0/seg_45.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/level0/2000-00000.ts",
          },
          {
            top: "http://mock.com/level0/seg_46.ts",
            bottom: sameSegment1,
          },
          {
            top: "http://mock.com/level0/seg_47.ts",
            bottom: sameSegment1,
          },
          {
            top: "http://mock.com/level0/seg_48.ts",
            bottom: sameSegment2,
          },
          {
            top: "http://mock.com/level0/seg_49.ts",
            bottom: sameSegment2,
          },
        ];
        const sameSegmentAudio1 = "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/audio/en-00001.ts";
        const sameSegmentAudio2 = "http://mock.com/audio/seg_en_0000.ts";
        const expectedTopAndBottomSegURIListAudio = [
          {
            top: "http://mock.com/audio/seg_en_45.ts",
            bottom: "https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/audio/en-00000.ts",
          },
          {
            top: "http://mock.com/audio/seg_en_46.ts",
            bottom: sameSegmentAudio1,
          },
          {
            top: "http://mock.com/audio/seg_en_47.ts",
            bottom: sameSegmentAudio1,
          },
          {
            top: "http://mock.com/audio/seg_en_48.ts",
            bottom: sameSegmentAudio2,
          },
          {
            top: "http://mock.com/audio/seg_en_49.ts",
            bottom: sameSegmentAudio2,
          },
        ];
        expect(mseqs).toEqual(expectedMseqVals);
        expect(dseqs).toEqual(expectedDseqVals);
        expect(topAndBottomSegURIList).toEqual(expectedTopAndBottomSegURIList);
        expect(topAndBottomSegURIListAudio).toEqual(expectedTopAndBottomSegURIListAudio);
        done();
      });
  });
});

describe("HLSVod when loading mux vod after demux vod, with set option-> forcedDemuxMode", () => {
  let mock1_MasterManifest;
  let mock1_MediaManifest;
  let mock1_AudioManifest;
  let mock2_MasterManifest;
  let mock2_MediaManifest;

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
  });

  it("test that it rejects as expected", (done) => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false, forcedDemuxMode: true });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false, forcedDemuxMode: true });
    mockVod.load(mock1_MasterManifest, mock1_MediaManifest, mock1_AudioManifest).then(() => {
      mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest).catch((e) => {
        expect(e.message).toEqual("The vod is not a demux vod");
        done();
      });
    });
  });
});

describe("HLSVod delta time and positions", () => {
  let mockMasterManifest;
  let mockMediaManifest;

  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_deltatimes/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_deltatimes/" + bandwidth + ".m3u8");
    };
  });

  it("with option-> sequenceAlwaysContainNewSegments set to true, are calculated and available for each media sequence", (done) => {
    let bool = 1;
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const getDur = (list) => {
          let tot = 0;
          list.forEach((seg) => {
            if (seg.duration) {
              tot += seg.duration;
            }
          });
          return tot;
        };
        const playheadPositions = mockVod2.getPlayheadPositions();
        const deltaTimes = mockVod2.getDeltaTimes();
        let bw_ = mockVod2.getBandwidths()[0];
        let seqWithNoNewSegmentCount = 0;
        mockVod2.mediaSequences.forEach((seq, index) => {
          if (index + 1 < mockVod2.mediaSequences.length) {
            let nextseqsegs = mockVod2.mediaSequences[index + 1].segments[bw_];
            let nextLast = nextseqsegs[nextseqsegs.length - 1];
            let seqsegs = seq.segments[bw_];
            let last = seqsegs[seqsegs.length - 1];
            if (last.uri && nextLast.uri) {
              if (last.uri === nextLast.uri) {
                seqWithNoNewSegmentCount++;
              }
            }
          }
        });
        let allsegs = mockVod2.segments[bw_];
        const secondVodDuration = getDur(allsegs) - getDur(mockVod2.mediaSequences[0].segments[bw_]) + 3 + 3;
        const expectedPlayheadPositions = [
          0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 52.5, 56.5, 60.5, 64.5, 68.5, 72.5, 75.5, 79.5, 83.5, 87.5, 91.5,
          95.5, 99.5, 103.5, 107.5, 111.5, 115.5, 119.5, 123.5, 127.5, 131.5, 135.5, 139.5, 143.5, 149.5, 152.5, 155.5, 161.5, 164.5, 167.5,
          173.5, 176.5, 179.5, 185.5, 188.5, 191.5, 197.5, 199,
        ];
        const expectedDeltaTimes = [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1.5, 3.5, 0, 0, 0, 0, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2,
          0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, -1.5,
        ];
        const expectedSeqcount = 56;
        const expectedVodSegmentsCount = 88;
        const expectedVodDuration = 205;
        const expectedSeqWithNoNewSegmentCount = 0;

        expect(playheadPositions).toEqual(expectedPlayheadPositions);
        expect(deltaTimes).toEqual(expectedDeltaTimes);
        expect(mockVod2.mediaSequences.length).toEqual(expectedSeqcount);
        expect(mockVod2.segments[bw_].length).toEqual(expectedVodSegmentsCount);
        expect(secondVodDuration).toEqual(expectedVodDuration);
        expect(seqWithNoNewSegmentCount).toEqual(expectedSeqWithNoNewSegmentCount);

        done();
      });
  });
  it("with option-> sequenceAlwaysContainNewSegments set to false, are calculated the original way and available for each media sequence", (done) => {
    let bool = 0;
    mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
    mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
    mockVod
      .load(mockMasterManifest, mockMediaManifest)
      .then(() => {
        return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest);
      })
      .then(() => {
        const getDur = (list) => {
          let tot = 0;
          list.forEach((seg) => {
            if (seg.duration) {
              tot += seg.duration;
            }
          });
          return tot;
        };
        const playheadPositions = mockVod2.getPlayheadPositions();
        const deltaTimes = mockVod2.getDeltaTimes();
        let bw_ = mockVod2.getBandwidths()[0];
        let seqWithNoNewSegmentCount = 0;
        mockVod2.mediaSequences.forEach((seq, index) => {
          if (index + 1 < mockVod2.mediaSequences.length) {
            let nextseqsegs = mockVod2.mediaSequences[index + 1].segments[bw_];
            let nextLast = nextseqsegs[nextseqsegs.length - 1];
            let seqsegs = seq.segments[bw_];
            let last = seqsegs[seqsegs.length - 1];
            if (last.uri && nextLast.uri) {
              if (last.uri === nextLast.uri) {
                seqWithNoNewSegmentCount++;
              }
            }
          }
        });
        let allsegs = mockVod2.segments[bw_];
        const secondVodDuration = getDur(allsegs) - getDur(mockVod2.mediaSequences[0].segments[bw_]) + 3 + 3;
        const expectedPlayheadPositions = [
          0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 49, 49.5, 50, 54, 58, 62, 66, 70, 74, 78, 81, 85, 89, 93, 97, 101,
          105, 109, 113, 117, 121, 125, 129, 133, 137, 141, 145, 149, 153, 157, 161, 165, 168, 171, 174, 177, 180, 183, 186, 189, 192, 195, 198,
          201, 204, 204.5,
        ];
        const expectedDeltaTimes = [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, -0.5, 0, 3.5, 0, 0, 0, 0, 0, 0, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2.5,
        ];
        const expectedSeqcount = 63;
        const expectedVodSegmentsCount = 89;
        const expectedVodDuration = 205;
        const expectedSeqWithNoNewSegmentCount = 7;

        expect(playheadPositions).toEqual(expectedPlayheadPositions);
        expect(deltaTimes).toEqual(expectedDeltaTimes);
        expect(mockVod2.mediaSequences.length).toEqual(expectedSeqcount);
        expect(mockVod2.segments[bw_].length).toEqual(expectedVodSegmentsCount);
        expect(secondVodDuration).toEqual(expectedVodDuration);
        expect(seqWithNoNewSegmentCount).toEqual(expectedSeqWithNoNewSegmentCount);

        done();
      });
  });

  describe("HLSVod when loading demuxed vod after another demux vod,", () => {
    let mock1_MasterManifest;
    let mock1_MediaManifest;
    let mock1_AudioManifest;
    let mock2_MasterManifest;
    let mock2_MediaManifest;
    let mock2_AudioManifest;

    beforeEach(() => {
      mock1_MasterManifest = function () {
        return fs.createReadStream("testvectors/hls_always_3_demux/master.m3u8");
      };
      mock1_MediaManifest = function (bandwidth) {
        return fs.createReadStream("testvectors/hls_always_3_demux/" + bandwidth + ".m3u8");
      };
      mock1_AudioManifest = function (groupId, lang) {
        if (groupId && lang) {
          return fs.createReadStream(`testvectors/hls_always_3_demux/${groupId}-${lang}.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_always_3_demux/${groupId}.m3u8`);
        }
      };
      mock2_MasterManifest = function () {
        return fs.createReadStream("testvectors/hls_always_4_demux/master.m3u8");
      };
      mock2_MediaManifest = function (bandwidth) {
        return fs.createReadStream("testvectors/hls_always_4_demux/" + bandwidth + ".m3u8");
      };
      mock2_AudioManifest = function (groupId, lang) {
        if (groupId && lang) {
          let mapper = {
            aac: "aacx",
            en: "sv",
          };
          return fs.createReadStream(`testvectors/hls_always_4_demux/${mapper[groupId]}-${mapper[lang]}.m3u8`);
        } else {
          return fs.createReadStream(`testvectors/hls_always_4_demux/${groupId}.m3u8`);
        }
      };
    });

    it("and there is no matching group ID, then it sets default target group ID to load next VOD segments into", (done) => {
      mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false, forcedDemuxMode: true });
      mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: false, forcedDemuxMode: true });
      mockVod.load(mock1_MasterManifest, mock1_MediaManifest, mock1_AudioManifest).then(() => {
        mockVod2.loadAfter(mockVod, mock2_MasterManifest, mock2_MediaManifest, mock2_AudioManifest).then(() => {
          let m3u8 = mockVod2.getLiveMediaAudioSequences(0, "aac", "en", 2);
          let lines = m3u8.split("\n");
          expect(lines[17]).toBe(`http://mock.com/audio/seg_en_52.ts`);
          expect(lines[21]).toBe(`https://maitv-vod.lab.eyevinn.technology/ads/apotea-15s.mp4/audio/sv-00000.ts`);
          done();
        });
      });
    });
  });
});
