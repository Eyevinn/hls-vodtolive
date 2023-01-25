const HLSVod = require("../index.js");
const fs = require("fs");
const m3u8 = require("@eyevinn/m3u8");
const Readable = require("stream").Readable;


describe("HLSVod CMAF standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockAudioManifest;
  beforeEach(() => {
    mockMasterManifest = function () {
      return fs.createReadStream("testvectors/hls_cmaf_1/master.m3u8");
    };

    mockMediaManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_cmaf1/test-video=" + bandwidth + ".m3u8");
    };

    mockAudioManifest = function (bandwidth) {
      return fs.createReadStream("testvectors/hls_cmaf1/test-audio=" + bandwidth + ".m3u8");
    };    
  });

  it("passes through the init segment correctly", () => {
    mockVod = new HLSVod("http://mock.com/mock.m3u8");
    mockVod.load(mockMasterManifest, mockMediaManifest, mockAudioManifest).then(() => {
      done();
    });
  });
});

describe("HLSVod CMAF after another CMAF VOD", () => {

});

