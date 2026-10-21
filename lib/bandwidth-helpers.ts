const debug = require("debug")("hls-vodtolive");
const verbose = require("debug")("hls-vodtolive-verbose");

import type { HLSVodInstance } from "./types";

const methods: Record<string, (...args: any[]) => any> & ThisType<HLSVodInstance> = {
  _getNearestBandwidthInList(bandwidthToMatch, array) {
    let bandwidth = bandwidthToMatch;
    const filteredBandwidths = array;
    const availableBandwidths = filteredBandwidths.sort((a: any, b: any) => a - b);

    const exactMatch = availableBandwidths.find((a) => a == bandwidth);
    if (exactMatch) {
      return exactMatch;
    }
    for (let i = 0; i < availableBandwidths.length; i++) {
      if (Number(bandwidth) <= Number(availableBandwidths[i])) {
        return availableBandwidths[i];
      }
    }
    return availableBandwidths[availableBandwidths.length - 1];
  },

  _getTrueNearestBandwidth(bandwidth) {
    if (this.usageProfileMappingRev != null) {
      return this.usageProfileMappingRev[bandwidth];
    }

    const filteredBandwidths = Object.keys(this.segments)
      .filter((bw) => this.segments[bw].length > 0)
      .filter((a) => this._hasMediaSequences(a));
    const availableBandwidths = filteredBandwidths.sort((a: any, b: any) => b - a);
    if (bandwidth > availableBandwidths[0]) {
      // Our bandwidth (needle) is larger than the highest available.
      // Will add this instead of matching
      debug(`Needle ${bandwidth} is higher than any of the available ones, will not try to match`);
      return null;
    }
    const closestBandwidth = filteredBandwidths.reduce((a: any, b: any) => {
      return Math.abs(b - bandwidth) < Math.abs(a - bandwidth) ? b : a;
    });
    debug(`True nearest bandwidth ${closestBandwidth} of ${filteredBandwidths}`);
    if (this.matchedBandwidths[closestBandwidth]) {
      debug(`Chosen bandwidth ${closestBandwidth} already matched`);
      return null;
    }
    this.matchedBandwidths[closestBandwidth] = true;
    return closestBandwidth;
  },

  _getNearestBandwidthWithInitiatedSegments(bandwidthToMatch) {
    let bandwidth = bandwidthToMatch;
    const filteredBandwidths = Object.keys(this.segments).filter((bw) => this.segmentsInitiated[bw]);
    const availableBandwidths = filteredBandwidths.sort((a: any, b: any) => a - b);

    debug(`Find ${bandwidth} in ${availableBandwidths}`);
    const exactMatch = availableBandwidths.find((a) => a == bandwidth);
    if (exactMatch) {
      return exactMatch;
    }
    for (let i = 0; i < availableBandwidths.length; i++) {
      if (Number(bandwidth) <= Number(availableBandwidths[i])) {
        return availableBandwidths[i];
      }
    }
    debug("No match found - using fallback");
    return availableBandwidths[availableBandwidths.length - 1];
  },

  _getNearestBandwidthForSplice(splice, bandwidth) {
    const availableBandwidths = Object.keys(splice.segments);
    if (this.usageProfileMapping != null && availableBandwidths.length === Object.keys(this.usageProfileMapping).length) {
      let mapping = {};
      const sortedAvailable = availableBandwidths.sort((a: any, b: any) => a - b);
      const sortedUsageProfile = Object.keys(this.usageProfileMapping).sort((a: any, b: any) => a - b);
      for (let i = 0; i < sortedAvailable.length; i++) {
        mapping[sortedUsageProfile[i]] = sortedAvailable[i];
      }
      verbose(`We have a splice mapping. Trying to match ${bandwidth} with ${Object.keys(mapping)}`);
      return mapping[bandwidth];
    }

    verbose(`Find ${bandwidth} in splice ${availableBandwidths}`);
    for (let i = 0; i < availableBandwidths.length; i++) {
      if (bandwidth <= availableBandwidths[i]) {
        return availableBandwidths[i];
      }
    }
    return availableBandwidths[availableBandwidths.length - 1];
  },
};
module.exports = methods;
