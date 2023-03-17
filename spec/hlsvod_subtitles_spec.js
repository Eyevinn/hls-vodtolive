const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;

describe("HLSVod with subtitles", () => {
    describe("", () => {
        let mockMasterManifest;
        let mockMediaManifest;
        let mockAudioManifest;
        let mockSubtitleManifest; // id subs  lang zh fr
        let mockMasterManifest2;
        let mockMediaManifest2;
        let mockSubtitleManifest2; // id text lang sv

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

            mockAudioManifest = function () {
                return fs.createReadStream(`testvectors/hls_subs/b160000-english.m3u8`);
            }

            mockSubtitleManifest = function (_, lang) {
                const langs = {
                    "zh": "chinese",
                    "fr": "french",
                    "sv": "french"
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
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
                const subStrings = m3u8.split("\n")
                expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                done();
            });
        });
        it("returns the correct third segment", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 2);
                const subStrings = m3u8.split("\n")
                expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_50.webvtt");
                done();
            });
        });
        it("returns the correct segment when using offset (27sec) with even segments", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 27 * 1000);
            mockVod.load(mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
                const subStrings = m3u8.split("\n")

                const m3u8_2 = mockVod.getLiveMediaSequences(0, "455000", 0);
                const subStrings2 = m3u8_2.split("\n")
                //subStrings2.map((i,o) => console.log(i,o))
                //subStrings.map((i,o) => console.log(i,o))
                expect(subStrings[7]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
                expect(subStrings2[8]).toEqual("https://vod.streaming.a2d.tv/ys/1/4/0/1/88485/u-6600-a-128-1-2.mp4");
                done();
            });
        });
        it("returns the correct segment when using offset (150sec) with uneven segments", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8", null, null, 150 * 1000);
            mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
                const subStrings = m3u8.split("\n")

                const m3u8_2 = mockVod.getLiveMediaSequences(0, "455000", 0);
                const subStrings2 = m3u8_2.split("\n")
                //subStrings2.map((i,o) => console.log(i,o))
                //subStrings.map((i,o) => console.log(i,o))
                expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_25.webvtt");
                expect(subStrings2[7]).toEqual("http://mock.com/media/media_w1204859437_b2962000_vo_slen_t64TWFpbg==_25.ts");
                done();
            });
        });
        it("returns the correct last segment type B", (done) => {
            let bool = 1;
            mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
            mockVod.load(mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 0);
                const m3u8_2 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 1);
                const subStrings = m3u8.split("\n")
                const subStrings2 = m3u8_2.split("\n")
                expect(subStrings[41]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-7.webvtt");
                expect(subStrings2[40]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-8.webvtt");
                done();
            });
        });
        it("subs after vod with subs with short segments", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                    const m3u8 = mockVod.getLiveMediaSubtitleSequences(0, "textstream", "sv", 0);
                    const subStrings = m3u8.split("\n")
                    expect(subStrings[7]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
                    const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "textstream", "sv", 2);
                    const subStrings2 = m3u8_2.split("\n")
                    expect(subStrings2[33]).toEqual("#EXTINF:3.000,");
                    expect(subStrings2[34]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
                    done();
                });
            });
        });
        it("subs with long segments after vod with subs with short segments", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                    const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 14);
                    const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 15);
                    const subStrings = m3u8.split("\n")
                    const subStrings2 = m3u8_2.split("\n")
                    expect(subStrings[6]).toEqual("#EXTINF:1.080,");
                    expect(subStrings[7]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
                    expect(subStrings2[6]).toEqual("#EXTINF:150.000,");
                    expect(subStrings2[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                    done();
                });
            });
        });
        it("subs with short segments after vod with subs with long segments", (done) => {
            mockVod = new HLSVod("http://mock.com/mock.m3u8");
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8");
            mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                    const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
                    const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                    const subStrings = m3u8.split("\n")
                    const subStrings2 = m3u8_2.split("\n")
                    subStrings2.map((i, o) => console.log(i, o))
                    expect(subStrings[6]).toEqual("#EXTINF:150.000,");
                    expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_75.webvtt");
                    expect(subStrings2[6]).toEqual("#EXTINF:3.000,");
                    expect(subStrings2[7]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
                    done();
                });
            });
        });
        fit("subs with long segments after vod with subs with short segments and alwaysNewSegments(true)", (done) => {
            let bool = 1;
            mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
            mockVod.load(mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                mockVod2.loadAfter(mockVod, mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                    const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 14);
                    const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 15);
                    const subStrings = m3u8.split("\n")
                    const subStrings2 = m3u8_2.split("\n")
                    expect(subStrings[6]).toEqual("#EXTINF:1.080,");
                    expect(subStrings[7]).toEqual("https://vod.streaming.a2d.tv/3e542405-583b-4edc-93ab-eca86427d148/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209.ism/hls/ab92a690-62de-11ed-aa51-c96fb4f9434f_20337209-textstream_swe=1000-693.webvtt");
                    expect(subStrings2[6]).toEqual("#EXTINF:150.000,");
                    expect(subStrings2[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_0.webvtt");
                    done();
                });
            });
        });
        it("subs with short segments after vod with subs with long segments and alwaysNewSegments(true)", (done) => {
            let bool = 1;
            mockVod = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
            mockVod2 = new HLSVod("http://mock.com/mock.m3u8", null, 0, 0, null, { sequenceAlwaysContainNewSegments: bool });
            mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest, mockSubtitleManifest).then(() => {
                mockVod2.loadAfter(mockVod, mockMasterManifest2, mockMediaManifest2, null, mockSubtitleManifest2).then(() => {
                    const m3u8 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 0);
                    const m3u8_2 = mockVod2.getLiveMediaSubtitleSequences(0, "subs", "fr", 1);
                    const subStrings = m3u8.split("\n")
                    const subStrings2 = m3u8_2.split("\n")
                    subStrings2.map((i, o) => console.log(i, o))
                    expect(subStrings[6]).toEqual("#EXTINF:150.000,");
                    expect(subStrings[7]).toEqual("http://mock.com/subtitlechunk_lfra_w1588523518_b160000_slen_t64RW5nbGlzaA==_75.webvtt");
                    expect(subStrings2[6]).toEqual("#EXTINF:3.000,");
                    expect(subStrings2[7]).toEqual("https://d3t8zrj2x5ol3r.cloudfront.net/u/file~text_vtt~dummy.vtt/1/s/webvtt.vtt");
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
            mockVod.load(mockMasterManifest, mockMediaManifest, null, mockSubtitleManifest).then(() => {
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
    });
});