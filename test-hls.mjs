import HLSVod from './src';

const hlsVod = new HLSVod('https://inlet-streams.s3.amazonaws.com/beacon/Bring_You_Back/playlist.m3u8');
hlsVod.load();
