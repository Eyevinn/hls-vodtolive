const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;

xdescribe("HLSVod with subtitles", () => {
    describe("HLSVod with subtitles", () => {
        let mockMasterManifest;
        let mockMediaManifest;
        let mockAudioManifest;
        let mockSubtitleManifest;
        let mockMasterManifest2;
        let mockMediaManifest2;
        let mockSubtitleManifest2;

        beforeEach(() => {
            mockMasterManifest = function () {
                return fs.createReadStream("testvectors/hls_subs/master.m3u8");
            };

            mockMasterManifest2 = function () {
                return fs.createReadStream("testvectors/hls_subs2/master.m3u8");
            };


            mockMediaManifest = function () {
                return fs.createReadStream("testvectors/hls_subs/b2962000-video.m3u8");
            };

            mockMediaManifest2 = function () {
                return fs.createReadStream("testvectors/hls_subs2/video.m3u8");
            };

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
                expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                done();
            });
        });
        it("no subs after vod with subs", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2, mockSubtitleManifest2).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                const subStrings = m3u8.split("\n")
                expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_75.webvtt");
                const m3u82 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                const subStrings2 = m3u8.split("\n")
                expect(subStrings2[8]).toEqual("##EXTINF:3");
                expect(subStrings2[9]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
                done();
                });
            });
        });
    });

    describe("mixing vod with subtitles and without", () => {
        let mockMasterManifest;
        let mockMediaManifest;
        let mockAudioManifest;
        let mockSubtitleManifest;
        let mockMasterManifest2;
        let mockMediaManifest2;
        let mockAudioManifest2;
        beforeEach(() => {
            mockMasterManifest = function () {
                return fs.createReadStream("testvectors/hls_subs/master.m3u8");
            };

            mockMasterManifest2 = function () {
                return fs.createReadStream("testvectors/hls_subs2/master.m3u8");
            };


            mockMediaManifest = function () {
                return fs.createReadStream("testvectors/hls_subs/b2962000-video.m3u8");
            };

            mockMediaManifest2 = function () {
                return fs.createReadStream("testvectors/hls_subs2/video.m3u8");
            };

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

            mockAudioManifest = function () {
                return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
            }
            mockAudioManifest2 = function () {
                return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
            }
        });
        it("no subs after vod with subs", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                mockVod2.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                const subStrings = m3u8.split("\n")
                expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_75.webvtt");
                const m3u82 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                const subStrings2 = m3u8.split("\n")
                expect(subStrings2[8]).toEqual("##EXTINF:77");
                done();
                });
            });
        });
        it("subs after vod with no subs", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest2, mockMediaManifest2, mockAudioManifest2).then(() => {
                mockVod2.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                const subStrings = m3u8.split("\n")
                expect(subStrings[5]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_75.webvtt");
                const m3u82 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                const subStrings2 = m3u8.split("\n")
                expect(subStrings2[8]).toEqual("##EXTINF:77");
                done();
                });
            });
        });
    });
});