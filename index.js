const m3u8 = require('@eyevinn/m3u8');
const fetch = require('node-fetch');
const url = require('url');
const { deserialize } = require('v8');
const debug = require('debug')('hls-vodtolive');
const verbose = require('debug')('hls-vodtolive-verbose');

const daterangeAttribute = (key, attr) => {
  if (key === "planned-duration" || key === "duration") {
    return key.toUpperCase() + "=" + `${attr.toFixed(3)}`;
  } else {
    return key.toUpperCase() + "=" + `"${attr}"`;
  }
};

class HLSVod {
  /**
   * Create an HLS VOD instance
   * @param {string} vodManifestUri - the uri to the master manifest of the VOD
   * @param {Object} splices - an array of ad splice objects
   * @param {number} timeOffset - time offset as unix timestamp ms
   * @param {number} startTimeOffset - start time offset in N ms from start
   * @param {string} header - prepend the m3u8 playlist with this text
   */
  constructor(vodManifestUri, splices, timeOffset, startTimeOffset, header) {
    this.masterManifestUri = vodManifestUri;
    this.segments = {};
    this.audioSegments = {};
    this.mediaSequences = [];
    this.SEQUENCE_DURATION = process.env.SEQUENCE_DURATION ? process.env.SEQUENCE_DURATION : 60;
    this.targetDuration = {};
    this.targetAudioDuration = {};
    this.previousVod = null;
    this.usageProfile = [];
    this.segmentsInitiated = {};
    this.splices = splices || [];
    this.timeOffset = timeOffset || null;
    this.startTimeOffset = startTimeOffset || null;
    this.usageProfileMapping = null;
    this.usageProfileMappingRev = null;
    this.discontinuities = {};
    this.rangeMetadata = null;
    this.matchedBandwidths = {};
    this.deltaTimes = [];
    this.header = header;
    this.lastUsedDiscSeq = null;
  }

  toJSON() {
    const serialized = {
      masterManifestUri: this.masterManifestUri,
      segments: this.segments,
      audioSegments: this.audioSegments,
      mediaSequences: this.mediaSequences,
      SEQUENCE_DURATION: this.SEQUENCE_DURATION,
      targetDuration: this.targetDuration,
      targetAudioDuration: this.targetAudioDuration,
      previousVod: this.previousVod ? this.previousVod.toJSON() : null,
      usageProfile: this.usageProfile,
      segmentsInitiated: this.segmentsInitiated,
      splices: this.splices,
      timeOffset: this.timeOffset,
      startTimeOffset: this.startTimeOffset,
      usageProfileMapping: this.usageProfileMapping,
      usageProfileMappingRev: this.usageProfileMappingRev,
      discontinuities: this.discontinuities,
      deltaTimes: this.deltaTimes,
      header: this.header,
      lastUsedDiscSeq: this.lastUsedDiscSeq,
    };
    return JSON.stringify(serialized);
  }

  fromJSON(serialized) {
    const de = JSON.parse(serialized);
    this.masterManifestUri = de.masterManifestUri;
    this.segments = de.segments;
    this.audioSegments = de.audioSegments;
    this.mediaSequences = de.mediaSequences;
    this.SEQUENCE_DURATION = de.SEQUENCE_DURATION;
    this.targetDuration = de.targetDuration;
    this.targetAudioDuration = de.targetAudioDuration;
    const prevVod = new HLSVod();
    this.previousVod = null;
    if (de.previousVod) {
      this.previousVod = prevVod.fromJSON(de.previousVod);
    }
    this.usageProfile = de.usageProfile;
    this.segmentsInitiated = de.segmentsInitiated;
    this.splices = de.splices;
    this.timeOffset = de.timeOffset;
    this.startTimeOffset = de.startTimeOffset;
    this.usageProfileMapping = de.usageProfileMapping;
    this.usageProfileMappingRev = de.usageProfileMappingRev;
    this.discontinuities = de.discontinuities;
    this.deltaTimes = de.deltaTimes;
    this.header = de.header;
    if (de.lastUsedDiscSeq) {
      this.lastUsedDiscSeq = de.lastUsedDiscSeq;
    }
  }

  /**
   * Load and parse the HLS VOD
   */
  load(_injectMasterManifest, _injectMediaManifest, _injectAudioManifest) {
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();

      parser.on('m3u', m3u => {
        let mediaManifestPromises = [];
        let audioManifestPromises = [];
        let baseUrl;
        const m = this.masterManifestUri.match('^(.*)/.*?$');
        if (m) {
          baseUrl = m[1] + '/';
        }

        if (this.previousVod && this.previousVod.getBandwidths().length === m3u.items.StreamItem.length) {
          debug(`Previous VOD bandwidths matches amount of current. A mapping is possible`);
          const previousBandwidths = this.previousVod.getBandwidths().sort((a, b) => a - b);
          this.usageProfileMapping = {};
          this.usageProfileMappingRev = {};
          const bandwidths = m3u.items.StreamItem.sort((a, b) => {
            return a.attributes.attributes['bandwidth'] - b.attributes.attributes['bandwidth'];
          }).map(v => v.attributes.attributes['bandwidth']);
          debug(`${previousBandwidths} : ${bandwidths}`)
          for (let i = 0; i < previousBandwidths.length; i++) {
            this.usageProfileMapping[previousBandwidths[i]] = bandwidths[i] + '';
            this.usageProfileMappingRev[bandwidths[i]] = previousBandwidths[i];
          }
        }

        let audioGroups = {};

        for (let i = 0; i < m3u.items.StreamItem.length; i++) {
          const streamItem = m3u.items.StreamItem[i];
          let mediaManifestUrl = url.resolve(baseUrl, streamItem.properties.uri);

          if (streamItem.get("bandwidth")) {
            let usageProfile = {
              bw: streamItem.get("bandwidth")
            };
            if (streamItem.get("resolution")) {
              usageProfile.resolution = streamItem.get("resolution")[0] + "x" + streamItem.get("resolution")[1];
            }
            if (streamItem.get("codecs")) {
              usageProfile.codecs = streamItem.get("codecs");
            }
            this.usageProfile.push(usageProfile);

            // Do not add if it is a variant included in an audio group as it will be loaded and parsed seperate
            if (!m3u.items.MediaItem.find(mediaItem => mediaItem.get("type") === "AUDIO" && mediaItem.get("uri") == streamItem.get("uri"))) {
              if (streamItem.get("codecs") !== "mp4a.40.2") {
                mediaManifestPromises.push(this._loadMediaManifest(mediaManifestUrl, streamItem.get("bandwidth"), _injectMediaManifest));
              }
            }
          }
          if (streamItem.attributes.attributes["audio"]) {
            let audioGroupId = streamItem.attributes.attributes["audio"];
            if (!this.audioSegments[audioGroupId]) {
              this.audioSegments[audioGroupId] = {};
            }
            debug(`Lookup media item for '${audioGroupId}'`);

            // # Needed for the case when loading after another VOD.
            const previousVODLanguages = Object.keys(this.audioSegments[audioGroupId]);

            let audioGroupItems = m3u.items.MediaItem.filter((item) => {
              return (
                item.attributes.attributes.type === "AUDIO" &&
                item.attributes.attributes["group-id"] === audioGroupId
              );
            });
            // # Find all langs amongst the mediaItems that have this group id.
            // # It extracts each mediaItems language attribute value.
            // # ALSO initialize in this.audioSegments a lang. property whos value is an array [{seg1}, {seg2}, ...].
            let audioLanguages = audioGroupItems.map((item) => {
              let itemLang;
              if (!item.attributes.attributes["language"]) {
                itemLang = null;
              } else {
                itemLang = item.attributes.attributes["language"];
              }
              // Initialize lang. in new group.
              if (!this.audioSegments[audioGroupId][itemLang]) {
                this.audioSegments[audioGroupId][itemLang] = [];
              }
              return (item = itemLang);
            });

            // # Inject "default" language's segments to every new language relative to previous VOD.
            // # For the case when this is a VOD following another, every language new or old should
            // # start with some segments from the previous VOD's last sequence.
            const newLanguages = audioLanguages.filter((lang)=>{ return !previousVODLanguages.includes(lang) })
            // # Only inject if there were prior tracks.
            if(previousVODLanguages.length > 0){
              for(let i=0;i<newLanguages.length; i++){
                const newLanguage = newLanguages[i];            
                const defaultLanguage = this._getFirstAudioLanguageWithSegments(audioGroupId);
                this.audioSegments[audioGroupId][newLanguage] = [...this.audioSegments[audioGroupId][defaultLanguage]];
              }
            }

            // # Need to clean up langs. loaded from prev. VOD that current VOD doesn't have.
            // # Necessary, for the case when getLiveMediaSequenceAudioSegments() tries to
            // # access an audioGroup's language that the current VOD never had. A False-Positive.
            let allLangs = Object.keys(this.audioSegments[audioGroupId]);
            let toRemove = [];
            allLangs.map((junkLang) => {
              if (!audioLanguages.includes(junkLang)) {
                toRemove.push(junkLang);
              }
            });
            toRemove.map((junkLang) => {
              delete this.audioSegments[audioGroupId][junkLang];
            });

            // # For each lang, find the lang playlist uri and do _loadAudioManifest() on it.
            for (let j = 0; j < audioLanguages.length; j++) {
              let audioLang = audioLanguages[j];
              let audioUri = audioGroupItems[j].attributes.attributes.uri;
              if (!audioUri) {
                //# if mediaItems dont have uris
                let audioVariant = m3u.items.StreamItem.find((item) => {
                  return (
                    !item.attributes.attributes.resolution &&
                    item.attributes.attributes["audio"] === audioGroupId
                  );
                });
                if (audioVariant) {
                  audioUri = audioVariant.properties.uri;
                }
              }
              if (audioUri) {
                let audioManifestUrl = url.resolve(baseUrl, audioUri);
                if (!audioGroups[audioGroupId]) {
                  audioGroups[audioGroupId] = {};
                }
                // # Prevents 'loading' an audio track with same GroupID and LANG.
                // # otherwise it just would've loaded OVER the latest occurrent of the LANG in GroupID.
                if (!audioGroups[audioGroupId][audioLang]) {
                  audioGroups[audioGroupId][audioLang] = true;
                  audioManifestPromises.push(
                    this._loadAudioManifest(
                      audioManifestUrl,
                      audioGroupId,
                      audioLang,
                      _injectAudioManifest
                    )
                  );
                } else {
                  debug(
                    `Audio manifest for language "${audioLang}" from '${audioGroupId}' in already loaded, skipping`
                  );
                }
              } else {
                debug(
                  `No media item for '${audioGroupId}' in "${audioLang}" was found, skipping`
                );
              }
            }
          }
        }
        Promise.all(mediaManifestPromises.concat(audioManifestPromises))
        .then(this._cleanupUnused.bind(this))
        .then(this._createMediaSequences.bind(this))
        .then(resolve)
        .catch(err => {
          debug("Error loading VOD: Need to cleanup");
          this._cleanupOnFailure();
          reject(err);
        });
      });

      parser.on('error', err => {
        reject(err);
      });

      if (!_injectMasterManifest) {
        fetch(this.masterManifestUri)
        .then(res => {
          if (res.status === 200) {
            res.body.pipe(parser);
          }
          else {
            throw new Error(res.status + ':: status code error trying to retrieve master manifest ' + masterManifestUri);
          }
        })
        .catch(reject);
      } else {
        const stream = _injectMasterManifest();
        stream.pipe(parser);
        stream.on('error', err => reject(err));
      }
    });
  }

  /**
   * Load and parse the HLS VOD where the first media sequences
   * contains the end sequences of the previous VOD
   *
   * @param {HLSVod} previousVod - the previous VOD to concatenate to
   */
  loadAfter(previousVod, _injectMasterManifest, _injectMediaManifest, _injectAudioManifest) {
    return new Promise((resolve, reject) => {
      this.previousVod = previousVod;
      try {
        this._loadPrevious();
        this.load(_injectMasterManifest, _injectMediaManifest, _injectAudioManifest)
        .then(() => {
          previousVod.releasePreviousVod();
          resolve();
        })
        .catch(err => {
          previousVod.releasePreviousVod();
          reject(err);
        });
      } catch (exc) {
        reject(exc);
      }
    });
  }

  /**
   * Removes all segments that come before or after a specified media sequence.
   * Then adds the new additional segments in front or behind. 
   * It finally creates new media sequences with the updated collection of segments. 
   * 
   * @param {number} mediaSeqNo The media Sequence index that is the live index.
   * @param {object} additionalSegments New group of segments to merge with a possible subset of this.segments
   * @param {object} additionalAudioSegments New group of audio segments to merge with a possible subset of this.segments
   * @param {boolean} insertAfter Whether the additional segments are to be added in front of the live index or behind
   * @returns A promise that new Media Sequences have been made
   */
  reload(mediaSeqNo, additionalSegments, additionalAudioSegments, insertAfter) {
    return new Promise((resolve, reject) => {
      const allBandwidths = this.getBandwidths();
      if (!insertAfter) {
        // If there is anything to slice
        if(mediaSeqNo > 0) {
          let targetUri =  this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]][0].uri;
          let targetPos = 0;
          for (let i = mediaSeqNo; i < this.segments[allBandwidths[0]].length; i++) {
            if (this.segments[allBandwidths[0]][i].uri === targetUri) {
              targetPos = i;
            }
          }
          allBandwidths.forEach(bw => this.segments[bw] = this.segments[bw].slice(targetPos));
        }

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: slice all audio tracks, in all audio groups
        }

        // Find nearest BW in SFL and prepend them to the corresponding segments bandwidth
        allBandwidths.forEach(bw => {
          let nearestBw = this._getNearestBandwidthInList(bw, Object.keys(additionalSegments));
          this.segments[bw] = additionalSegments[nearestBw].concat(this.segments[bw]);
        });

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: Prepend segs to all audio tracks, in all audio groups
        }

      } else {
        if(mediaSeqNo >= 0) {
          let size = this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]].length;
          let targetUri =  this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]][0].uri;
          let targetPos = 0;
          for (let i = mediaSeqNo; i < this.segments[allBandwidths[0]].length; i++) {
            if (this.segments[allBandwidths[0]][i].uri === targetUri) {
              targetPos = i;
            }
          }
          allBandwidths.forEach(bw => this.segments[bw] = this.segments[bw].slice((targetPos), (targetPos + size)));
        }

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: slice all audio tracks, in all audio groups
        }

        allBandwidths.forEach(bw => {
          let nearestBw = this._getNearestBandwidthInList(bw, Object.keys(additionalSegments));
          this.segments[bw] = this.segments[bw].concat(additionalSegments[nearestBw]);
        });

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: Prepend segs to all audio tracks, in all audio groups
        }
      }

      // Clean up/Reset HLSVod data since we are going to create new data
      this.mediaSequences = [];
      this.discontinuities = {};
      this.deltaTimes = [];

      try {
        this._createMediaSequences()
        .then(() => {
          resolve()
        })
        .catch(err => {
          reject(err);
        });
      } catch (exc) {
        reject(exc);
      }
    });
  }

  /**
   * Add metadata timed for this VOD
   * 
   * @param {key} key - EXT-X-DATERANGE attribute key
   * @param {*} value 
   */
  addMetadata(key, value) {
    if (this.rangeMetadata === null) {
      this.rangeMetadata = {};
    }
    this.rangeMetadata[key] = value;
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
   * @param {number} seqIdx - media sequence index (first is 0)
   */
  getLiveMediaSequenceSegments(seqIdx) {
    return this.mediaSequences[seqIdx].segments;
  }

  /**
   * Get all segments (duration, uri)
   *
   */
  getMediaSegments() {
    return this.segments;
  }

  /**
   * Get all audio segments (duration, uri) for a specific media sequence
   *
   * @param {string} audioGroupId - audio group Id
   * @param {string} audioLanguage - audio language
   * @param {number} seqIdx - media sequence index (first is 0)
   */
  getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx) {
    // # When language not found, return segments from first language.
    if(!this.mediaSequences[seqIdx].audioSegments[audioGroupId][audioLanguage]){
      const fallbackLang = this._getFirstAudioLanguageWithSegments(audioGroupId);
      return this.mediaSequences[seqIdx].audioSegments[audioGroupId][fallbackLang];
    }
    return this.mediaSequences[seqIdx].audioSegments[audioGroupId][audioLanguage];
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

  getAudioLangsForAudioGroup(groupId) {
    return Object.keys(this.audioSegments[groupId]);
  }

  /**
   * Get the number of media sequences for this VOD
   */
  getLiveMediaSequencesCount() {
    return this.mediaSequences.length;
  }

  /**
   * Get the HLS live media sequence for a specific media sequence and bandwidth
   *
   * @param {number} offset - add this offset to all media sequences in the EXT-X-MEDIA-SEQUENCE tag
   * @param {string} bandwidth
   * @param {number} seqIdx
   * @param {number} discOffset - add this offset to all discontinuity sequences in the EXT-X-DISCONTINUITY-SEQUENCE tag
   * @param {number} padding - add extra seconds on the EXT-X-TARGETDURATION
   * @param {number} forceTargetDuration - enforce a fixed EXT-X-TARGETDURATION
   */
  getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset, padding, forceTargetDuration) {
    const bw = this._getNearestBandwidthWithInitiatedSegments(bandwidth);
    let targetDuration = this._determineTargetDuration(this.mediaSequences[seqIdx].segments[bw]);
    if (padding) {
      targetDuration += padding;
    }
    if (forceTargetDuration) {
      if (targetDuration > forceTargetDuration) {
        debug(`WARN: enforced target duration ${forceTargetDuration}s is smaller than determined target duration ${targetDuration}s`);
      }
      targetDuration = forceTargetDuration;
    }
    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:6\n";
    if (this.header) {
      m3u8 += this.header;
    }
	  m3u8 += "#EXT-X-INDEPENDENT-SEGMENTS\n";
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqIdx) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 += "#EXT-X-DISCONTINUITY-SEQUENCE:" + (discInOffset + this.discontinuities[seqIdx]) + "\n";
    this.lastUsedDiscSeq = discInOffset + this.discontinuities[seqIdx];

    if (!this.mediaSequences[seqIdx]) {
      debug('No sequence idx: ' + seqIdx);
      return m3u8;
    }
    if (!this.mediaSequences[seqIdx].segments[bw]) {
      debug('No segments in media sequence idx: ' + seqIdx + ` bw: ` + bw);
      debug(this.mediaSequences[seqIdx]);
      return m3u8;
    }

    let previousSegment = null;
    for (let i = 0; i < this.mediaSequences[seqIdx].segments[bw].length; i++) {
      const v = this.mediaSequences[seqIdx].segments[bw][i];
      if (v) {
        if (previousSegment != null) {
          if (previousSegment.discontinuity && v.timelinePosition) {
            const d = new Date(v.timelinePosition);
            m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + d.toISOString() + "\n";
          }
        }

        if (!v.discontinuity) {
          if (v.daterange) {
            const dateRangeAttributes = Object.keys(v.daterange).map(key => daterangeAttribute(key, v.daterange[key])).join(',');
            if (v.daterange['start-date']) {
              m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + v.daterange['start-date'] + "\n";
            }
            m3u8 += "#EXT-X-DATERANGE:" + dateRangeAttributes + "\n";
          }
  
          if(v.cue && v.cue.out) {
            if (v.cue.scteData) {
              m3u8 += '#EXT-OATCLS-SCTE35:' + v.cue.scteData + "\n";
            }
            if (v.cue.assetData) {
              m3u8 += '#EXT-X-ASSET:' + v.cue.assetData + "\n";
            }
            m3u8 += "#EXT-X-CUE-OUT:DURATION=" + v.cue.duration + "\n";
          }
          if (v.cue && v.cue.cont) {
            if (v.cue.scteData) {
              m3u8 += '#EXT-X-CUE-OUT-CONT:ElapsedTime=' + v.cue.cont + ',Duration=' + v.cue.duration + ',SCTE35=' + v.cue.scteData + "\n";
            }
            else {
              m3u8 += "#EXT-X-CUE-OUT-CONT:" + v.cue.cont + "/" + v.cue.duration + "\n";
            }
          }
          m3u8 += "#EXTINF:" + v.duration.toFixed(3) + ",\n";
          m3u8 += v.uri + "\n";

          if (v.cue && v.cue.in) {
            if (this.mediaSequences[seqIdx].segments[bw][i+1] && 
              this.mediaSequences[seqIdx].segments[bw][i+1].discontinuity && 
              i+1 == this.mediaSequences[seqIdx].segments[bw].length-1)
            {
              // Do not add a closing cue-in if next is not a segment and last one in the list
            } else {
              m3u8 += "#EXT-X-CUE-IN" + "\n";
            }
          }
        } else {
          if (i != 0 && i != this.mediaSequences[seqIdx].segments[bw].length - 1){
            m3u8 += "#EXT-X-DISCONTINUITY\n";
          }
          if (v.daterange && i != this.mediaSequences[seqIdx].segments[bw].length - 1) {
            const dateRangeAttributes = Object.keys(v.daterange).map(key => daterangeAttribute(key, v.daterange[key])).join(',');
            if (v.daterange['start-date']) {
              m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + v.daterange['start-date'] + "\n";
            }
            m3u8 += "#EXT-X-DATERANGE:" + dateRangeAttributes + "\n";
          }  
        }

        previousSegment = v;
      }
    }

    return m3u8;
  }

  /**
   * Gets a hls/makes m3u8-file with all of the correct audio segments
   * belonging to a given groupID & language for a particular sequence.
   */
   getLiveMediaAudioSequences(
    offset,
    audioGroupId,
    audioLanguage,
    seqIdx,
    discOffset,
    padding,
    forceTargetDuration
  ) {
    debug(
      `Get live audio media sequence [${seqIdx}] for audioGroupId=${audioGroupId}`
    );
    const mediaSeqAudioSegments = this.getLiveMediaSequenceAudioSegments(
      audioGroupId,
      audioLanguage,
      seqIdx
    );

    // # If failed to find segments for given language,
    // # return null rather than an error.
    if (!mediaSeqAudioSegments){
      return null;
    }

    let targetDuration = this._determineTargetDuration(mediaSeqAudioSegments);
    if (padding) {
      targetDuration += padding;
    }
    if (forceTargetDuration) {
      targetDuration = forceTargetDuration;
    }

    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:3\n";
    if (this.header) {
      m3u8 += this.header;
    }
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqIdx) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 +=
      "#EXT-X-DISCONTINUITY-SEQUENCE:" +
      (discInOffset + this.discontinuities[seqIdx]) +
      "\n";

    let previousSegment = null;
    for (let i = 0; i < mediaSeqAudioSegments.length; i++) {
      const v = mediaSeqAudioSegments[i];
      if (v) {
        if (previousSegment != null) {
          if (previousSegment.discontinuity && v.timelinePosition) {
            const d = new Date(v.timelinePosition);
            m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + d.toISOString() + "\n";
          }
        }

        if (!v.discontinuity) {
          if (v.daterange) {
            const dateRangeAttributes = Object.keys(v.daterange)
              .map((key) => daterangeAttribute(key, v.daterange[key]))
              .join(",");
            m3u8 += "#EXT-X-DATERANGE:" + dateRangeAttributes + "\n";
          }
          if (v.cue && v.cue.out) {
            m3u8 += "#EXT-X-CUE-OUT:DURATION=" + v.cue.duration + "\n";
          }
          if (v.cue && v.cue.cont) {
            m3u8 +=
              "#EXT-X-CUE-OUT-CONT:" + v.cue.cont + "/" + v.cue.duration + "\n";
          }
          m3u8 += "#EXTINF:" + v.duration.toFixed(3) + ",\n";
          m3u8 += v.uri + "\n";
          if (v.cue && v.cue.in) {
            if (
              this.mediaSequences[seqIdx].segments[bw][i + 1] &&
              this.mediaSequences[seqIdx].segments[bw][i + 1].discontinuity &&
              i + 1 == this.mediaSequences[seqIdx].segments[bw].length - 1
            ) {
              // Do not add a closing cue-in if next is not a segment and last one in the list
            } else {
              m3u8 += "#EXT-X-CUE-IN" + "\n";
            }
          }
        } else {
          if (i != 0 && i != mediaSeqAudioSegments.length - 1) {
            m3u8 += "#EXT-X-DISCONTINUITY\n";
          }
          if (v.daterange && i != mediaSeqAudioSegments.length - 1) {
            const dateRangeAttributes = Object.keys(v.daterange)
              .map((key) => daterangeAttribute(key, v.daterange[key]))
              .join(",");
            m3u8 += "#EXT-X-DATERANGE:" + dateRangeAttributes + "\n";
          }
        }
        previousSegment = v;
      }
    }

    return m3u8;
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
    return this.discontinuities[this.mediaSequences.length - 1];
  }

  /**
   * Get the delta times for each media sequence. 
   */
  getDeltaTimes() {
    return this.deltaTimes.map(o => o.interval);
  }

  /**
   * Returns the playhead position for each media sequence
   */
  getPlayheadPositions() {
    return this.deltaTimes.map(o => o.position);
  }

  /**
   * Remove pointers to previous VOD and release to garbage collector
   */
  releasePreviousVod() {
    this.previousVod = null;
  }

  /**
   * Returns the current duration calculated from the sum of the duration of all segments
   */
  getDuration() {
    if (!this.segments) {
      return null;
    }
    const bw = Object.keys(this.segments)[0];
    if (!bw) {
      return null;
    }
    const duration = this.segments[bw].reduce((acc, s) => s.duration ? acc + s.duration : acc, 0);
    return duration;
  }

  /**
   * Returns the last added Discontinuity sequence count from getLiveMediaSequences()
   */
  getLastUsedDiscSeq() {
    return this.lastUsedDiscSeq;
  }

  // ----- PRIVATE METHODS BELOW ----

  _loadPrevious() {
    const bandwidths = this.previousVod.getBandwidths();
    for (let i = 0; i < bandwidths.length; i++) {
      const bw = bandwidths[i];
      this._copyFromPrevious(bw);
    }
    this._copyAudioGroupsFromPrevious();
  }

  _hasMediaSequences(bandwidth) {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount();
    const lastMediaSequence = this.previousVod.getLiveMediaSequenceSegments(previousVodSeqCount - 1)[bandwidth];
    return (lastMediaSequence && lastMediaSequence !== undefined);
  }

  _copyFromPrevious(destBw, sourceBw) {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount();
    if (!sourceBw) {
      sourceBw = destBw;
    }
    const lastMediaSequence = this.previousVod.getLiveMediaSequenceSegments(previousVodSeqCount - 1)[sourceBw];

    if (!lastMediaSequence || lastMediaSequence === undefined) {
      // should not happen, debug
      console.error(`Failed to get lastMediaSequence: previousVodSeqCount=${previousVodSeqCount}, bw=${sourceBw}`);
      console.error(this.previousVod.getLiveMediaSequenceSegments(previousVodSeqCount - 1));
    }
    if (!this.segments[destBw]) {
      this.segments[destBw] = [];
    }
    if (lastMediaSequence) {
      let start = 1;
      if (lastMediaSequence[0].discontinuity) {
        start = 2;
      }
      for (let idx = start; idx < lastMediaSequence.length; idx++) {
        let q = lastMediaSequence[idx];
        if (!q) {
          // should not happen, debug
          console.error(`Failed to get segment from lastMediaSequence[${idx}]`);
          console.error(lastMediaSequence);
        }
        this.segments[destBw].push(q);
      }
    }
    const lastSeg = this.segments[sourceBw][this.segments[sourceBw].length - 1];
    if (lastSeg && lastSeg.timelinePosition) {
      this.timeOffset = lastSeg.timelinePosition + lastSeg.duration * 1000;
    }
    this.segments[destBw].push({
      discontinuity: true,
      daterange: this.rangeMetadata ? this.rangeMetadata : null,
    });
  }

  /**
   * Gets previous VOD's audio -groupIds, -langs, -segments from its last sequence
   * and adds them to the current VOD's this.audioSegments property.
   */
  _copyAudioGroupsFromPrevious() {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount();
    const audioGroups = this.previousVod.getAudioGroups();
    if (audioGroups.length > 0) {
      for (let i = 0; i < audioGroups.length; i++) {
        const audioGroupId = audioGroups[i];
        const audioLangs =
          this.previousVod.getAudioLangsForAudioGroup(audioGroupId);

        for (let k = 0; k < audioLangs.length; k++) {
          const audioLang = audioLangs[k];
          const lastMediaAudioSequence =
            this.previousVod.getLiveMediaSequenceAudioSegments(audioGroupId, audioLang, previousVodSeqCount - 1);
          if (!this.audioSegments[audioGroupId]) {
            this.audioSegments[audioGroupId] = {};
          }
          if (!this.audioSegments[audioGroupId][audioLang]) {
            this.audioSegments[audioGroupId][audioLang] = [];
          }
          if (lastMediaAudioSequence) {
            for (let idx = 1; idx < lastMediaAudioSequence.length; idx++) {
              let q = lastMediaAudioSequence[idx];
              this.audioSegments[audioGroupId][audioLang].push(q);
            }
          }
          this.audioSegments[audioGroupId][audioLang].push({
            discontinuity: true,
            daterange: this.rangeMetadata ? this.rangeMetadata : null,
          });
        }
      }
    }
  }

  _cleanupUnused() {
    return new Promise((resolve, reject) => {
      // Remove all bandwidths that are remaining from previous VOD and has not been initiated
      let toRemove = [];
      Object.keys(this.segments).map(bw => {
        if (!this.segmentsInitiated[bw]) {
          toRemove.push(bw);
        }
      });
      toRemove.map(bw => {
        delete this.segments[bw];
      });
      resolve();
    });
  }

  _createMediaSequences() {
    return new Promise((resolve, reject) => {
      let segOffset = 0;
      let segIdx = 0;
      let duration = 0;
      const bw = this._getFirstBwWithSegments()
      let sequence = {};

      const audioGroupId = this._getFirstAudioGroupWithSegments();
      let audioSequence = {};

      // Remove all double discontinuities
      const bandwidths = Object.keys(this.segments);
      for (let i = 0; i < bandwidths.length; i++) {
        const bwIdx = bandwidths[i];

        this.segments[bwIdx] = this.segments[bwIdx].filter((elem, idx, arr) => {
          if (idx > 0) {
            if (arr[idx - 1].discontinuity && arr[idx].discontinuity) {
              return false;
            }
          }
          return true;
        });
      }

      let length = this.segments[bw].length;
      while (this.segments[bw][segIdx] && segIdx != length) {
        if (!this.segments[bw][segIdx].discontinuity) {
          duration += this.segments[bw][segIdx].duration;
        }
        //console.log(segIdx, this.segments[bw][segIdx], duration, this.segments[bw].length);
        if (duration < this.SEQUENCE_DURATION) {
          const bandwidths = Object.keys(this.segments);
          for (let i = 0; i < bandwidths.length; i++) {
            const bwIdx = bandwidths[i];
            if (!sequence[bwIdx]) {
              sequence[bwIdx] = [];
            }

            if (!this.segments[bwIdx][segIdx]) {
              // Should not happen, debug
              console.error(`The this.segments[bwIdx=${bwIdx}][segIdx=${segIdx}] is undefined`);
              console.error("Initiated bandwidths: ", this.segmentsInitiated);
              console.error(Object.keys(this.segments).map(b => { return { bw: b, len: this.segments[b].length}; }));
              reject("Internal datastructure error");
              return;
            }
            sequence[bwIdx].push(this.segments[bwIdx][segIdx]);
          }
          if (audioGroupId) {
            const audioGroupIds = Object.keys(this.audioSegments);
            for (let i = 0; i < audioGroupIds.length; i++) {
              const audioGroupId = audioGroupIds[i];
              if (!audioSequence[audioGroupId]) {
                audioSequence[audioGroupId] = {};
              }
              const audioLangs = Object.keys(this.audioSegments[audioGroupId]);
              for (let k = 0; k < audioLangs.length; k++) {
                const audioLang = audioLangs[k];
                if (!audioSequence[audioGroupId][audioLang]) {
                  audioSequence[audioGroupId][audioLang] = [];
                }
                audioSequence[audioGroupId][audioLang].push(
                  this.audioSegments[audioGroupId][audioLang][segIdx]
                );
              }
            }
          }
          segIdx++;
        } else {
          //debug(`Pushing seq=${this.mediaSequences.length} firstSeg=${sequence[Object.keys(this.segments)[0]][0].uri}, length=${sequence[Object.keys(this.segments)[0]].length}, duration=${duration} < ${this.SEQUENCE_DURATION}`);
          if (sequence[Object.keys(this.segments)[0]][0].discontinuity) {
            // If first element in the sequence is a discontinuity we need to 'skip' the following element that
            // contains the segment uri and is the actual playlist item to roll over the top.
            segOffset++;
          }
          duration = 0;
          this.mediaSequences.push({
            segments: sequence,
            audioSegments: audioSequence
          });
          sequence = {};
          audioSequence = {};
          segOffset++;
          segIdx = segOffset;
        }
      }

      if (duration < this.SEQUENCE_DURATION) {
        // We are out of segments but have not reached the full duration of a sequence
        duration = 0;
        this.mediaSequences.push({
          segments: sequence,
          audioSegments: audioSequence
        });
        sequence = {};
        audioSequence = {};
      }

      if (!this.mediaSequences) {
        reject('Failed to init media sequences');
      } else {
        let discSeqNo = 0;
        this.deltaTimes.push({
          interval: 0,
          position: 0,
        });
        let lastPosition = 0;
        let lastPositionIncrement = 0;
        for (let seqNo = 0; seqNo < this.mediaSequences.length; seqNo++) {
          const mseq = this.mediaSequences[seqNo];
          const bwIdx = Object.keys(mseq.segments)[0];
          if (mseq.segments[bwIdx] && mseq.segments[bwIdx][0] && mseq.segments[bwIdx][0].discontinuity) {
            debug(`Discontinuity in first segment of media seq ${seqNo}`);
            discSeqNo++;
            debug(`Increasing discont sequence ${discSeqNo}`);
          }
          this.discontinuities[seqNo] = discSeqNo;
          if (seqNo > 0) {
            const positionIncrement =
              mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].discontinuity ?
              mseq.segments[bwIdx][mseq.segments[bwIdx].length - 2].duration :
              mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].duration;
            const interval = positionIncrement - lastPositionIncrement;
            this.deltaTimes.push({
              interval: interval,
              position: positionIncrement ? lastPosition + positionIncrement : lastPosition,
            });
            if (positionIncrement) {
              lastPosition += positionIncrement;
              lastPositionIncrement = positionIncrement;
            }
          } else {
            if (mseq.segments[bwIdx]) {
              lastPositionIncrement = mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].discontinuity ?
                mseq.segments[bwIdx][mseq.segments[bwIdx].length - 2].duration :
                mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].duration;
            }
          }
        }
        resolve();
      }
    });
  }

  _cleanupOnFailure() {
    if (this.previousVod) {
      this.previousVod.releasePreviousVod();
    }
    this.previousVod = null;
    this.segments = {};
    this.audioSegments = {};
    this.mediaSequences = [];
    this.mediaSequences = [];
    this.targetDuration = {};
    this.targetAudioDuration = {};
    this.usageProfile = [];
    this.segmentsInitiated = {};
    this.usageProfileMapping = null;
    this.usageProfileMappingRev = null;
    this.discontinuities = {};
    this.rangeMetadata = null;
    this.matchedBandwidths = {};
    this.deltaTimes = [];    
  }

  _getFirstBwWithSegments() {
    const bandwidths = Object.keys(this.segments).filter(bw => this.segmentsInitiated[bw]);
    if (bandwidths.length > 0) {
      return bandwidths[0];
    } else {
      console.log('ERROR: could not find any bw with segments');
      return null;
    }
  }

  _getFirstAudioGroupWithSegments() {
    // # Looks for first audio group with segments by checking if any language
    // # track belonging to the group has segments.
    const audioGroupIds = Object.keys(this.audioSegments).filter((id) => {
      let idLangs = Object.keys(this.audioSegments[id]).filter((lang) => {
        return this.audioSegments[id][lang].length > 0;
      });
      return idLangs.length > 0;
    });
    if (audioGroupIds.length > 0) {
      return audioGroupIds[0];
    } else {
      return null;
    }
  }

  _getFirstAudioLanguageWithSegments(groupId) {
    // # Looks for first audio language in group with segments by checking if any language
    // # track belonging to the group has segments.
    const LangsWithSegments = Object.keys(this.audioSegments[groupId]).filter((lang) => {
      return this.audioSegments[groupId][lang].length > 0;
    });
    if (LangsWithSegments.length > 0) {
      return LangsWithSegments[0];
    } else {
      return null;
    }
  }

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
          const bandwidthsWithSequences = Object.keys(this.segments).filter(a => this._hasMediaSequences(a));
          debug(`Bandwidths with sequences: ${bandwidthsWithSequences}`);
          const sourceBw = Number(bandwidthsWithSequences.sort((a, b) => b - a)[0]);
          debug(`Was not able to match ${bandwidth}, will create and copy from previous ${sourceBw}`);
          this._copyFromPrevious(bandwidth, sourceBw);
          this._copyAudioGroupsFromPrevious();
          bw = bandwidth;
        }
        debug(`Selected ${bw} to use`);
      } else {
        if (!this.segments[bw]) {
          this.segments[bw] = [];
        }
      }
      let timelinePosition = 0;

      parser.on('m3u', m3u => {
        try {
          if (!this.segmentsInitiated[bw]) {
            let position = 0;
            let nextSplicePosition = null;
            let spliceIdx = 0;

            // Remove segments in the beginning if we have a start time offset
            if (this.startTimeOffset != null) {
              let remain = this.startTimeOffset;
              while(remain > 0) {
                const removed = m3u.items.PlaylistItem.shift();
                if (!removed) {
                  remain = 0;
                } else {
                  remain -= removed.properties.duration * 1000;
                }
              }
            }

            for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
              if (this.splices[spliceIdx]) {
                nextSplicePosition = this.splices[spliceIdx].position;
                spliceBw = this._getNearestBandwidthForSplice(this.splices[spliceIdx], bw);
              } else {
                nextSplicePosition = null;
              }

              const playlistItem = m3u.items.PlaylistItem[i];
              let segmentUri;
              let baseUrl;

              const m = mediaManifestUri.match('^(.*)/.*?$');
              if (m) {
                baseUrl = m[1] + '/';
              }

              if (playlistItem.properties.uri.match('^http')) {
                segmentUri = playlistItem.properties.uri;
              } else {
                segmentUri = url.resolve(baseUrl, playlistItem.properties.uri);
              }
              if (playlistItem.properties.discontinuity) {
                this.segments[bw].push({
                  discontinuity: true
                });
              }
              let diff = 0;
              if (nextSplicePosition != null && position + playlistItem.properties.duration > nextSplicePosition) {
                debug(`Inserting splice at ${bw}:${position} (${i})`);
                diff = position - nextSplicePosition;
                if (this.segments[bw].length > 0 && !this.segments[bw][this.segments[bw].length - 1].discontinuity) {
                  // Only insert discontinuity if this is not the first segment
                  debug(`Inserting discontinuity at ${bw}:${position} (${i}/${m3u.items.PlaylistItem.length})`);
                  this.segments[bw].push({
                    discontinuity: true
                  });
                }
                if (this.splices[spliceIdx].segments[spliceBw]) {
                  debug(`Inserting ${this.splices[spliceIdx].segments[spliceBw].length} ad segments`);
                  this.splices[spliceIdx].segments[spliceBw].forEach(v => {
                    let q = {
                      duration: v[0],
                      uri: v[1],
                      timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                      discontinuity: false
                    }

                    this.segments[bw].push(q);
                    position += q.duration;
                    timelinePosition += (q.duration * 1000);
                  });
                  if (i != m3u.items.PlaylistItem.length - 1) {
                    // Only insert discontinuity after ad segments if this break is not at the end
                    // of the segment list
                    debug(`Inserting discontinuity after ad segments`);
                    this.segments[bw].push({
                      discontinuity: true
                    });
                  }
                }
                spliceIdx++;
              }
              // Next splice is back-to-back?
              if (this.splices[spliceIdx]) {
                verbose(`Next splice ${this.splices[spliceIdx].position} <= ${position}`);
              }
              if (this.splices[spliceIdx] && (this.splices[spliceIdx].position + diff) <= position) {
                debug(`Next splice is back-to-back, not inserting new segment`);
                this.splices[spliceIdx].position += diff;
                this.segments[bw].pop(); // Remove extra disc
                i--;
              } else {
                let assetData = playlistItem.get('assetdata');
                let cueOut = playlistItem.get('cueout');
                let cueIn = playlistItem.get('cuein');
                let cueOutCont = playlistItem.get('cont-offset');
                let duration = 0;
                let scteData = playlistItem.get('sctedata');
                if (typeof cueOut !== 'undefined') {
                  duration = cueOut;
                } else if (typeof cueOutCont !== 'undefined') {
                  duration = playlistItem.get('cont-dur');
                }
                let cue = (cueOut || cueIn || cueOutCont || assetData) ? {
                  out: (typeof cueOut !== 'undefined'),
                  cont: (typeof cueOutCont !== 'undefined') ? cueOutCont : null,
                  scteData: (typeof scteData !== 'undefined') ? scteData : null,
                  in: cueIn ? true : false,
                  duration: duration,
                  assetData: (typeof assetData !== 'undefined') ? assetData: null
                } : null;
                let q = {
                  duration: playlistItem.properties.duration,
                  uri: segmentUri,
                  timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                  cue: cue
                }
                if (this.segments[bw].length === 0) {
                  // Add daterange metadata if this is the first segment
                  if (this.rangeMetadata) {
                    q['daterange'] = this.rangeMetadata;                  
                  }
                }
                this.segments[bw].push(q);
                position += q.duration;
                timelinePosition += q.duration * 1000;
              }
            }

            this.targetDuration[bw] = Math.ceil(this.segments[bw].map(el => el && el.duration ? el.duration : 0).reduce((max, cur) => Math.max(max, cur), -Infinity));
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
        fetch(mediaManifestUri)
        .then(res => {
          if (res.status === 200) {
	          res.body.pipe(parser);
          }
          else {
          	throw new Error(res.status + ':: status code error trying to retrieve media manifest ' + mediaManifestUri);
          }          
        })
        .catch(reject);
      } else {
        const stream = _injectMediaManifest(bandwidth);
        stream.pipe(parser);
        stream.on('error', err => reject(err));
      }
    });
  }

  _loadAudioManifest(audioManifestUri, groupId, language, _injectAudioManifest) {
    // # Updated so that segment objects are pushed to Language array instead.
    // # Updated input args for _injectAudioManifest().
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();
      debug(`Loading audio manifest for lang=${language} of group=${groupId}`);
      debug(`Audio manifest URI: ${audioManifestUri}`);

      parser.on('m3u', m3u => {
        try {
          if (this.audioSegments[groupId][language]) {
            for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
              const playlistItem = m3u.items.PlaylistItem[i];
              let segmentUri;
              let baseUrl;

              const m = audioManifestUri.match("^(.*)/.*?$");
              if (m) {
                baseUrl = m[1] + "/";
              }
              if (playlistItem.properties.uri.match("^http")) {
                segmentUri = playlistItem.properties.uri;
              } else {
                segmentUri = url.resolve(baseUrl, playlistItem.properties.uri);
              }
              if (playlistItem.properties.discontinuity) {
                this.audioSegments[groupId][language].push({
                  discontinuity: true,
                });
              }
              let q = {
                duration: playlistItem.properties.duration,
                uri: segmentUri,
              };
              this.audioSegments[groupId][language].push(q);
            }
            if (!this.targetAudioDuration[groupId]) {
              this.targetAudioDuration[groupId] = {};
            }
            this.targetAudioDuration[groupId][language] = Math.ceil(
              this.audioSegments[groupId][language]
                .map((el) => (el ? el.duration : 0))
                .reduce((max, cur) => Math.max(max, cur), -Infinity)
            );
          }
          resolve();
        } catch(exc) {
          reject(exc);
        }
      });

      if (!_injectAudioManifest) {
        fetch(audioManifestUri)
        .then(res => {
          if (res.status === 200) {
	          res.body.pipe(parser);
          } else {
          	throw new Error(res.status + ':: status code error trying to retrieve audio manifest ' + audioManifestUri);
          }
        })
        .catch(reject);
      } else {
        const stream = _injectAudioManifest(groupId, language);
        stream.pipe(parser);
        stream.on('error', err => reject(err));
      }
    });
  }

  _getNearestBandwidthInList(bw, list) {
    const sorted = list.sort((a, b) => b - a);
    return sorted.reduce((a, b) => {
      return Math.abs(b - bw) < Math.abs(a - bw) ? b : a;
    });
  }

  _getNearestBandwidth(bandwidth) {
    if (this.usageProfileMappingRev != null) {
      return this.usageProfileMappingRev[bandwidth];
    }
    const filteredBandwidths = Object.keys(this.segments).filter(bw => this.segments[bw].length > 0);
    const availableBandwidths = filteredBandwidths.sort((a,b) => a - b);

    debug(`Find ${bandwidth} in ${availableBandwidths}`);
    for (let i = 0; i < availableBandwidths.length; i++) {
      if (Number(bandwidth) <= Number(availableBandwidths[i])) {
        return availableBandwidths[i];
      }
    }
    return null;
    //return availableBandwidths[availableBandwidths.length - 1];
  }

  _getTrueNearestBandwidth(bandwidth) {
    if (this.usageProfileMappingRev != null) {
      return this.usageProfileMappingRev[bandwidth];
    }

    const filteredBandwidths = Object.keys(this.segments).filter(bw => this.segments[bw].length > 0).filter(a => this._hasMediaSequences(a));
    const availableBandwidths = filteredBandwidths.sort((a,b) => b - a);
    if (bandwidth > availableBandwidths[0]) {
      // Our bandwidth (needle) is larger than the highest available.
      // Will add this instead of matching
      debug(`Needle ${bandwidth} is higher than any of the available ones, will not try to match`);
      return null;
    }
    const closestBandwidth = filteredBandwidths.reduce((a, b) => {
      return Math.abs(b - bandwidth) < Math.abs(a - bandwidth) ? b : a;
    });
    debug(`True nearest bandwidth ${closestBandwidth} of ${filteredBandwidths}`);
    if (this.matchedBandwidths[closestBandwidth]) {
      debug(`Chosen bandwidth ${closestBandwidth} already matched`);
      return null;
    }
    this.matchedBandwidths[closestBandwidth] = true;
    return closestBandwidth;
  }

  _getNearestBandwidthWithInitiatedSegments(bandwidthToMatch) {
    let bandwidth = bandwidthToMatch;
    const filteredBandwidths = Object.keys(this.segments).filter(bw => this.segmentsInitiated[bw]);
    const availableBandwidths = filteredBandwidths.sort((a,b) => a - b);

    debug(`Find ${bandwidth} in ${availableBandwidths}`);
    const exactMatch = availableBandwidths.find(a => a == bandwidth);
    if (exactMatch) {
      return exactMatch;
    }
    for (let i = 0; i < availableBandwidths.length; i++) {
      if (Number(bandwidth) <= Number(availableBandwidths[i])) {
        return availableBandwidths[i];
      }
    }
    debug('No match found - using fallback');
    return availableBandwidths[availableBandwidths.length - 1];
  }

  _getNearestBandwidthForSplice(splice, bandwidth) {
    const availableBandwidths = Object.keys(splice.segments);
    if (this.usageProfileMapping != null && availableBandwidths.length === Object.keys(this.usageProfileMapping).length) {
      let mapping = {};
      const sortedAvailable = availableBandwidths.sort((a, b) => a -b );
      const sortedUsageProfile = Object.keys(this.usageProfileMapping).sort((a, b) => a-b);
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
  }

  _determineTargetDuration(segments) {
    let targetDuration = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.duration > targetDuration) {
        targetDuration = seg.duration;
      }
    }
    return Math.round(targetDuration);
  }

  _inspect() {
    return this;
  }

  _isEmpty(obj) {
    for(var key in obj) {
      if(obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  }
}

module.exports = HLSVod;
