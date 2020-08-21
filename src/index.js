import { loadMasterManifest } from "./master";
import { loadMediaManifest } from "./media";

export default class HLSVod {
  /**
   * Create an HLS VOD instance
   * @param {string} vodManifestUri - the uri to the master manifest of the VOD
   * @param {Object} splices - an array of ad splice objects
   */
  constructor(vodManifestUri, splices)  {
    this.masterManifestUri = vodManifestUri;
    this.segments = {};
    this.audioSegments = {};
    this.targetDurations = {};
    this.targetAudioDuration = {};
    this.usageProfile = [];
    this.splices = splices || [];
    this.discontinuities = {};
    this.seekSegmentPosition = 0;
  }

  serialize() {
    return JSON.stringify(this);
  }

  parse(json) {
    const {
      masterManifestUri,
      segments,
      audioSegments,
      targetDurations,
      targetAudioDuration,
      usageProfile,
      splices,
      discontinuities,
      seekSegmentPosition,
    } = JSON.parse(json);
    this.masterManifestUri = masterManifestUri;
    this.segments = segments;
    this.audioSegments = audioSegments;
    this.targetDurations = targetDurations;
    this.targetAudioDuration = targetAudioDuration;
    this.usageProfile = usageProfile;
    this.splices = splices || [];
    this.discontinuities = discontinuities;
    this.seekSegmentPosition = seekSegmentPosition;
  }

  checkCompatibility(vod) {
    return vod && vod.getBandwidths().length === m3u.items.StreamItem.length
  }

  determineTargetDuration(segments) {
    let targetDuration = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.duration > targetDuration) {
        targetDuration = seg.duration;
      }
    }
    return Math.round(targetDuration);
  }

  seekTo(timeMs) {
    const firstBandwidth = this.getBandwidths()[0];
    const bandwidthSegments = this.segments[firstBandwidth];
    let remain = timeMs;
    while (remain > 0) {
      if (this.seekSegmentPosition >= bandwidthSegments.length) {
        this.seekSegmentPosition = bandwidthSegments.length;
        remain = 0;
      } else {
        const segment = bandwidthSegments[this.seekSegmentPosition];
        const duration = segment.duration * 1000;
        if (remain > duration) {
          remain -= duration;
          this.seekSegmentPosition++;
        } else {
          remain = 0;
        }
        if (this.seekSegmentPosition > bandwidthSegments.length) {
          this.seekSegmentPosition = bandwidthSegments.length;
        }
      }
    }
  }

  /**
   * Load and parse the HLS VOD
   */
  async load() {
    const { usageProfiles, bandwidthMediaManifests, audioGroupManifests } = await loadMasterManifest(this.masterManifestUri);

    this.usageProfile = usageProfiles;

    const mediaManifestPromises = bandwidthMediaManifests.map(async ({ mediaManifestUrl, bandwidth }) => {
      const { bandwidthSegments, targetDuration } = await loadMediaManifest(mediaManifestUrl, bandwidth);
      this.segments[bandwidth] = bandwidthSegments;
      this.targetDurations[bandwidth] = targetDuration;
    });
    const audioManifestPromises = audioGroupManifests.map(async ({ audioManifestUrl, audioGroupId }) => {
      //TODO
      //await loadAudioManifest(mediaManifestUrl, bandwidth)
    });

    await Promise.all(mediaManifestPromises);
    //TODO - Enabled when ready
    // await Promise.all(audioManifestPromises);
  }

  /**
   * Retrieve master manifest Uri for this VOD
   */
  getVodUri() {
    return this.masterManifestUri;
  }

  /**
   * Get all segments (duration, uri) for a specific media sequence
   *
   * @param {string} bandwidth - bandwidth
   */
  getLiveBandwidthSegments(bandwidth) {
    return this.segments[bandwidth].slice(this.seekSegmentPosition);
  }

  getLiveSegmentsCount() {
    const firstBandwidth = this.getBandwidths()[0];
    const bandwidthSegments = this.segments[firstBandwidth]
    return bandwidthSegments.length;
  }

  /**
   * Get all audio segments (duration, uri) for a specific media sequence
   *
   * @param {string} audioGroupId - audio group Id
   */
  getLiveMediaSequenceAudioSegments(audioGroupId) {
    return this.audioSegments[audioGroupId].slice(this.seekSegmentPosition);
  }

  getTotalDuration() {
    const firstBandwidth = this.getBandwidths()[0];
    const bandwidthSegments = this.segments[firstBandwidth]
    return Math.round(bandwidthSegments.reduce((acc, segment) => {
      return acc + (segment.duration * 1000);
    }, 0));
  }

  /**
   * Get the available bandwidths for this VOD
   */
  getBandwidths() {
    return Object.keys(this.segments);
  }

  getAudioGroups() {
    return Object.keys(this.audioSegments);
  }

  /**
   * Get the usage profile for this VOD
   */
  getUsageProfiles() {
    return this.usageProfile;
  }

  /**
   * Get the last discontinuity sequence number
   */
  getLastDiscontinuity() {
    return this.discontinuities[this.segments.length - 1];
  }

}
