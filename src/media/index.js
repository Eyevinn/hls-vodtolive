import m3u8 from "@eyevinn/m3u8";
import {debug, info} from "@inlet-media/logger";
import url from "url";
import fetch from "node-fetch";

function getNearestBandwidth(segments, bandwidth) {
  const filteredBandwidths = Object.keys(segments).filter(bw => segments[bw].length > 0);
  const availableBandwidths = filteredBandwidths.sort((a,b) => a - b);

  debug(`Find ${bandwidth} in ${availableBandwidths}`);
  for (let i = 0; i < availableBandwidths.length; i++) {
    if (Number(bandwidth) <= Number(availableBandwidths[i])) {
      return availableBandwidths[i];
    }
  }
  return availableBandwidths[availableBandwidths.length - 1];
}

function parse(m3u, bw, mediaManifestUri) {
  const bandwidthSegments = [];
  const segmentsInitiated = {};
  //TODO Implement ad splices in the future
  const splices = [];

  const timeOffset = 0;
  let targetDuration = 0;
  let timelinePosition = 0;
  let spliceBw = bw;
  if (!segmentsInitiated[bw]) {
    let position = 0;
    let nextSplicePosition = null;
    let spliceIdx = 0;

    for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
      if (splices[spliceIdx]) {
        nextSplicePosition = splices[spliceIdx].position;
        spliceBw = getNearestBandwidth(splices[spliceIdx], bw);
      } else {
        nextSplicePosition = null;
      }

      const playlistItem = m3u.items.PlaylistItem[i];
      const m = mediaManifestUri.match('^(.*)/.*?$');
      const baseUrl = m ? m[1] + '/' : '';

      const playlistItemUri = playlistItem.properties.uri;
      const segmentUri = playlistItemUri.match('^http') ? playlistItemUri : url.resolve(baseUrl, playlistItemUri);

      if (playlistItem.properties.discontinuity) {
        bandwidthSegments.push({
          discontinuity: true
        });
      }
      let diff = 0;
      if (nextSplicePosition && position + playlistItem.properties.duration > nextSplicePosition) {
        debug(`Inserting splice at ${bw}:${position} (${i})`);
        diff = position - nextSplicePosition;
        if (bandwidthSegments.length > 0 && !bandwidthSegments[bandwidthSegments.length - 1].discontinuity) {
          // Only insert discontinuity if this is not the first segment
          debug(`Inserting discontinuity at ${bw}:${position} (${i}/${m3u.items.PlaylistItem.length})`);
          bandwidthSegments.push({
            discontinuity: true
          });
        }
        if (splices[spliceIdx].segments[spliceBw]) {
          debug(`Inserting ${splices[spliceIdx].segments[spliceBw].length} ad segments`);
          splices[spliceIdx].segments[spliceBw].forEach(v => {
            let q = {
              duration: v[0],
              uri: v[1],
              timelinePosition: timeOffset != null ? timeOffset + timelinePosition : null,
              discontinuity: false
            }

            bandwidthSegments.push(q);
            position += q.duration;
            timelinePosition += (q.duration * 1000);
          });
          if (i !== m3u.items.PlaylistItem.length - 1) {
            // Only insert discontinuity after ad segments if this break is not at the end
            // of the segment list
            debug(`Inserting discontinuity after ad segments`);
            bandwidthSegments.push({
              discontinuity: true
            });
          }
        }
        spliceIdx++;
      }
      // Next splice is back-to-back?
      if (splices[spliceIdx]) {
        debug(`Next splice ${splices[spliceIdx].position} <= ${position}`);
      }
      if (splices[spliceIdx] && (splices[spliceIdx].position + diff) <= position) {
        debug(`Next splice is back-to-back, not inserting new segment`);
        splices[spliceIdx].position += diff;
        bandwidthSegments.pop(); // Remove extra disc
        i--;
      } else {
        let cueOut = playlistItem.get('cueout');
        let cueIn = playlistItem.get('cuein');
        let cueOutCont = playlistItem.get('cont-offset');
        let duration = 0;
        if (typeof cueOut !== 'undefined') {
          duration = cueOut;
        } else if (typeof cueOutCont !== 'undefined') {
          duration = playlistItem.get('cont-dur');
        }
        const cue = (cueOut || cueIn || cueOutCont) ? {
          out: (typeof cueOut !== 'undefined'),
          cont: (typeof cueOutCont !== 'undefined') ? cueOutCont : null,
          in: !!cueIn,
          duration: duration
        } : null;
        const q = {
          duration: playlistItem.properties.duration,
          uri: segmentUri,
          timelinePosition: timeOffset != null ? timeOffset + timelinePosition : null,
          cue: cue
        }
        bandwidthSegments.push(q);
        position += q.duration;
        timelinePosition += q.duration * 1000;
      }
    }

    targetDuration= Math.ceil(bandwidthSegments.map(el => el && el.duration ? el.duration : 0).reduce((max, cur) => Math.max(max, cur), -Infinity));
  } else {
    debug(`Segments for ${bw} already initiated, skipping`);
  }
  return {
    bandwidthSegments,
    targetDuration,
  }
}

/**
 *
 * @param mediaManifestUri
 * @param bw
 * @returns {Promise<unknown>}
 */
export function loadMediaManifest(mediaManifestUri, bw) {
  return new Promise(async (resolve, reject) => {
    const parser = m3u8.createStream();

    parser.on('m3u', m3u => {
      const { bandwidthSegments, targetDuration } = parse(m3u, bw, mediaManifestUri);
      resolve({
        bandwidthSegments, targetDuration,
      })
    });

    parser.on('error', err => {
      reject(err);
    });

    const response = await fetch(mediaManifestUri)
    response.body.pipe(parser);
  });
}
