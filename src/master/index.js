import url from "url";
import {debug} from "@inlet-media/logger";
import m3u8 from "@eyevinn/m3u8";
import fetch from "node-fetch";

function parseUsageProfiles(streamItems = []) {
  const usageProfiles = [];
  for (let i = 0; i < streamItems.length; i++) {
    const streamItem = streamItems[i];

    const bandwidth = streamItem.get("bandwidth");
    const resolution = streamItem.get("resolution");
    const codecs = streamItem.get("codecs");

    if (bandwidth) {
      const usageProfile = {
        bw: bandwidth,
      };
      if (resolution) {
        usageProfile.resolution = resolution[0] + "x" + resolution[1];
      }
      if (codecs) {
        usageProfile.codecs = codecs;
      }
      usageProfiles.push(usageProfile);
    }
  }
  return usageProfiles;
}

function parseMediaManifests(masterManifestUri, streamItems = [], mediaItems = []) {
  const m = masterManifestUri.match('^(.*)/.*?$');
  const baseUrl = m ? m[1] + '/' : null;

  const bandwidthManifests = [];
  for (let i = 0; i < streamItems.length; i++) {
    const streamItem = streamItems[i];

    const bandwidth = streamItem.get("bandwidth");
    const codecs = streamItem.get("codecs");
    const mediaManifestUrl = url.resolve(baseUrl, streamItem.properties.uri);
    // Do not add if it is a variant included in an audio group as it will be loaded and parsed seperate
    if (!mediaItems.find(mediaItem => mediaItem.get("type") === "AUDIO" && mediaItem.get("uri") === streamItem.get("uri"))) {
      if (codecs !== "mp4a.40.2") {
        bandwidthManifests.push({ bandwidth, mediaManifestUrl });
      }
    }
  }
  return bandwidthManifests;
}

function parseAudioManifests(masterManifestUri, streamItems = [], mediaItems = []) {
  const m = masterManifestUri.match('^(.*)/.*?$');
  const baseUrl = m ? m[1] + '/' : null;

  const audioGroupManifests = [];
  for (let i = 0; i < streamItems.length; i++) {
    const streamItem = streamItems[i];

    const audioSegments = {};
    const audioGroupId = streamItem.attributes.attributes['audio'];
    if (audioGroupId) {
      if (!audioSegments[audioGroupId]) {
        audioSegments[audioGroupId] = [];
      }

      const audioGroupItem = mediaItems.find(item => {
        return (item.attributes.attributes.type === 'AUDIO' && item.attributes.attributes['group-id'] === audioGroupId);
      });
      let audioUri = audioGroupItem.attributes.attributes.uri;
      if (!audioUri) {
        let audioVariant = streamItems.find(item => {
          return (!item.attributes.attributes.resolution && item.attributes.attributes['audio'] === audioGroupId);
        });
        audioUri = audioVariant.properties.uri;
      }
      const audioManifestUrl = url.resolve(baseUrl, audioUri);
      audioGroupManifests.push({ audioManifestUrl, audioGroupId });
    }
  }
  return audioGroupManifests;
}

function parse(m3u, masterManifestUri) {
  const streamItems = m3u.items.StreamItem;
  const mediaItems = m3u.items.MediaItem;
  const usageProfiles = parseUsageProfiles(streamItems);
  const bandwidthMediaManifests = parseMediaManifests(masterManifestUri, streamItems, mediaItems);
  const audioGroupManifests = parseAudioManifests(masterManifestUri, streamItems, mediaItems);

  return { usageProfiles, bandwidthMediaManifests, audioGroupManifests };
}


/**
 *
 * @param masterManifestUri - URI of master media file
 * @returns {Promise<>}
 */
export function loadMasterManifest(masterManifestUri) {
  return new Promise(async (resolve, reject) => {
    const parser = m3u8.createStream();

    parser.on('m3u', m3u => {
      const { usageProfiles, bandwidthMediaManifests, audioGroupManifests } = parse(m3u, masterManifestUri);
      resolve({
        usageProfiles, bandwidthMediaManifests, audioGroupManifests
      })
    });

    parser.on('error', err => {
      reject(err);
    });

    const response = await fetch(masterManifestUri)
    response.body.pipe(parser);
  });
}
