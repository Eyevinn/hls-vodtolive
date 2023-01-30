const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;

describe("HLSVod with subtitles", () => {
    beforeEach(() => {
        mockMasterManifest = function () {
            return fs.createReadStream("testvectors/hls_subs/master.m3u8");
        };


        mockMasterManifest2 = function () {
            return fs.createReadStream("testvectors/hls_subs2/master.m3u8");
        };

        mockMasterManifest3 = function () {
            return fs.createReadStream("testvectors/hls_subs3/master.m3u8");
        };
        mockMasterManifest4 = function () {
            return fs.createReadStream("testvectors/hls1/master.m3u8");
        };

        mockMediaManifest = function () {
            return fs.createReadStream("testvectors/hls_subs/b2962000-video.m3u8");
        };

        mockMediaManifest2 = function () {
            return fs.createReadStream("testvectors/hls_subs2/video.m3u8");
        };

        mockMediaManifest3 = function () {
            return fs.createReadStream("testvectors/hls_subs3/b2962000-video.m3u8");
        }

        mockMediaManifest4 = function (bandwidth) {
            return fs.createReadStream("testvectors/hls1/" + bandwidth + ".m3u8");
        }

        mockSubtitleManifest = function (_, lang) {
            const langs = {
                "zh": "chinese",
                "fr": "french"
            }
            if (lang) {
                return fs.createReadStream(`testvectors/hls_subs/${langs[lang]}-ed.m3u8`);
            } else {
                return fs.createReadStream(`testvectors/hls_subs/french-ed.m3u8`);
            }
        };

        mockSubtitleManifest2 = function () {
            return fs.createReadStream(`testvectors/hls_subs2/subs.m3u8`);
        };

        mockSubtitleManifest3 = function (_, lang) {
            const langs = {
                "ru": "russian",
                "fr": "french"
            }
            if (lang) {
                return fs.createReadStream(`testvectors/hls_subs3/${langs[lang]}-ed.m3u8`);
            } else {
                return fs.createReadStream(`testvectors/hls_subs3/french-ed.m3u8`);
            }
        };
        mockAudioManifest = function () {
            return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
        }
    });

    it("returns the correct number of bandwidths", (done) => {
        mockVod = new HLSVod("http://mock.com/mock.m3u8");
        mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
            expect(mockVod.getBandwidths().length).toBe(1);
            expect(mockVod.getBandwidths()).toEqual(["2962000"]);
            done();
        });
    });
    it("returns the correct first segment", (done) => {
        mockVod = new HLSVod("http://mock.com/mock.m3u8");
        mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
            const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
            const subStrings = m3u8.split("\n")
            expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt?p=1");
            done();
        });
    });

    it("returns the correct subtitle URL", (done) => {
        mockVod = new HLSVod("http://mock.com/mock.m3u8");
        mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
            const seqSubtitleSegments = mockVod.getLiveMediaSequenceSubtitleSegments("subs", "fr");
            expect(seqSubtitleSegments[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
            done();
        });
    });
    it("returns the correct subtitle URL on next chunck", (done) => {
        mockVod = new HLSVod("http://mock.com/mock.m3u8");
        mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
            let m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 24);
            let subStrings = m3u8.split("\n");
            expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt?p=24");
            expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=0");

            m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 25);
            subStrings = m3u8.split("\n");
            expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=0");
            expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=1");
            done();
            m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 49);
            subStrings = m3u8.split("\n");
            expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt?p=24");
            done();
        });
    });
    it("returns the correct segment number", (done) => {
        mockVod = new HLSVod("http://mock.com/mock.m3u8");
        mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
            const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 20);
            const subStrings = m3u8.split("\n")
            expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt?p=20");
            done();
        });
    });

    it("can handle vod after another vod that has different Group ID & Language", (done) => {
        const now = Date.now();
        // # Two subed vods with different languages.
        mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
        mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
        mockVod
            .load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest)
            .then(() => {
                return mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, mockAudioManifest, mockSubtitleManifest2);
            })
            .then(() => {
                const seqSubSegments1 = mockVod.getLiveMediaSequenceSubtitleSegments("subs", "fr", 0);
                const seqSubSegments2 = mockVod2.getLiveMediaSequenceSubtitleSegments("textstream", "sv", 0);
                expect(seqSubSegments1[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                expect(seqSubSegments2[0].uri).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
                done();
            });
    });

    it("can handle vod after another vod that has same Group ID but different Language", (done) => {
        const now = Date.now();
        // # Two subed vods with different languages.
        mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
        mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
        mockVod
            .load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest)
            .then(() => {
                return mockVod2.loadAfter(mockVod, mockMasterManifest3, mockMediaManifest3, mockAudioManifest, mockSubtitleManifest3);
            })
            .then(() => {
                const seqSubSegments1 = mockVod.getLiveMediaSequenceSubtitleSegments("subs", "fr", 0);
                const seqSubSegments2 = mockVod2.getLiveMediaSequenceSubtitleSegments("subs", "ru", 0);
                expect(seqSubSegments1[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                expect(seqSubSegments2[0].uri).toEqual("http://mock.com/subtitlechunk_lzho_w2018715716_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                done();
            });
    });

    it("can handle vod after another vod that has same Group ID & Language", (done) => {
        const now = Date.now();
        // # Two subed vods with different languages.
        mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
        mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
        mockVod
            .load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest)
            .then(() => {
                return mockVod2.loadAfter(mockVod, mockMasterManifest3, mockMediaManifest3, mockAudioManifest, mockSubtitleManifest3);
            })
            .then(() => {
                const seqSubSegments1 = mockVod.getLiveMediaSequenceSubtitleSegments("subs", "fr", 0);
                const seqSubSegments2 = mockVod2.getLiveMediaSequenceSubtitleSegments("subs", "fr", 0);
                expect(seqSubSegments1[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                expect(seqSubSegments2[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                done();
            });
    });

    it("maintain discontinuities", (done) => {
        const now = Date.now();
        mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
        mockVod.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest, mockSubtitleManifest2).then(() => {
            const seqSegments1 = mockVod.getLiveMediaSequenceSegments(0);
            expect(seqSegments1["455000"][1].discontinuity).toBe(true);

            let m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 0);
            let m = m3u8.match("#EXT-X-DISCONTINUITY\n");
            expect(m).not.toBeNull();
            done();
        });
    });

    it("it can handle a vod with no subs after a vod with subs", (done) => {
        const now = Date.now();
        mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
        mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
        mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest)
            .then(() => {
                return mockVod2.loadAfter(mockVod, mockMasterManifest4, mockMediaManifest4);
            }).then(() => {
                const seqSubSegments = mockVod.getLiveMediaSequenceSubtitleSegments("subs", "fr", 0);
                expect(seqSubSegments[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                let allHLSVodSegments = mockVod2.getMediaSegments();
                expect(Object.keys(allHLSVodSegments)).toEqual(mockVod2.getBandwidths());
                expect(allHLSVodSegments["1497000"][9].uri).toBe(
                    "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_3_av.ts"
                );

                done();
            });
    });

    it("it can handle a vod with subs after a vod with no subs", (done) => {
        const now = Date.now();
        mockVod = new HLSVod("http://mock.com/mock.m3u8", [], now);
        mockVod2 = new HLSVod("http://mock.com/mock2.m3u8", []);
        mockVod.load(mockMasterManifest4, mockMediaManifest4)
            .then(() => {
                return mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest);
            }).then(() => {
                let allHLSVodSegments = mockVod.getMediaSegments();
                expect(Object.keys(allHLSVodSegments)).toEqual(mockVod.getBandwidths());
                expect(allHLSVodSegments["1497000"][0].uri).toBe(
                    "https://tv4play-i.akamaihd.net/i/mp4root/2018-01-26/pid200032972(3953564_,T3MP445,T3MP435,T3MP425,T3MP415,T3MP48,T3MP43,T3MP4130,).mp4.csmil/segment1_3_av.ts"
                );
                const seqSubSegments = mockVod2.getLiveMediaSequenceSubtitleSegments("subs", "fr", 0);
                expect(seqSubSegments[0].uri).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                done();
            });
    });
});