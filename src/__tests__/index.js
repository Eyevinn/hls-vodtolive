import HLSVod from '../index.js';
import fs from 'fs';
import m3u8 from '@eyevinn/m3u8';
import { Readable } from 'stream';

describe("HLSVod standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockMasterManifest2;
  let mockMediaManifest2;

  beforeEach(() => {
    mockMasterManifest = function() {
      return fs.createReadStream('testvectors/hls1/master.m3u8');
    };

    mockMediaManifest = function(bandwidth) {
      return fs.createReadStream('testvectors/hls1/' + bandwidth + '.m3u8');
    };

    mockMasterManifest2 = function() {
      return fs.createReadStream('testvectors/hls15/master.m3u8');
    };

    mockMediaManifest2 = function(bandwidth) {
      return fs.createReadStream('testvectors/hls15/index_' + bandwidth + '.m3u8');
    };
  });


  it("load a off-source HLS video correctly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()
    expect(mockVod.getVodUri()).toBe('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    done();
  });

  it("load a off-source HLS video correctly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    expect(mockVod.getLiveMediaSequencesCount()).toBe(51);
    done();
  });

});
