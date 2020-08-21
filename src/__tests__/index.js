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

  it("HLS video returns Segment Count correctly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    expect(mockVod.getLiveSegmentsCount()).toBe(65);
    done();
  });

  it("HLS video returns total duration correctly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const expectedDuration = 258667; // 258 seconds
    expect(mockVod.getTotalDuration()).toBe(expectedDuration);
    done();
  });

  it("HLS video returns total usage profiles correctly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const expectedUsageProfiles = [
      {
        resolution: '426x240',
        bw: 400000,
      },
      {
        resolution: '640x360',
        bw: 800000,
      },
      {
        resolution: '842x480',
        bw: 1400000,
      },
      {
        resolution: '1280x720',
        bw: 2800000,
      },
      {
        resolution: '1920x1080',
        bw: 5000000,
      },
    ];
    expect(mockVod.getUsageProfiles()).toStrictEqual(expectedUsageProfiles);
    done();
  });

  it("HLS video seeksTo 1 sec works properly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const bandwidth = mockVod.getBandwidths()[0];
    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);

    const seekTime = 1000; // 1 second
    mockVod.seekTo(seekTime);

    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);
    done();
  });

  it("HLS video seeksTo 5 sec works properly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const bandwidth = mockVod.getBandwidths()[0];
    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);

    const seekTime = 5 * 1000; // 5 seconds
    mockVod.seekTo(seekTime);

    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(64);
    done();
  });

  it("HLS video seeksTo 25 sec works properly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const bandwidth = mockVod.getBandwidths()[0];
    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);

    const seekTime = 25 * 1000; // 25 seconds
    mockVod.seekTo(seekTime);

    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(59);
    done();
  });

  it("HLS video seeksTo 257 sec works properly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const bandwidth = mockVod.getBandwidths()[0];
    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);

    const seekTime = 257 * 1000; // 257 seconds
    mockVod.seekTo(seekTime);

    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(1);
    done();
  });

  it("HLS video seeksTo 260 sec to reach end and not have any segments available", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const bandwidth = mockVod.getBandwidths()[0];
    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);

    const seekTime = 260 * 1000; // 257 seconds
    mockVod.seekTo(seekTime);

    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(0);
    done();
  });

  it("HLS video seeksTo 255 sec works properly", async done => {
    const mockVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
    await mockVod.load()

    const bandwidth = mockVod.getBandwidths()[0];
    expect(mockVod.getLiveBandwidthSegments(bandwidth).length).toBe(65);

    const seekTime = 257 * 1000; // 5 seconds
    mockVod.seekTo(seekTime);

    expect(mockVod.getLiveBandwidthSegments(bandwidth)[0].duration).toBe(2.666667);
    done();
  });

});
