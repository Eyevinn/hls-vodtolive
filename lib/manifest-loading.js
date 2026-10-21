const m3u8 = require("@eyevinn/m3u8");
const debug = require("debug")("hls-vodtolive");
const verbose = require("debug")("hls-vodtolive-verbose");
const {
  fetchWithRetry,
  urlResolve,
  playlistItemWithInterstitialsMetadata,
} = require("../utils.js");

module.exports = {
  _loadMediaManifest(mediaManifestUri, bandwidth, _injectMediaManifest) {
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();
      let bw = bandwidth;
      let spliceBw = bandwidth;
      debug(`Loading media manifest for bandwidth=${bw}`);

      if (this.previousVod) {
        debug(`We have a previous VOD and need to match ${bandwidth} with ${Object.keys(this.segments)}`);
        bw = this._getTrueNearestBandwidth(bandwidth);
        if (bw === null) {
          if (this.matchedBandwidths[bandwidth]) {
            debug(`Already initiated due to previous match with ${bandwidth}, reset`);
            this.segments[bandwidth] = [];
          }
          const bandwidthsWithSequences = Object.keys(this.segments).filter((a) => this._hasMediaSequences(a));
          debug(`Bandwidths with sequences: ${bandwidthsWithSequences}`);
          const sourceBw = Number(bandwidthsWithSequences.sort((a, b) => b - a)[0]);
          debug(`Was not able to match ${bandwidth}, will create and copy from previous ${sourceBw}`);
          this._copyFromPrevious(bandwidth, sourceBw);
          bw = bandwidth;
        }
        debug(`Selected ${bw} to use`);
      } else {
        if (!this.segments[bw]) {
          this.segments[bw] = [];
        }
      }
      let timelinePosition = 0;

      parser.on("m3u", (m3u) => {
        try {
          if (!this.segmentsInitiated[bw]) {
            let position = 0;
            let nextSplicePosition = null;
            let spliceIdx = 0;
            let initSegment = undefined;
            let initSegmentByteRange = undefined;
            let keys = undefined;

            // Remove segments in the beginning if we have a start time offset
            if (this.startTimeOffset != null) {
              let remain = this.startTimeOffset;
              this._removedVideoDuration = remain;
              while (remain > 0) {
                const removed = m3u.items.PlaylistItem.shift();
                if (!removed) {
                  this._removedVideoDuration -= remain;
                  remain = 0;
                } else {
                  if (removed.get("map-uri")) {
                    initSegment = removed.get("map-uri");
                    if (!initSegment.match("^http")) {
                      const n = mediaManifestUri.match("^(.*)/.*?$");
                      if (n) {
                        initSegment = urlResolve(n[1] + "/", initSegment);
                      }
                    }
                  }
                  remain -= removed.get("duration") * 1000;
                }
              }
              this._removedVideoDuration - remain;
              this.mediaStartExcessTime = Math.abs(remain);
            }

            let byteRangeOffset = 0;
            for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
              if (this.splices[spliceIdx]) {
                nextSplicePosition = this.splices[spliceIdx].position;
                spliceBw = this._getNearestBandwidthForSplice(this.splices[spliceIdx], bw);
              } else {
                nextSplicePosition = null;
              }

              const playlistItem = m3u.items.PlaylistItem[i];

              if (!this.cuedHlsInterstitialTag && playlistItem.get("daterange")) {
                let daterange = playlistItem.get("daterange");
                if (daterange["CUE"]) {
                  this.cuedHlsInterstitialTag = daterange;
                }
              }

              let segmentUri;
              let baseUrl;
              let byteRange = undefined;
              // Capture hook for the pass-through model (#146). These stay empty here; #147
              // will populate them from the raw @eyevinn/m3u8 PlaylistItem (collecting tag
              // lines the library does not natively interpret, and attributes it does not
              // read off tags it otherwise recognizes) before the segment object is built.
              let unknownSegmentTags = [];
              let unknownSegmentAttributes = {};

              const m = mediaManifestUri.match("^(.*)/.*?$");
              if (m) {
                baseUrl = m[1] + "/";
              }

              if (playlistItem.get("map-uri")) {
                initSegment = playlistItem.get("map-uri");
                initSegmentByteRange = playlistItem.get("map-byterange");
                if (!initSegment.match("^http")) {
                  const n = mediaManifestUri.match("^(.*)/.*?$");
                  if (n) {
                    initSegment = urlResolve(n[1] + "/", initSegment);
                  }
                }
              }

              // some items such as CUE-IN parse as a PlaylistItem
              // but have no URI
              if (playlistItem.get("uri")) {
                if (playlistItem.get("uri").match("^http")) {
                  segmentUri = playlistItem.get("uri");
                } else {
                  segmentUri = urlResolve(baseUrl, playlistItem.get("uri"));
                }
              }
              if (playlistItem.get("discontinuity")) {
                this.segments[bw].push({
                  discontinuity: true,
                });
              }
              if (playlistItem.get("byteRange")) {
                let [_, r, o] = playlistItem.get("byteRange").match(/^(\d+)@*(\d*)$/);
                if (!o) {
                  o = byteRangeOffset;
                }
                byteRangeOffset = parseInt(r) + parseInt(o);
                byteRange = `${r}@${o}`;
              }
              if (playlistItem.get("keys")) {
                keys = playlistItem.get("keys");
              }

              let diff = 0;
              if (nextSplicePosition != null && position + playlistItem.get("duration") > nextSplicePosition) {
                debug(`Inserting splice at ${bw}:${position} (${i})`);
                diff = position - nextSplicePosition;
                if (this.segments[bw].length > 0 && !this.segments[bw][this.segments[bw].length - 1].discontinuity) {
                  // Only insert discontinuity if this is not the first segment
                  debug(`Inserting discontinuity at ${bw}:${position} (${i}/${m3u.items.PlaylistItem.length})`);
                  this.segments[bw].push({
                    discontinuity: true,
                  });
                }
                if (this.splices[spliceIdx].segments[spliceBw]) {
                  debug(`Inserting ${this.splices[spliceIdx].segments[spliceBw].length} ad segments`);
                  this.splices[spliceIdx].segments[spliceBw].forEach((v) => {
                    let q = {
                      duration: v[0],
                      uri: v[1],
                      timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                      discontinuity: false,
                      byteRange: byteRange,
                      keys: keys,
                    };

                    this.segments[bw].push(q);
                    position += q.duration;
                    timelinePosition += q.duration * 1000;
                  });
                  if (i != m3u.items.PlaylistItem.length - 1) {
                    // Only insert discontinuity after ad segments if this break is not at the end
                    // of the segment list
                    debug(`Inserting discontinuity after ad segments`);
                    this.segments[bw].push({
                      discontinuity: true,
                    });
                  }
                }
                spliceIdx++;
              }
              // Next splice is back-to-back?
              if (this.splices[spliceIdx]) {
                verbose(`Next splice ${this.splices[spliceIdx].position} <= ${position}`);
              }
              if (this.splices[spliceIdx] && this.splices[spliceIdx].position + diff <= position) {
                debug(`Next splice is back-to-back, not inserting new segment`);
                this.splices[spliceIdx].position += diff;
                this.segments[bw].pop(); // Remove extra disc
                i--;
              } else {
                let assetData = playlistItem.get("assetdata");
                let cueOut = playlistItem.get("cueout");
                let cueIn = playlistItem.get("cuein");
                let cueOutCont = playlistItem.get("cont-offset");
                let duration = 0;
                let scteData = playlistItem.get("sctedata");
                if (typeof cueOut !== "undefined") {
                  duration = cueOut;
                } else if (typeof cueOutCont !== "undefined") {
                  duration = playlistItem.get("cont-dur");
                }
                let cue =
                  cueOut || cueIn || cueOutCont || assetData
                    ? {
                      out: typeof cueOut !== "undefined",
                      cont: typeof cueOutCont !== "undefined" ? cueOutCont : null,
                      scteData: typeof scteData !== "undefined" ? scteData : null,
                      in: cueIn ? true : false,
                      duration: duration,
                      assetData: typeof assetData !== "undefined" ? assetData : null,
                    }
                    : null;
                let q = {
                  duration: playlistItem.get("duration"),
                  timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                  cue: cue,
                  byteRange: byteRange,
                };
                // Pass-through bags (#146) for HLS data the library does not natively
                // interpret. These are OPTIONAL on a segment and, mirroring the existing
                // optional fields (initSegment, uri, keys), are attached only when non-empty
                // so the serialized payload is not inflated with empty objects for every
                // segment. Absence is equivalent to an empty bag. Parse-time capture that
                // populates them is #147; re-emission is #148. See the UnknownSegmentData
                // typedef / API.md for the contract.
                if (unknownSegmentTags && unknownSegmentTags.length > 0) {
                  q.unknownTags = unknownSegmentTags;
                }
                if (unknownSegmentAttributes && Object.keys(unknownSegmentAttributes).length > 0) {
                  q.unknownAttributes = unknownSegmentAttributes;
                }
                if (initSegment) {
                  q.initSegment = initSegment;
                }
                if (initSegmentByteRange) {
                  q.initSegmentByteRange = initSegmentByteRange;
                }
                if (segmentUri) {
                  q.uri = segmentUri;
                }
                if (keys) {
                  q.keys = keys;
                }
                if (this.segments[bw].length === 0) {
                  // Add daterange metadata if this is the first segment
                  if (this.rangeMetadata) {
                    q["daterange"] = this.rangeMetadata;
                  }
                }

                if (playlistItemWithInterstitialsMetadata(playlistItem)) {
                  const newDateRange = playlistItem.attributes.attributes["daterange"];
                  const vodsInputTimestamp = new Date(this.timeOffset);
                  const extraDurationSec = i == 0 && q.duration ? 0 : q.duration;
                  const startTimeOffsetMs = (position + extraDurationSec) * 1000;
                  const newStartDateString = new Date(vodsInputTimestamp.getTime() + startTimeOffsetMs).toISOString();
                  newDateRange["START-DATE"] = newStartDateString;
                  q["daterange"] = newDateRange;
                }

                this.segments[bw].push(q);
                position += q.duration;
                timelinePosition += q.duration * 1000;
              }
            }

            this.targetDuration[bw] = Math.ceil(
              this.segments[bw].map((el) => (el && el.duration ? el.duration : 0)).reduce((max, cur) => Math.max(max, cur), -Infinity)
            );
            this.segmentsInitiated[bw] = true;
          } else {
            debug(`Segments for ${bw} already initiated, skipping`);
          }
          resolve();
        } catch (exc) {
          reject(exc);
        }
      });

      if (!_injectMediaManifest) {
        fetchWithRetry(mediaManifestUri, null, 5, 1000, 5000, debug)
          .then((res) => {
            if (res.status === 200) {
              res.body.pipe(parser);
            } else {
              throw new Error(res.status + ":: status code error trying to retrieve media manifest " + mediaManifestUri);
            }
          })
          .catch(reject);
      } else {
        const stream = _injectMediaManifest(bandwidth);
        stream.pipe(parser);
        stream.on("error", (err) => reject(err));
      }
    });
  },

  _similarSegItemDuration(playlistItems, startOffset) {
    let totalSegmentDuration = 0;
    let segmentCount = 0;
    playlistItems.map((seg) => {
      if (seg.get("duration")) {
        segmentCount++;
        totalSegmentDuration += seg.get("duration");
      }
    });
    const avgSegmentDuration = totalSegmentDuration / segmentCount;

    const bandwidths = Object.keys(this.segments);
    if (bandwidths.length === 0) {
      return true;
    }
    const videoSegList = this.segments[bandwidths[0]];
    let totalVideoDuration = 0;
    let videoCount = 0;
    let count = 0;
    videoSegList.map((seg) => {
      if (seg.duration) {
        if (count > startOffset || !startOffset) {
          videoCount++;
          totalVideoDuration += seg.duration;
        }
      }
      count++;
    });
    const avgVideoDuration = totalVideoDuration / videoCount;
    const diff = Math.abs(avgVideoDuration - avgSegmentDuration);
    if (diff > 0.25) {
      return false;
    }
    return true;
  },

  _loadAudioManifest(audioManifestUri, groupId, language, _injectAudioManifest) {
    // # Updated so that segment objects are pushed to Language array instead.
    // # Updated input args for _injectAudioManifest().
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();
      const [audioCodecs, _] = this.getAudioCodecsAndChannelsForGroupId(groupId);
      debug(`Loading audio manifest for lang=${language} of group=${groupId} (codecs=${audioCodecs})`);
      debug(`Audio manifest URI: ${audioManifestUri}`);

      let timelinePosition = 1;

      parser.on("m3u", (m3u) => {
        try {
          let initSegment = undefined;
          let initSegmentByteRange = undefined;
          let keys = undefined;
          // Remove segments in the beginning if we have a start time offset
          if (this.startTimeOffset != null) {
            let offset = 0;
            const bw = this.getBandwidths()[0];
            for (let index = 0; index < this.segments[bw].length; index++) {
              if (this.segments[bw][index].vodTransition) {
                offset = index;
                break;
              }
            }
            const sameLength = this._similarSegItemDuration(m3u.items.PlaylistItem, offset);
            let remain = sameLength ? this.startTimeOffset : this.startTimeOffset + this.mediaStartExcessTime;

            while (remain > 0) {
              let removed;
              if (sameLength) {
                removed = m3u.items.PlaylistItem.shift();
              } else if (m3u.items.PlaylistItem[0] && m3u.items.PlaylistItem[0].get("duration") * 1000 <= remain) {
                removed = m3u.items.PlaylistItem.shift();
              }
              if (!removed) {
                remain = 0;
              } else {
                if (removed.get("map-uri")) {
                  initSegment = removed.get("map-uri");
                  if (!initSegment.match("^http")) {
                    const n = audioManifestUri.match("^(.*)/.*?$");
                    if (n) {
                      initSegment = urlResolve(n[1] + "/", initSegment);
                    }
                  }
                }
                remain -= removed.get("duration") * 1000;
              }
            }
          }

          let baseUrl;
          const m = audioManifestUri.match("^(.*)/.*?$");
          if (m) {
            baseUrl = m[1] + "/";
          }

          let byteRangeOffset = 0;

          if (this.audioSegments[groupId][language]) {
            for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
              const playlistItem = m3u.items.PlaylistItem[i];
              let segmentUri;
              let byteRange = undefined;

              if (m3u.items.PlaylistItem[i].get("map-uri")) {
                initSegment = m3u.items.PlaylistItem[i].get("map-uri");
                initSegmentByteRange = m3u.items.PlaylistItem[i].get("map-byterange");
                if (!initSegment.match("^http")) {
                  initSegment = urlResolve(baseUrl, initSegment);
                }
              }
              // some items such as CUE-IN parse as a PlaylistItem
              // but have no URI
              if (playlistItem.get("uri")) {
                if (playlistItem.get("uri").match("^http")) {
                  segmentUri = playlistItem.get("uri");
                } else {
                  segmentUri = urlResolve(baseUrl, playlistItem.get("uri"));
                }
              }
              if (playlistItem.get("discontinuity")) {
                this.audioSegments[groupId][language].push({
                  discontinuity: true,
                });
              }
              if (playlistItem.get("byteRange")) {
                let [_, r, o] = playlistItem.get("byteRange").match(/^(\d+)@*(\d*)$/);
                if (!o) {
                  o = byteRangeOffset;
                }
                byteRangeOffset = parseInt(r) + parseInt(o);
                byteRange = `${r}@${o}`;
              }
              if (playlistItem.get("keys")) {
                keys = playlistItem.get("keys");
              }

              let assetData = playlistItem.get("assetdata");
              let cueOut = playlistItem.get("cueout");
              let cueIn = playlistItem.get("cuein");
              let cueOutCont = playlistItem.get("cont-offset");
              let duration = 0;
              let scteData = playlistItem.get("sctedata");
              if (typeof cueOut !== "undefined") {
                duration = cueOut;
              } else if (typeof cueOutCont !== "undefined") {
                duration = playlistItem.get("cont-dur");
              }
              let cue =
                cueOut || cueIn || cueOutCont || assetData
                  ? {
                    out: typeof cueOut !== "undefined",
                    cont: typeof cueOutCont !== "undefined" ? cueOutCont : null,
                    scteData: typeof scteData !== "undefined" ? scteData : null,
                    in: cueIn ? true : false,
                    duration: duration,
                    assetData: typeof assetData !== "undefined" ? assetData : null,
                  }
                  : null;
              let q = {
                duration: playlistItem.get("duration"),
                timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                cue: cue,
                byteRange: byteRange,
              };
              if (segmentUri) {
                q.uri = segmentUri;
              }
              if (initSegment) {
                q.initSegment = initSegment;
              }
              if (initSegmentByteRange) {
                q.initSegmentByteRange = initSegmentByteRange;
              }
              if (keys) {
                q.keys = keys;
              }
              if (this.audioSegments[groupId][language].length === 0) {
                // Add daterange metadata if this is the first segment
                if (this.rangeMetadata) {
                  q["daterange"] = this.rangeMetadata;
                }
              }

              if (playlistItemWithInterstitialsMetadata(playlistItem)) {
                const newDateRange = playlistItem.attributes.attributes["daterange"];
                const newStartDate = new Date(newDateRange["START-DATE"]);
                const tempTimeOffset = new Date(this.timeOffset);
                const newStartDateString = new Date(newStartDate.getTime() + tempTimeOffset.getTime()).toISOString();
                newDateRange["START-DATE"] = newStartDateString;
                q["daterange"] = newDateRange;
              }

              this.audioSegments[groupId][language].push(q);
              timelinePosition += q.duration * 1000;
            }
            if (!this.targetAudioDuration[groupId]) {
              this.targetAudioDuration[groupId] = {};
            }
            this.targetAudioDuration[groupId][language] = Math.ceil(
              this.audioSegments[groupId][language].map((el) => (el ? el.duration : 0)).reduce((max, cur) => Math.max(max, cur), -Infinity)
            );
          }
          resolve();
        } catch (exc) {
          reject(exc);
        }
      });

      if (!_injectAudioManifest) {
        fetchWithRetry(audioManifestUri, null, 5, 1000, 5000, debug)
          .then((res) => {
            if (res.status === 200) {
              res.body.pipe(parser);
            } else {
              throw new Error(res.status + ":: status code error trying to retrieve audio manifest " + audioManifestUri);
            }
          })
          .catch(reject);
      } else {
        const stream = _injectAudioManifest(groupId, language);
        stream.pipe(parser);
        stream.on("error", (err) => reject(err));
      }
    });
  },

  _loadSubtitleManifest(subtitleManifestUri, groupId, language, _injectSubtitleManifest) {
    // # Updated so that segment objects are pushed to Language array instead.
    // # Updated input args for _injectSubtitleManifest().
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();
      debug(`Loading subtitle manifest for lang=${language} of group=${groupId}`);
      debug(`Subtitle manifest URI: ${subtitleManifestUri}`);

      let timelinePosition = 1;

      parser.on("m3u", (m3u) => {
        let offset = 0;
        const bw = this.getBandwidths()[0];
        for (let index = 0; index < this.segments[bw].length; index++) {
          if (this.segments[bw][index].vodTransition) {
            offset = index;
            break;
          }
        }
        let similarSegItemDuration = this._similarSegItemDuration(m3u.items.PlaylistItem, offset);
        try {
          let initSegment = undefined;
          let initSegmentByteRange = undefined;
          let removedSegmentDuration = 0;
          // Remove segments in the beginning if we have a start time offset
          if (this.startTimeOffset != null) {
            let remain = similarSegItemDuration ? this.startTimeOffset : (this.startTimeOffset + this.mediaStartExcessTime);
            while (remain > 0) {
              let removed;
              if (m3u.items.PlaylistItem[0].get("duration") * 1000 <= remain || similarSegItemDuration) {
                removed = m3u.items.PlaylistItem.shift();
                removedSegmentDuration += removed.get("duration");
              }
              if (!removed) {
                this._removedSubtitleDuration = remain;
                remain = 0;
              } else {
                if (removed.attributes.attributes["map-uri"]) {
                  initSegment = removed.attributes.attributes["map-uri"];
                  if (!initSegment.match("^http")) {
                    const n = subtitleManifestUri.match("^(.*)/.*?$");
                    if (n) {
                      initSegment = urlResolve(n[1] + "/", initSegment);
                    }
                  }
                }
                remain -= removed.get("duration") * 1000;
              }
            }
            this._removedSubtitleDuration -= remain;
          }

          let baseUrl;
          const m = subtitleManifestUri.match("^(.*)/.*?$");
          if (m) {
            baseUrl = m[1] + "/";
          }

          let byteRangeOffset = 0;
          if (this.subtitleSegments[groupId][language]) {
            let leftover = {};
            let firstSegment = true;
            let elapsedTime = removedSegmentDuration ? removedSegmentDuration : 0;
            for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
              const playlistItem = m3u.items.PlaylistItem[i];
              let segmentUri;
              let byteRange = undefined;

              if (m3u.items.PlaylistItem[i].attributes.attributes["map-uri"]) {
                initSegment = m3u.items.PlaylistItem[i].attributes.attributes["map-uri"];
                initSegmentByteRange = m3u.items.PlaylistItem[i].get("map-byterange");
                if (!initSegment.match("^http")) {
                  initSegment = urlResolve(baseUrl, initSegment);
                }
              }
              // some items such as CUE-IN parse as a PlaylistItem
              // but have no URI
              if (playlistItem.get("uri")) {
                if (playlistItem.get("uri").match("^http")) {
                  segmentUri = playlistItem.get("uri");
                } else {
                  segmentUri = urlResolve(baseUrl, playlistItem.get("uri"));
                }
              }
              if (playlistItem.get("discontinuity")) {
                this.subtitleSegments[groupId][language].push({
                  discontinuity: true,
                });
              }

              if (playlistItem.get("byteRange")) {
                let [_, r, o] = playlistItem.get("byteRange").match(/^(\d+)@*(\d*)$/);
                if (!o) {
                  o = byteRangeOffset;
                }
                byteRangeOffset = parseInt(r) + parseInt(o);
                byteRange = `${r}@${o}`;
              }

              let assetData = playlistItem.get("assetdata");
              let cueOut = playlistItem.get("cueout");
              let cueIn = playlistItem.get("cuein");
              let cueOutCont = playlistItem.get("cont-offset");
              let duration = 0;
              let scteData = playlistItem.get("sctedata");
              if (typeof cueOut !== "undefined") {
                duration = cueOut;
              } else if (typeof cueOutCont !== "undefined") {
                duration = playlistItem.get("cont-dur");
              }
              let cue =
                cueOut || cueIn || cueOutCont || assetData
                  ? {
                    out: typeof cueOut !== "undefined",
                    cont: typeof cueOutCont !== "undefined" ? cueOutCont : null,
                    scteData: typeof scteData !== "undefined" ? scteData : null,
                    in: cueIn ? true : false,
                    duration: duration,
                    assetData: typeof assetData !== "undefined" ? assetData : null,
                  }
                  : null;
              let q = {
                duration: playlistItem.get("duration"),
                timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                cue: cue,
                byteRange: byteRange,
              };
              if (segmentUri) {
                q.uri = segmentUri;
              }
              if (initSegment) {
                q.initSegment = initSegment;
              }
              if (initSegmentByteRange) {
                q.initSegmentByteRange = initSegmentByteRange;
              }
              if (this.subtitleSegments[groupId][language].length === 0) {
                // Add daterange metadata if this is the first segment
                if (this.rangeMetadata) {
                  q["daterange"] = this.rangeMetadata;
                }
              }

              if (playlistItemWithInterstitialsMetadata(playlistItem)) {
                const newDateRange = playlistItem.attributes.attributes["daterange"];
                const newStartDate = new Date(newDateRange["START-DATE"]);
                const tempTimeOffset = new Date(this.timeOffset);
                const newStartDateString = new Date(newStartDate.getTime() + tempTimeOffset.getTime()).toISOString();
                newDateRange["START-DATE"] = newStartDateString;
                q["daterange"] = newDateRange;
              }

              if (!similarSegItemDuration) {
                const result = this.generateSmallerSubtitleSegments(q, offset, leftover, false, firstSegment, elapsedTime);
                firstSegment = false;
                this.subtitleSegments[groupId][language] = this.subtitleSegments[groupId][language].concat(result.newSegments);
                offset = result.offset;
                leftover = result.leftover;
                elapsedTime = result.elapsedTime;
              } else {
                this.subtitleSegments[groupId][language].push(q);
              }
              timelinePosition += q.duration * 1000;
            }
            if (!this.targetSubtitleDuration[groupId]) {
              this.targetSubtitleDuration[groupId] = {};
            }
            this.targetSubtitleDuration[groupId][language] = Math.ceil(
              this.subtitleSegments[groupId][language].map((el) => (el ? el.duration : 0)).reduce((max, cur) => Math.max(max, cur), -Infinity)
            );
          }
          resolve();
        } catch (exc) {
          reject(exc);
        }
      });

      if (!_injectSubtitleManifest) {
        fetchWithRetry(subtitleManifestUri, null, 5, 1000, 5000, debug)
          .then((res) => {
            if (res.status === 200) {
              res.body.pipe(parser);
            } else {
              throw new Error(res.status + ":: status code error trying to retrieve subtitle manifest " + subtitleManifestUri);
            }
          })
          .catch(reject);
      } else {
        const stream = _injectSubtitleManifest(groupId, language);
        stream.pipe(parser);
        stream.on("error", (err) => reject(err));
      }
    });
  },
};
