const m3u8 = require('@eyevinn/m3u8');
const fetch = require('node-fetch');
const url = require('url');
const debug = require('debug')('hls-vodtolive');
const verbose = require('debug')('hls-vodtolive-verbose');

class HLSVod {
  /**
   * Create an HLS VOD instance
   * @param {string} vodManifestUri - the uri to the master manifest of the VOD
   * @param {Object} splices - an array of ad splice objects
   * @param {number} timeOffset - time offset as unix timestamp ms
   * @param {number} startTimeOffset - start time offset in N ms from start
   */
  constructor(vodManifestUri, splices, timeOffset, startTimeOffset) {
    this.masterManifestUri = vodManifestUri;
    this.segments = {};
    this.audioSegments = {};
    this.mediaSequences = [];
    this.SEQUENCE_DURATION = 60;
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
          if (streamItem.attributes.attributes['audio']) {
            let audioGroupId = streamItem.attributes.attributes['audio'];
            if (!this.audioSegments[audioGroupId]) {
              this.audioSegments[audioGroupId] = [];
            }
            debug(`Lookup media item for '${audioGroupId}'`);
            let audioGroupItem = m3u.items.MediaItem.find(item => {
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
        Promise.all(mediaManifestPromises.concat(audioManifestPromises))
        .then(this._cleanupUnused.bind(this))
        .then(this._createMediaSequences.bind(this))
        .then(resolve)
        .catch(reject);
      });

      parser.on('error', err => {
        reject(err);
      });

      if (!_injectMasterManifest) {
        fetch(this.masterManifestUri)
        .then(res => {
          res.body.pipe(parser);          
        })
        .catch(reject);
      } else {
        _injectMasterManifest().pipe(parser);
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
        .then(resolve)
        .catch(reject);
      } catch (exc) {
        reject(exc);
      }  
    });
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
   * Get all audio segments (duration, uri) for a specific media sequence
   * 
   * @param {string} audioGroupId - audio group Id
   * @param {number} seqIdx - media sequence index (first is 0)
   */
  getLiveMediaSequenceAudioSegments(audioGroupId, seqIdx) {
    return this.mediaSequences[seqIdx].audioSegments[audioGroupId];
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
   */
  getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset) {
    const bw = this._getNearestBandwidthWithInitiatedSegments(bandwidth);
    debug(`Get live media sequence [${seqIdx}] for bw=${bw} (requested bw ${bandwidth})`);
    const targetDuration = this._determineTargetDuration(this.mediaSequences[seqIdx].segments[bw]);
    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:3\n";
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqIdx) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 += "#EXT-X-DISCONTINUITY-SEQUENCE:" + (discInOffset + this.discontinuities[seqIdx]) + "\n";
    
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
          if(v.cue && v.cue.out) {
            m3u8 += "#EXT-X-CUE-OUT:DURATION=" + v.cue.duration + "\n";
          }
          if (v.cue && v.cue.cont) {
            m3u8 += "#EXT-X-CUE-OUT-CONT:" + v.cue.cont + "/" + v.cue.duration + "\n";
          }
          m3u8 += "#EXTINF:" + v.duration.toFixed(3) + ",\n";
          m3u8 += v.uri + "\n";
          if(v.cue && v.cue.in) {
            m3u8 += "#EXT-X-CUE-IN" + "\n";
          }
        } else {
          if (i != 0){
            m3u8 += "#EXT-X-DISCONTINUITY\n";
          }
        }

        previousSegment = v;
      }
    }

    return m3u8;
  }

  getLiveMediaAudioSequences(offset, audioGroupId, seqIdx, discOffset) {
    debug(`Get live audio media sequence [${seqIdx}] for audioGroupId=${audioGroupId}`);
    const targetDuration = this._determineTargetDuration(this.mediaSequences[seqIdx].audioSegments[audioGroupId]);

    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:3\n";
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqIdx) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 += "#EXT-X-DISCONTINUITY-SEQUENCE:" + (discInOffset + this.discontinuities[seqIdx]) + "\n";

    let previousSegment = null;
    for (let i = 0; i < this.mediaSequences[seqIdx].audioSegments[audioGroupId].length; i++) {
      const v = this.mediaSequences[seqIdx].audioSegments[audioGroupId][i];
      if (v) {
        if (previousSegment != null) {
          if (previousSegment.discontinuity && v.timelinePosition) {
            const d = new Date(v.timelinePosition);
            m3u8 += "#EXT-X-PROGRAM-DATE-TIME:" + d.toISOString() + "\n";
          }
        }
        if (!v.discontinuity) {
          if(v.cue && v.cue.out) {
            m3u8 += "#EXT-X-CUE-OUT:DURATION=" + v.cue.duration + "\n";
          }
          if (v.cue && v.cue.cont) {
            m3u8 += "#EXT-X-CUE-OUT-CONT:" + v.cue.cont + "/" + v.cue.duration + "\n";
          }
          m3u8 += "#EXTINF:" + v.duration.toFixed(3) + ",\n";
          m3u8 += v.uri + "\n";
          if(v.cue && v.cue.in) {
            m3u8 += "#EXT-X-CUE-IN" + "\n";
          }
        } else {
          if (i != 0){
            m3u8 += "#EXT-X-DISCONTINUITY\n";
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


  // ----- PRIVATE METHODS BELOW ----

  _loadPrevious() {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount();
    const bandwidths = this.previousVod.getBandwidths();
    for (let i = 0; i < bandwidths.length; i++) {
      const bw = bandwidths[i];
      const lastMediaSequence = this.previousVod.getLiveMediaSequenceSegments(previousVodSeqCount - 1)[bw];
      if (!lastMediaSequence) {
        // should not happen, debug
        console.error(`Failed to get lastMediaSequence: previousVodSeqCount=${previousVodSeqCount}, bw=${bw}`);
        console.error(this.previousVod.getLiveMediaSequenceSegments(previousVodSeqCount - 1));
      }
      if (!this.segments[bw]) {
        this.segments[bw] = [];
      }
      for(let idx = 1; idx < lastMediaSequence.length; idx++) {
        let q = lastMediaSequence[idx];
        if (!q) {
          // should not happen, debug
          console.error(`Failed to get segment from lastMediaSequence[${idx}]`);
          console.error(lastMediaSequence);
        }
        this.segments[bw].push(q);
      }
      const lastSeg = this.segments[bw][this.segments[bw].length - 1];
      if (lastSeg && lastSeg.timelinePosition) {
        this.timeOffset = lastSeg.timelinePosition + lastSeg.duration * 1000;
      }
      this.segments[bw].push({
        discontinuity: true
      });
    }

    const audioGroups = this.previousVod.getAudioGroups();
    if (audioGroups.length > 0) {
      for (let i = 0; i < audioGroups.length; i++) {
        const audioGroupId = audioGroups[i];
        const lastMediaAudioSequence = this.previousVod.getLiveMediaSequenceAudioSegments(audioGroupId, previousVodSeqCount - 1);
        if (!this.audioSegments[audioGroupId]) {
          this.audioSegments[audioGroupId] = [];
        }
        for (let idx = 1; idx < lastMediaAudioSequence.length; idx++) {
          let q = lastMediaAudioSequence[idx];
          this.audioSegments[audioGroupId].push(q);
        }
        this.audioSegments[audioGroupId].push({
          discontinuity: true
        });
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
//        console.log(segIdx, this.segments[bw][segIdx], duration, this.segments[bw].length);
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
            }
            sequence[bwIdx].push(this.segments[bwIdx][segIdx]);
          }
          if (audioGroupId) {
            const audioGroupIds = Object.keys(this.audioSegments);
            for (let i = 0; i < audioGroupIds.length; i++) {
              const audioGroupId = audioGroupIds[i];
              if (!audioSequence[audioGroupId]) {
                audioSequence[audioGroupId] = [];
              }
              audioSequence[audioGroupId].push(this.audioSegments[audioGroupId][segIdx]);
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
        for (let seqNo = 0; seqNo < this.mediaSequences.length; seqNo++) {
          const mseq = this.mediaSequences[seqNo];
          const bwIdx = Object.keys(mseq.segments)[0];
          if (mseq.segments[bwIdx] && mseq.segments[bwIdx][0] && mseq.segments[bwIdx][0].discontinuity) {
            debug(`Discontinuity in first segment of media seq ${seqNo}`);
            discSeqNo++;
            debug(`Increasing discont sequence ${discSeqNo}`);
          }
          this.discontinuities[seqNo] = discSeqNo;
        }
        resolve();
      }
    });
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
    const audioGroupIds = Object.keys(this.audioSegments).filter(id => this.audioSegments[id].length > 0);
    if (audioGroupIds.length > 0) {
      return audioGroupIds[0];
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
        debug(`We have a previous VOD and need to match ${bw} with ${Object.keys(this.segments)}`);
        bw = this._getNearestBandwidth(bw);
        debug(`Selected ${bw} to use`);
      } else {
        if (!this.segments[bw]) {
          this.segments[bw] = [];
        } 
      }
      let timelinePosition = 0;

      parser.on('m3u', m3u => {
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
              let cueOut = playlistItem.get('cueout');
              let cueIn = playlistItem.get('cuein');
              let cueOutCont = playlistItem.get('cont-offset');
              let duration = 0;
              if (typeof cueOut !== 'undefined') {
                duration = cueOut;
              } else if (typeof cueOutCont !== 'undefined') {
                duration = playlistItem.get('cont-dur');
              }
              let cue = (cueOut || cueIn || cueOutCont) ? {
                out: (typeof cueOut !== 'undefined'),
                cont: (typeof cueOutCont !== 'undefined') ? cueOutCont : null,
                in: cueIn ? true : false,
                duration: duration
              } : null;
              let q = {
                duration: playlistItem.properties.duration,
                uri: segmentUri,
                timelinePosition: this.timeOffset != null ? this.timeOffset + timelinePosition : null,
                cue: cue
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
      });

      if (!_injectMediaManifest) {
        fetch(mediaManifestUri)
        .then(res => {
          res.body.pipe(parser);
        })
        .catch(reject);
      } else {
        _injectMediaManifest(bandwidth).pipe(parser);
      }
    });
  }

  _loadAudioManifest(audioManifestUri, groupId, _injectAudioManifest) {
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();
      debug(`Loading audio manifest for group=${groupId}`);
      debug(`Audio manifest URI: ${audioManifestUri}`);

      parser.on('m3u', m3u => {
        if (this.audioSegments[groupId]) {
          
          for (let i = 0; i < m3u.items.PlaylistItem.length; i++) {
            const playlistItem = m3u.items.PlaylistItem[i];
            let segmentUri;
            let baseUrl;

            const m = audioManifestUri.match('^(.*)/.*?$');
            if (m) {
              baseUrl = m[1] + '/';
            }
            if (playlistItem.properties.uri.match('^http')) {
              segmentUri = playlistItem.properties.uri;
            } else {
              segmentUri = url.resolve(baseUrl, playlistItem.properties.uri);
            }
            if (playlistItem.properties.discontinuity) {
              this.audioSegments[groupId].push({
                discontinuity: true
              });
            }
            let q = {
              duration: playlistItem.properties.duration,
              uri: segmentUri
            };
            this.audioSegments[groupId].push(q);
          }
          this.targetAudioDuration[groupId] = Math.ceil(this.audioSegments[groupId].map(el => el ? el.duration : 0).reduce((max, cur) => Math.max(max, cur), -Infinity));
        }
        resolve();
      });

      if (!_injectAudioManifest) {
        fetch(audioManifestUri)
        .then(res => {
          res.body.pipe(parser);
        })
        .catch(reject);
      } else {
        _injectAudioManifest(groupId).pipe(parser);
      }
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
    return availableBandwidths[availableBandwidths.length - 1];
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
}

module.exports = HLSVod;

