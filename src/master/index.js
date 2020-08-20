import url from "url";
import {debug} from "@inlet-media/logger";

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

function parseMediaManifests(streamItems = [], mediaItems = []) {
  let baseUrl;
  const m = this.masterManifestUri.match('^(.*)/.*?$');
  if (m) {
    baseUrl = m[1] + '/';
  }

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

export default function parse(m3u) {
  let baseUrl;
  const m = this.masterManifestUri.match('^(.*)/.*?$');
  if (m) {
    baseUrl = m[1] + '/';
  }

  const streamItems = m3u.items.StreamItem;
  const mediaItems = m3u.items.MediaItem;
  const usageProfiles = parseUsageProfiles(streamItems);
  const bandwidthMediaManifests = parseMediaManifests(streamItems, mediaItems);



  for (let i = 0; i < m3u.items.StreamItem.length; i++) {
    const streamItem = m3u.items.StreamItem[i];
    const mediaManifestUrl = url.resolve(baseUrl, streamItem.properties.uri);

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

      // Do not add if it is a variant included in an audio group as it will be loaded and parsed seperate
      if (!m3u.items.MediaItem.find(mediaItem => mediaItem.get("type") === "AUDIO" && mediaItem.get("uri") === streamItem.get("uri"))) {
        if (codecs !== "mp4a.40.2") {
          mediaManifestPromises.push(this._loadMediaManifest(mediaManifestUrl, streamItem.get("bandwidth")));
        }
      }
    }

    const audioSegments = {};
    const audioGroupId = streamItem.attributes.attributes['audio'];
    if (audioGroupId) {
      if (!audioSegments[audioGroupId]) {
        audioSegments[audioGroupId] = [];
      }

      const audioGroupItem = m3u.items.MediaItem.find(item => {
        return (item.attributes.attributes.type === 'AUDIO' && item.attributes.attributes['group-id'] === audioGroupId);
      });
      let audioUri = audioGroupItem.attributes.attributes.uri;
      if (!audioUri) {
        let audioVariant = m3u.items.StreamItem.find(item => {
          return (!item.attributes.attributes.resolution && item.attributes.attributes['audio'] === audioGroupId);
        });
        audioUri = audioVariant.properties.uri;
      }
      let audioManifestUrl = url.resolve(baseUrl, audioUri);
      audioManifestPromises.push(this._loadAudioManifest(audioManifestUrl, audioGroupId, _injectAudioManifest));
    }
  }

}
