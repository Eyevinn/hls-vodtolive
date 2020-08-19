import HLSVod from '../index.js';
import fs from 'fs';
import m3u8 from '@eyevinn/m3u8';
import { Readable } from 'stream';

describe("HLSVod standalone", () => {
  let mockMasterManifest;
  let mockMediaManifest;
  let mockMasterManifest2;
  let mockMediaManifest2;


  it("return the correct vod URI", done => {
    const mockVod = new HLSVod('http://mock.com/mock.m3u8');
    mockVod.load(mockMasterManifest, mockMediaManifest)
        .then(() => {
          expect(mockVod.getVodUri()).toBe('http://mock.com/mock.m3u8');
          done();
        });
  });

  it("return the correct vod URI", done => {
    const hlsVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    hlsVod.load()
        .then(() => {
          expect(mockVod.getVodUri()).toBe('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
          done();
        });
  });

});
