const m3u8 = require("@eyevinn/m3u8");
const { deserialize } = require("v8");
const debug = require("debug")("hls-vodtolive");
const verbose = require("debug")("hls-vodtolive-verbose");
import { findIndexReversed, fetchWithRetry, urlResolve, segToM3u8, findBottomSegItem } from './utils';

interface AdSplice {
  position: number;
}

interface VideoSegment {
  uri: string;
}

interface AudioSegment {
}

interface SubtitleSegment {

}

interface VideoSegments {
  [bw: string]: VideoSegment[];
}

interface AudioSegments {
  [audioGroupId: string]: AudioSegment[];
}

interface SubtitleSegments {
  [subtitleGroupId: string]: SubtitleSegment[];
}

interface MediaSequences {
  [mediaSeqNo: number]: VideoSegments;
}

const DEFAULT_SEQUENCE_DURATION = process.env.SEQUENCE_DURATION ? process.env.SEQUENCE_DURATION : 60;
const DUMMY_DEFAULT_SUBTITLE_GROUP_ID = "dummyDefaultSubtitleGroupId";
const DUMMY_DEFAULT_SUBTITLE_LANGUAGE = "dummyDefaultSubtitleLanguage";
const DEFAULT_SUBTITLE_GROUP_ID = "subtitles";


interface HLSVodOpts {

}

export default class HLSVod {

  private masterManifestUri: string;
  private segments: VideoSegments;
  private audioSegments: AudioSegments;
  private subtitleSegments: SubtitleSegments;
  private mediaSequences: MediaSequences;
  private sequenceDuration: number;

  /**
   * Create an HLS VOD instance
   * @param {string} vodManifestUri - the uri to the master manifest of the VOD
   * @param {Object} splices - an array of ad splice objects
   * @param {number} timeOffset - time offset as unix timestamp ms
   * @param {number} startTimeOffset - start time offset in N ms from start
   * @param {string} header - prepend the m3u8 playlist with this text
   * @param {string} opts - other options
   */
  constructor(
    vodManifestUri: string, 
    splices: AdSplice[], 
    timeOffset: number, 
    startTimeOffset: number, 
    header: string,
    opts: HLSVodOpts) 
  {
    this.masterManifestUri = vodManifestUri;
    this.segments = {};
    this.audioSegments = {};
    this.subtitleSegments = {};
    this.mediaSequences = [];
    this.sequenceDuration = DEFAULT_SEQUENCE_DURATION;
    this.targetDuration = {};
    this.targetAudioDuration = {};
    this.targetSubtitleDuration = {};
    this.previousVod = null;
    this.usageProfile = [];
    this.segmentsInitiated = {};
    this.splices = splices || [];
    this.timeOffset = timeOffset || null;
    this.startTimeOffset = startTimeOffset || null;
    this.usageProfileMapping = null;
    this.usageProfileMappingRev = null;
    this.discontinuities = {};
    this.discontinuitiesAudio = {};
    this.discontinuitiesSubtitle = {};
    this.mediaSequenceValues = {};
    this.mediaSequenceValuesAudio = {};
    this.mediaSequenceValuesSubtitle = {};
    this.rangeMetadata = null;
    this.matchedBandwidths = {};
    this.deltaTimes = [];
    this.deltaTimesAudio = [];
    this.deltaTimesSubtitle = [];
    this.header = header;
    this.lastUsedDiscSeq = null;
    this.sequenceAlwaysContainNewSegments = false;
    if (opts && opts.sequenceAlwaysContainNewSegments) {
      this.sequenceAlwaysContainNewSegments = opts.sequenceAlwaysContainNewSegments;
    }
    if (opts && opts.forcedDemuxMode) {
      this.forcedDemuxMode = opts.forcedDemuxMode;
    }
    if (opts && opts.dummySubtitleEndpoint) {
      this.dummySubtitleEndpoint = opts.dummySubtitleEndpoint;
    }
    if (opts && opts.subtitleSliceEndpoint) {
      this.subtitleSliceEndpoint = opts.subtitleSliceEndpoint;
    }
    if (opts && opts.shouldContainSubtitles) {
      this.shouldContainSubtitles = opts.shouldContainSubtitles;
    }
    if (opts && opts.expectedSubtitleTracks) {
      this.expectedSubtitleTracks = opts.expectedSubtitleTracks;
    }
    this.videoSequencesCount = 0;
    this.audioSequencesCount = 0;
    this.defaultAudioGroupAndLang = null;
    this.subtitleSequencesCount = 0;
    this.mediaStartExcessTime = 0;
    this.audioCodecsMap = {};
  }

  toJSON() {
    const serialized = {
      masterManifestUri: this.masterManifestUri,
      segments: this.segments,
      audioSegments: this.audioSegments,
      subtitleSegments: this.subtitleSegments,
      shouldContainSubtitles: this.shouldContainSubtitles,
      expectedSubtitleTracks: this.expectedSubtitleTracks,
      mediaSequences: this.mediaSequences,
      sequenceDuration: this.sequenceDuration,
      targetDuration: this.targetDuration,
      targetAudioDuration: this.targetAudioDuration,
      targetSubtitleDuration: this.targetSubtitleDuration,
      previousVod: this.previousVod ? this.previousVod.toJSON() : null,
      usageProfile: this.usageProfile,
      segmentsInitiated: this.segmentsInitiated,
      splices: this.splices,
      timeOffset: this.timeOffset,
      startTimeOffset: this.startTimeOffset,
      usageProfileMapping: this.usageProfileMapping,
      usageProfileMappingRev: this.usageProfileMappingRev,
      discontinuities: this.discontinuities,
      discontinuitiesAudio: this.discontinuitiesAudio,
      discontinuitiesSubtitle: this.discontinuitiesSubtitle,
      deltaTimes: this.deltaTimes,
      deltaTimesAudio: this.deltaTimesAudio,
      deltaTimesSubtitle: this.deltaTimesSubtitle,
      header: this.header,
      lastUsedDiscSeq: this.lastUsedDiscSeq,
      mediaSequenceValues: this.mediaSequenceValues,
      mediaSequenceValuesAudio: this.mediaSequenceValuesAudio,
      mediaSequenceValuesSubtitle: this.mediaSequenceValuesSubtitle,
      sequenceAlwaysContainNewSegments: this.sequenceAlwaysContainNewSegments,
      forcedDemuxMode: this.forcedDemuxMode,
      dummySubtitleEndpoint: this.dummySubtitleEndpoint,
      subtitleSliceEndpoint: this.subtitleSliceEndpoint,
      videoSequencesCount: this.videoSequencesCount,
      audioSequencesCount: this.audioSequencesCount,
      subtitleSequencesCount: this.subtitleSequencesCount,
      mediaStartExcessTime: this.mediaStartExcessTime,
      audioCodecsMap: this.audioCodecsMap,
    };
    return JSON.stringify(serialized);
  }

  fromJSON(serialized) {
    const de = JSON.parse(serialized);
    this.masterManifestUri = de.masterManifestUri;
    this.segments = de.segments;
    this.audioSegments = de.audioSegments;
    this.subtitleSegments = de.subtitleSegments;
    this.shouldContainSubtitles = de.shouldContainSubtitles;
    this.expectedSubtitleTracks = de.expectedSubtitleTracks;
    this.mediaSequences = de.mediaSequences;
    this.sequenceDuration = de.sequenceDuration;
    this.targetDuration = de.targetDuration;
    this.targetAudioDuration = de.targetAudioDuration;
    this.targetSubtitleDuration = de.targetSubtitleDuration;
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
    this.discontinuitiesAudio = de.discontinuitiesAudio;
    this.discontinuitiesSubtitle = de.discontinuitiesSubtitle;
    this.deltaTimes = de.deltaTimes;
    this.deltaTimesAudio = de.deltaTimesAudio;
    this.deltaTimesSubtitle = de.deltaTimesSubtitle;
    this.header = de.header;
    if (de.lastUsedDiscSeq) {
      this.lastUsedDiscSeq = de.lastUsedDiscSeq;
    }
    this.mediaSequenceValues = de.mediaSequenceValues;
    this.mediaSequenceValuesAudio = de.mediaSequenceValuesAudio;
    this.mediaSequenceValuesSubtitle = de.mediaSequenceValuesSubtitle;
    this.sequenceAlwaysContainNewSegments = de.sequenceAlwaysContainNewSegments;
    this.forcedDemuxMode = de.forcedDemuxMode;
    this.dummySubtitleEndpoint = de.dummySubtitleEndpoint;
    this.subtitleSliceEndpoint = de.subtitleSliceEndpoint;
    this.videoSequencesCount = de.videoSequencesCount;
    this.audioSequencesCount = de.audioSequencesCount;
    this.subtitleSequencesCount = de.subtitleSequencesCount
    this.mediaStartExcessTime = de.mediaStartExcessTime;
    this.audioCodecsMap = de.audioCodecsMap;
  }

  /**
   * Load and parse the HLS VOD
   */
  load(_injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest) {
    return new Promise((resolve, reject) => {
      const parser = m3u8.createStream();

      parser.on("m3u", (m3u) => {
        let mediaManifestPromises = [];
        let audioManifestPromises = [];
        let subtitleManifestPromises = [];
        let baseUrl;
        const m = this.masterManifestUri.match("^(.*)/.*?$");
        if (m) {
          baseUrl = m[1] + "/";
        }
        const HAS_AUDIO_DEFAULTS = this.defaultAudioGroupAndLang === null ? false : true;
        if (this.previousVod && this.previousVod.getBandwidths().length === m3u.items.StreamItem.length) {
          debug(`Previous VOD bandwidths matches amount of current. A mapping is possible`);
          const previousBandwidths = this.previousVod.getBandwidths().sort((a, b) => a - b);
          this.usageProfileMapping = {};
          this.usageProfileMappingRev = {};
          const bandwidths = m3u.items.StreamItem.sort((a, b) => {
            return a.get("bandwidth") - b.get("bandwidth");
          }).map((v) => v.get("bandwidth"));
          debug(`${previousBandwidths} : ${bandwidths}`);
          for (let i = 0; i < previousBandwidths.length; i++) {
            this.usageProfileMapping[previousBandwidths[i]] = bandwidths[i] + "";
            this.usageProfileMappingRev[bandwidths[i]] = previousBandwidths[i];
          }
        }

        for (let i = 0; i < m3u.items.StreamItem.length; i++) {
          const streamItem = m3u.items.StreamItem[i];
          let mediaManifestUrl = urlResolve(baseUrl, streamItem.get("uri"));

          if (streamItem.get("bandwidth")) {
            let usageProfile = {
              bw: streamItem.get("bandwidth"),
            };
            if (streamItem.get("resolution")) {
              usageProfile.resolution = streamItem.get("resolution")[0] + "x" + streamItem.get("resolution")[1];
            }
            if (streamItem.get("codecs")) {
              usageProfile.codecs = streamItem.get("codecs");
            }
            this.usageProfile.push(usageProfile);

            // Do not add if it is a variant included in an audio group as it will be loaded and parsed separate
            if (!m3u.items.MediaItem.find((mediaItem) => mediaItem.get("type") === "AUDIO" && mediaItem.get("uri") == streamItem.get("uri"))) {
              if (streamItem.get("codecs") !== "mp4a.40.2") {
                mediaManifestPromises.push(this._loadMediaManifest(mediaManifestUrl, streamItem.get("bandwidth"), _injectMediaManifest));
              }
            }
          }
        }

        Promise.all(mediaManifestPromises).then(() => {
          let audioGroups = {};
          let subtitleGroups = {};
          for (let i = 0; i < m3u.items.StreamItem.length; i++) {
            const streamItem = m3u.items.StreamItem[i];
            if (streamItem.get("audio")) {
              let audioGroupId = streamItem.get("audio");
              if (!HAS_AUDIO_DEFAULTS && !this.audioSegments[audioGroupId]) {
                this.audioSegments[audioGroupId] = {};
              }
              const audioCodecs = streamItem.get("codecs").split(",").find(c => {
                return c.match(/^mp4a/) || c.match(/^ac-3/) || c.match(/^ec-3/);
              });

              debug(`Lookup media item for '${audioGroupId}'`);

              // # Needed for the case when loading after another VOD.
              const previousVODLanguages = HAS_AUDIO_DEFAULTS
                ? Object.keys(this.audioSegments[this.defaultAudioGroupAndLang.audioGroupId])
                : Object.keys(this.audioSegments[audioGroupId]);

              let audioGroupItems = m3u.items.MediaItem.filter((item) => {
                return item.get("type") === "AUDIO" && item.get("group-id") === audioGroupId;
              });
              // # Find all langs amongst the mediaItems that have this group id.
              // # It extracts each mediaItems language attribute value.
              // # ALSO initialize in this.audioSegments a lang. property who's value is an array [{seg1}, {seg2}, ...].
              let audioLanguages = audioGroupItems.map((item) => {
                let itemLang;
                if (!item.get("language")) {
                  itemLang = item.get("name");
                } else {
                  itemLang = item.get("language");
                }
                // Initialize lang. in new group.
                if (!HAS_AUDIO_DEFAULTS && !this.audioSegments[audioGroupId][itemLang]) {
                  this.audioSegments[audioGroupId][itemLang] = [];
                }
                if (!this.audioCodecsMap[audioCodecs]) {
                  this.audioCodecsMap[audioCodecs] = {};
                }
                const itemChannels = item.get("channels") ? item.get("channels") : "2";
                this.audioCodecsMap[audioCodecs][itemChannels] = audioGroupId;
                return (item = itemLang);
              });

              // # Inject "default" language's segments to every new language relative to previous VOD.
              // # For the case when this is a VOD following another, every language new or old should
              // # start with some segments from the previous VOD's last sequence.
              const newLanguages = audioLanguages.filter((lang) => {
                return !previousVODLanguages.includes(lang);
              });
              // # Only inject if there were prior tracks.
              if (previousVODLanguages.length > 0 && !HAS_AUDIO_DEFAULTS) {
                for (let i = 0; i < newLanguages.length; i++) {
                  const newLanguage = newLanguages[i];
                  const defaultLanguage = this._getFirstAudioLanguageWithSegments(audioGroupId);
                  this.audioSegments[audioGroupId][newLanguage] = [...this.audioSegments[audioGroupId][defaultLanguage]];
                }
              }

              // # Need to clean up langs. loaded from prev. VOD that current VOD doesn't have.
              // # Necessary, for the case when getLiveMediaSequenceAudioSegments() tries to
              // # access an audioGroup's language that the current VOD never had. A False-Positive.
              if (!HAS_AUDIO_DEFAULTS) {
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
              }

              // # For each lang, find the lang playlist uri and do _loadAudioManifest() on it.
              for (let j = 0; j < audioLanguages.length; j++) {
                let audioLang = audioLanguages[j];
                let audioUri = audioGroupItems[j].get("uri");
                if (!audioUri) {
                  //# if mediaItems dont have uris
                  let audioVariant = m3u.items.StreamItem.find((item) => {
                    return !item.get("resolution") && item.get("audio") === audioGroupId;
                  });
                  if (audioVariant) {
                    audioUri = audioVariant.get("uri");
                  }
                }
                if (audioUri) {
                  let audioManifestUrl = urlResolve(baseUrl, audioUri);
                  if (!audioGroups[audioGroupId]) {
                    audioGroups[audioGroupId] = {};
                  }
                  // # Prevents 'loading' an audio track with same GroupID and LANG.
                  // # otherwise it just would've loaded OVER the latest occurrent of the LANG in GroupID.
                  if (!audioGroups[audioGroupId][audioLang]) {
                    let targetGroup = audioGroupId;
                    let targetLang = audioLang;
                    audioGroups[audioGroupId][audioLang] = true;
                    if (HAS_AUDIO_DEFAULTS) {
                      targetGroup = this.defaultAudioGroupAndLang.audioGroupId;
                      targetLang = this.defaultAudioGroupAndLang.audioLanguage;
                      debug(`Loading Audio manifest onto Default GroupID=${targetGroup} and Language=${targetLang}`);
                    }
                    audioManifestPromises.push(this._loadAudioManifest(audioManifestUrl, targetGroup, targetLang, _injectAudioManifest));
                  } else {
                    debug(`Audio manifest for language "${audioLang}" from '${audioGroupId}' in already loaded, skipping`);
                  }
                } else {
                  debug(`No media item for '${audioGroupId}' in "${audioLang}" was found, skipping`);
                }
              }
            } else if (this.forcedDemuxMode) {
              reject(new Error("The vod is not a demux vod"));
            }

            if (this.shouldContainSubtitles) {
              if (!this.subtitleSliceEndpoint) {
                reject(new Error("Missing subtitle slice URL"));
                continue;
              }
              if (!this.expectedSubtitleTracks) {
                reject(new Error("There are no expected subtitle tracks"));
                continue;
              }

              if (this.shouldContainSubtitles) {
                if (!this.subtitleSegments[DUMMY_DEFAULT_SUBTITLE_GROUP_ID]) {
                  this.subtitleSegments[DUMMY_DEFAULT_SUBTITLE_GROUP_ID] = {};
                }
                if (!this.subtitleSegments[DUMMY_DEFAULT_SUBTITLE_GROUP_ID][DUMMY_DEFAULT_SUBTITLE_LANGUAGE]) {
                  this.subtitleSegments[DUMMY_DEFAULT_SUBTITLE_GROUP_ID][DUMMY_DEFAULT_SUBTITLE_LANGUAGE] = [];
                }
              }

              if (!this.subtitleSegments[DEFAULT_SUBTITLE_GROUP_ID]) {
                this.subtitleSegments[DEFAULT_SUBTITLE_GROUP_ID] = {};
              }
              for (let i = 0; i < this.expectedSubtitleTracks.length; i++) {
                const element = this.expectedSubtitleTracks[i];
                if (!this.subtitleSegments[DEFAULT_SUBTITLE_GROUP_ID][element.language]) {
                  this.subtitleSegments[DEFAULT_SUBTITLE_GROUP_ID][element.language] = [];
                }
              }
              if (streamItem.get("subtitles")) {
                if (!subtitleGroups[DEFAULT_SUBTITLE_GROUP_ID]) {
                  subtitleGroups[DEFAULT_SUBTITLE_GROUP_ID] = {};
                }

                let subtitleGroupId = streamItem.get("subtitles");
                let subtitleGroupItems = m3u.items.MediaItem.filter((item) => {
                  return item.get("type") === "SUBTITLES" && item.get("group-id") === subtitleGroupId;
                });


                // # Find all langs amongst the mediaItems that have this group id.
                // # It extracts each mediaItems language attribute value.
                // # ALSO initialize in this.subtitleSegments a lang. property who's value is an array [{seg1}, {seg2}, ...].
                let subtitleLanguages = subtitleGroupItems.map((item) => {
                  let itemLang;
                  if (!item.get("language")) {
                    itemLang = item.get("name");
                  } else {
                    itemLang = item.get("language");
                  }

                  for (let index = 0; index < this.expectedSubtitleTracks.length; index++) {
                    const element = this.expectedSubtitleTracks[index];
                    if (element.language.toLowerCase() === itemLang.toLowerCase() || element.name.toLowerCase() === itemLang.toLowerCase()) {
                      return (item = element.language);
                    }
                  }
                  return;
                }).filter((item) => item !== undefined);


                // # For each lang, find the lang playlist uri and do _loadSubtitleManifest() on it.
                for (let j = 0; j < subtitleLanguages.length; j++) {
                  let subtitleLang = subtitleLanguages[j];
                  let subtitleUri = subtitleGroupItems[j].get("uri");
                  if (!subtitleUri) {
                    //# if mediaItems dont have uris
                    let subtitleVariant = m3u.items.StreamItem.find((item) => {
                      return !item.get("resolution") && item.get("subtitle") === subtitleGroupId;
                    });
                    if (subtitleVariant) {
                      subtitleUri = subtitleVariant.get("uri");
                    }
                  }
                  if (subtitleUri) {
                    let subtitleManifestUrl = urlResolve(baseUrl, subtitleUri);
                    // # Prevents 'loading' an subtitle track with same GroupID and LANG.
                    // # otherwise it just would've loaded OVER the latest occurrent of the LANG in GroupID.
                    if (!subtitleGroups[this.DEFAULT_SUBTITLE_GROUP_ID][subtitleLang]) {
                      let targetGroup = this.DEFAULT_SUBTITLE_GROUP_ID;
                      let targetLang = subtitleLang;
                      subtitleGroups[this.DEFAULT_SUBTITLE_GROUP_ID][subtitleLang] = true;
                      subtitleManifestPromises.push(this._loadSubtitleManifest(subtitleManifestUrl, targetGroup, targetLang, _injectSubtitleManifest));
                    } else {
                      debug(`Subtitle manifest for language "${this.DEFAULT_SUBTITLE_GROUP_ID}" from '${subtitleGroupId}' in already loaded, skipping`);
                    }
                  } else {
                    debug(`No media item for '${subtitleGroupId}' in "${subtitleLang}" was found, skipping`);
                  }
                }
              } else if (this.shouldContainSubtitles) {
                if (!this.dummySubtitleEndpoint) {
                  reject(new Error("Loaded VOD does not contain subtitles and there is no dummy subtitle segment URL configured"));
                }
                if (!this.expectedSubtitleTracks) {
                  reject(new Error("There are no expected subtitle tracks"));
                }
                if (!this.subtitleSliceEndpoint) {
                  reject(new Error("Missing subtitle slice URL"));
                }
              }
            }
          }
          debug("Codec to Audio Group Id mapping");
          debug(this.audioCodecsMap);

          return Promise.all(audioManifestPromises.concat(subtitleManifestPromises))
        }).then(this._cleanupUnused.bind(this))
          .then(this._createMediaSequences.bind(this))
          .then(resolve)
          .catch((err) => {
            debug("Error loading VOD: Need to cleanup");
            this._cleanupOnFailure();
            reject(err);
          });
      });

      parser.on("error", (err) => {
        reject(err);
      });

      if (!_injectMasterManifest) {
        fetchWithRetry(this.masterManifestUri, null, 5, 1000, 5000, debug)
          .then((res) => {
            if (res.status === 200) {
              res.body.pipe(parser);
            } else {
              throw new Error(res.status + ":: status code error trying to retrieve master manifest " + this.masterManifestUri);
            }
          })
          .catch(reject);
      } else {
        const stream = _injectMasterManifest();
        stream.pipe(parser);
        stream.on("error", (err) => reject(err));
      }
    });
  }

  /**
   * Load and parse the HLS VOD where the first media sequences
   * contains the end sequences of the previous VOD
   *
   * @param {HLSVod} previousVod - the previous VOD to concatenate to
   */
  loadAfter(previousVod, _injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest) {
    debug(`Initializing Load VOD After VOD...`);
    return new Promise((resolve, reject) => {
      this.previousVod = previousVod;
      try {
        this._loadPrevious();
        this.load(_injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest)
          .then(() => {// WARNING we can never remove this.previousVod because it is used later in the code
            previousVod.releasePreviousVod();
            resolve();
          })
          .catch((err) => {
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
        if (mediaSeqNo > 0) {
          let targetUri = "";
          let size = this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]].length;
          for (let idx = size - 1; idx >= 0; idx--) {
            const segItem = this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]][idx];
            if (segItem.uri) {
              targetUri = segItem.uri;
              break;
            }
          }
          let targetPos = 0;
          for (let i = mediaSeqNo; i < this.segments[allBandwidths[0]].length; i++) {
            if (this.segments[allBandwidths[0]][i].uri === targetUri) {
              targetPos = i;
              break;
            }
          }
          allBandwidths.forEach((bw) => (this.segments[bw] = this.segments[bw].slice(targetPos)));
        }

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: slice all audio tracks, in all audio groups
        }

        // Find nearest BW in SFL and prepend them to the corresponding segments bandwidth
        allBandwidths.forEach((bw) => {
          let nearestBw = this._getNearestBandwidthInList(bw, Object.keys(additionalSegments));
          this.segments[bw] = additionalSegments[nearestBw].concat(this.segments[bw]);
        });

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: Prepend segments to all audio tracks, in all audio groups
        }
      } else {
        if (mediaSeqNo >= 0) {
          let size = this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]].length;
          let targetUri = this.mediaSequences[mediaSeqNo].segments[allBandwidths[0]][0].uri;
          let targetPos = 0;
          for (let i = mediaSeqNo; i < this.segments[allBandwidths[0]].length; i++) {
            if (this.segments[allBandwidths[0]][i].uri === targetUri) {
              targetPos = i;
              break;
            }
          }
          allBandwidths.forEach((bw) => (this.segments[bw] = this.segments[bw].slice(targetPos, targetPos + size)));
        }

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: slice all audio tracks, in all audio groups
        }

        allBandwidths.forEach((bw) => {
          let nearestBw = this._getNearestBandwidthInList(bw, Object.keys(additionalSegments));
          this.segments[bw] = this.segments[bw].concat(additionalSegments[nearestBw]);
        });

        if (!this._isEmpty(this.audioSegments)) {
          // TODO: Prepend segments to all audio tracks, in all audio groups
        }
      }

      // Clean up/Reset HLSVod data since we are going to create new data
      this.mediaSequences = [];
      this.mediaSequenceValues = {};
      this.mediaSequenceValuesAudio = {};
      this.discontinuities = {};
      this.deltaTimes = [];
      this.deltaTimesAudio = [];

      try {
        this._createMediaSequences()
          .then(() => {
            resolve();
          })
          .catch((err) => {
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
    try {
      // # When language not found, return segments from first language.
      if (!this.mediaSequences[seqIdx].audioSegments[audioGroupId]) {
        audioGroupId = this._getFirstAudioGroupWithSegments();
        if (!audioGroupId) {
          return [];
        }
      }
      if (!this.mediaSequences[seqIdx].audioSegments[audioGroupId][audioLanguage]) {
        const fallbackLang = this._getFirstAudioLanguageWithSegments(audioGroupId);
        return this.mediaSequences[seqIdx].audioSegments[audioGroupId][fallbackLang];
      }
      return this.mediaSequences[seqIdx].audioSegments[audioGroupId][audioLanguage];
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  /**
   * Get all subtitle segments (duration, uri) for a specific media sequence
   *
   * @param {string} subtitleGroupId - subtitle group Id
   * @param {string} subtitleLanguage - subtitle language
   * @param {number} seqIdx - media sequence index (first is 0)
   */
  getLiveMediaSequenceSubtitleSegments(subtitleGroupId, subtitleLanguage, seqIdx) {
    try {
      // # When language not found, return segments from default language.
      if (!this.mediaSequences[seqIdx].subtitleSegments[subtitleGroupId]) {
        subtitleGroupId = DUMMY_DEFAULT_SUBTITLE_GROUP_ID;
      }

      if (!this.mediaSequences[seqIdx].subtitleSegments[subtitleGroupId][subtitleLanguage]) {
        const fallbackLang = DUMMY_DEFAULT_SUBTITLE_LANGUAGE;
        subtitleGroupId = DUMMY_DEFAULT_SUBTITLE_GROUP_ID;
        return this.mediaSequences[seqIdx].subtitleSegments[subtitleGroupId][fallbackLang];
      }
      return this.mediaSequences[seqIdx].subtitleSegments[subtitleGroupId][subtitleLanguage];
    } catch (err) {
      console.error(err);
      return [];
    }
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

  getAudioGroupIdForCodecs(audioCodecs, channels) {
    // {
    //   "ec-3": [
    //     { "6": "audio1" }
    //   ]
    // }
    let audioGroupId;
    if (!this.audioCodecsMap[audioCodecs]) {
      return undefined;
    }
    Object.keys(this.audioCodecsMap[audioCodecs]).map(channelsKey => {
      if (channelsKey === channels) {
        audioGroupId = this.audioCodecsMap[audioCodecs][channelsKey];
      }
    });
    return audioGroupId;
  }

  getAudioCodecsAndChannelsForGroupId(groupId) {
    let audioCodecs;
    let channels;
    Object.keys(this.audioCodecsMap).map(codecKey => {
      Object.keys(this.audioCodecsMap[codecKey]).map(channelsKey => {
        if (this.audioCodecsMap[codecKey][channelsKey] === groupId) {
          audioCodecs = codecKey;
          channels = channelsKey;
        }
      });
    });
    return [audioCodecs, channels];
  }

  getSubtitleGroups(all = false) {
    return Object.keys(this.subtitleSegments).filter(groupId => groupId !== this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID || all);
  }

  getSubtitleLangsForSubtitleGroup(groupId) {
    return Object.keys(this.subtitleSegments[groupId]);
  }

  /**
   * Get the number of media sequences for this VOD
   */
  getLiveMediaSequencesCount(media = "video") {
    if (media === "audio") {
      return this.audioSequencesCount;
    } else if (media === "subtitle") {
      return this.subtitleSequencesCount;
    }
    return this.videoSequencesCount;
  }

  /**
   * Get the media-sequence value for the last media sequence of this VOD
   */
  getLastSequenceMediaSequenceValue() {
    const end = Object.keys(this.mediaSequenceValues).length - 1;
    return this.mediaSequenceValues[end];
  }

  /**
   * Get the media-sequence value for the last audio media sequence of this VOD
   */
  getLastSequenceMediaSequenceValueAudio() {
    const end = Object.keys(this.mediaSequenceValuesAudio).length - 1;
    return this.mediaSequenceValuesAudio[end];
  }

  /**
   * Get the media-sequence value for the last subtitle media sequence of this VOD
   */
  getLastSequenceMediaSequenceValueSubtitle() {
    const end = Object.keys(this.mediaSequenceValuesSubtitle).length - 1;
    return this.mediaSequenceValuesSubtitle[end];
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
    const seqStep = this.mediaSequenceValues[seqIdx];
    m3u8 += "#EXT-X-INDEPENDENT-SEGMENTS\n";
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqStep) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 += "#EXT-X-DISCONTINUITY-SEQUENCE:" + (discInOffset + this.discontinuities[seqIdx]) + "\n";
    this.lastUsedDiscSeq = discInOffset + this.discontinuities[seqIdx];

    if (!this.mediaSequences[seqIdx]) {
      debug("No sequence idx: " + seqIdx);
      return m3u8;
    }
    if (!this.mediaSequences[seqIdx].segments[bw]) {
      debug("No segments in media sequence idx: " + seqIdx + ` bw: ` + bw);
      debug(this.mediaSequences[seqIdx]);
      return m3u8;
    }

    let previousSegment = null;
    for (let i = 0; i < this.mediaSequences[seqIdx].segments[bw].length; i++) {
      const v = this.mediaSequences[seqIdx].segments[bw][i];
      if (v) {
        m3u8 += segToM3u8(v, i,
          this.mediaSequences[seqIdx].segments[bw].length,
          this.mediaSequences[seqIdx].segments[bw][i + 1],
          previousSegment);
        previousSegment = v;
      }
    }

    return m3u8;
  }

  /**
   * Gets a hls/makes m3u8-file with all of the correct audio segments
   * belonging to a given groupID & language for a particular sequence.
   */
  getLiveMediaAudioSequences(offset, audioGroupId, audioLanguage, seqIdx, discOffset, padding, forceTargetDuration) {
    debug(`Get live audio media sequence [${seqIdx}] for audioGroupId=${audioGroupId}`);
    const mediaSeqAudioSegments = this.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx);
    // # If failed to find segments for given language,
    // # return null rather than an error.
    if (!mediaSeqAudioSegments) {
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
    m3u8 += "#EXT-X-VERSION:6\n";
    if (this.header) {
      m3u8 += this.header;
    }
    const seqStep = this.mediaSequenceValuesAudio[seqIdx];
    m3u8 += "#EXT-X-INDEPENDENT-SEGMENTS\n";
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqStep) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 += "#EXT-X-DISCONTINUITY-SEQUENCE:" + (discInOffset + this.discontinuitiesAudio[seqIdx]) + "\n";

    let previousSegment = null;
    for (let i = 0; i < mediaSeqAudioSegments.length; i++) {
      const v = mediaSeqAudioSegments[i];
      if (v) {
        m3u8 += segToM3u8(v, i, mediaSeqAudioSegments.length,
          mediaSeqAudioSegments[i + 1], previousSegment);
        previousSegment = v;
      }
    }

    return m3u8;
  }

  /**
   * Gets a hls/makes m3u8-file with all of the correct subtitle segments
   * belonging to a given groupID & language for a particular sequence.
   */
  getLiveMediaSubtitleSequences(offset, subtitleGroupId, subtitleLanguage, seqIdx, discOffset, padding, forceTargetDuration) {
    debug(`Get live subtitle media sequence [${seqIdx}] for subtitleGroupId=${subtitleGroupId}`);
    const mediaSeqSubtitleSegments = this.getLiveMediaSequenceSubtitleSegments(this.DEFAULT_SUBTITLE_GROUP_ID, subtitleLanguage, seqIdx);

    let targetDuration = this._determineTargetDuration(mediaSeqSubtitleSegments);
    if (padding) {
      targetDuration += padding;
    }
    if (forceTargetDuration) {
      targetDuration = forceTargetDuration;
    }

    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:6\n";
    if (this.header) {
      m3u8 += this.header;
    }
    const seqStep = this.mediaSequenceValuesSubtitle[seqIdx];
    m3u8 += "#EXT-X-INDEPENDENT-SEGMENTS\n";
    m3u8 += "#EXT-X-TARGETDURATION:" + targetDuration + "\n";
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + (offset + seqStep) + "\n";
    let discInOffset = discOffset;
    if (discInOffset == null) {
      discInOffset = 0;
    }
    m3u8 += "#EXT-X-DISCONTINUITY-SEQUENCE:" + (discInOffset + this.discontinuitiesSubtitle[seqIdx]) + "\n";

    let previousSegment = null;
    for (let i = 0; i < mediaSeqSubtitleSegments.length; i++) {
      const v = mediaSeqSubtitleSegments[i];
      if (v) {
        m3u8 += segToM3u8(v, i, mediaSeqSubtitleSegments.length,
          mediaSeqSubtitleSegments[i + 1], previousSegment);
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
    return this.discontinuities[this.videoSequencesCount - 1];
  }

  /**
   * Get the last audio discontinuity sequence number
   */
  getLastDiscontinuityAudio() {
    return this.discontinuitiesAudio[this.audioSequencesCount - 1];
  }

  getLastDiscontinuitySubtitle() {
    return this.discontinuitiesSubtitle[this.subtitleSequencesCount - 1];
  }

  /**
   * Get the delta times for each media sequence.
   */
  getDeltaTimes(media = "video") {
    if (media === "audio") {
      return this.deltaTimesAudio.map((o) => o.interval);
    } else if (media === "subtitle") {
      return this.deltaTimesSubtitle.map((o) => o.interval);
    }
    return this.deltaTimes.map((o) => o.interval);
  }

  /**
   * Returns the playhead position for each media sequence
   */
  getPlayheadPositions(media = "video") {
    if (media === "audio") {
      return this.deltaTimesAudio.map((o) => o.position);
    } else if (media === "subtitle") {
      return this.deltaTimesSubtitle.map((o) => o.position);
    }
    return this.deltaTimes.map((o) => o.position);
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
    const duration = this.segments[bw].reduce((acc, s) => (s.duration ? acc + s.duration : acc), 0);
    return duration;
  }

  /**
   * Returns the last added Discontinuity sequence count from getLiveMediaSequences()
   */
  getLastUsedDiscSeq() {
    return this.lastUsedDiscSeq;
  }

  generateSmallerSubtitleSegments(segment, offset, leftover, useDummyUrl, first, elapsedTime) {
    if (leftover === null) {
      leftover = {};
    }
    const bandwidths = Object.keys(this.segments);
    let videoSegments = this.segments[bandwidths[0]]
    let newSegmentList = [];
    let totalSubtitleSegmentDuration = segment.duration;
    let index = offset;
    let allVideoDurationUsed = false;
    while (index < videoSegments.length && totalSubtitleSegmentDuration > 0) {
      if (videoSegments[index].discontinuity) {
        newSegmentList.push(videoSegments[index])
        index += 1;
        continue;
      }
      if (this.startTimeOffset > 0 && this._removedVideoDuration !== this._removedSubtitleDuration && first) {
        first = false;
        totalSubtitleSegmentDuration -= (this._removedSubtitleDuration / 1000)
      }
      const params = new URLSearchParams();
      const startTime = segment.duration - totalSubtitleSegmentDuration;
      const consumedVideoDuration = leftover.consumedVideoDuration ? leftover.consumedVideoDuration : 0
      const endTime = startTime + Math.min(videoSegments[index].duration, totalSubtitleSegmentDuration) - consumedVideoDuration;

      if (!useDummyUrl) {
        params.append("vtturi", segment.uri)
        if (leftover.previousSegmentUri) {
          params.append("previousvtturi", leftover.previousSegmentUri);
        }
        params.append("starttime", startTime)
        params.append("endtime", endTime)
        params.append("elapsedtime", elapsedTime)
      } else {
        params.append("p", index)
      }

      const base = useDummyUrl ? this.dummySubtitleEndpoint : this.subtitleSliceEndpoint;
      const newUri = base + "?" + params;
      let newSegment = { ...segment };
      newSegment.uri = newUri;

      if (leftover.duration) {
        newSegment.duration = leftover.duration + leftover.consumedVideoDuration;
        totalSubtitleSegmentDuration -= leftover.duration;
        if (leftover.duration + leftover.consumedVideoDuration === videoSegments[index].duration) {
          allVideoDurationUsed = true;
        }
        leftover = {};
      }
      else if (videoSegments[index].duration < totalSubtitleSegmentDuration) {
        newSegment.duration = videoSegments[index].duration;
        totalSubtitleSegmentDuration -= videoSegments[index].duration;
        allVideoDurationUsed = true;
      } else if (videoSegments[index].duration === totalSubtitleSegmentDuration) {
        newSegment.duration = totalSubtitleSegmentDuration;
        totalSubtitleSegmentDuration = 0;
        allVideoDurationUsed = true;
      } else {
        leftover = {
          duration: videoSegments[index].duration - totalSubtitleSegmentDuration,
          previousSegmentUri: params,
          consumedVideoDuration: totalSubtitleSegmentDuration
        }
        totalSubtitleSegmentDuration = 0;
        newSegment = null;
      }
      if (newSegment) {
        newSegmentList.push(newSegment);
      }
      if (allVideoDurationUsed) {
        index++;
        allVideoDurationUsed = false;
      }
    }

    elapsedTime += segment.duration;
    return { newSegments: newSegmentList, offset: index, leftover: leftover, elapsedTime: elapsedTime }
  }

  generateSequencesTypeAVideo(bw) {
    let seqIndex = 0;
    let video_duration = 0;
    const length = this.segments[bw].length;
    let segOffset = 0;
    let segIdx = 0;
    let sequence = {};
    let video_sequence_list = []
    while (this.segments[bw][segIdx] && segIdx != length) {
      if (this.segments[bw][segIdx].uri) {
        video_duration += this.segments[bw][segIdx].duration;
      }
      if (video_duration < this.sequenceDuration) {
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
            console.error(
              Object.keys(this.segments).map((b) => {
                return { bw: b, len: this.segments[b].length };
              })
            );
            reject("Internal data structure error");
            return;
          }
          let seg = this.segments[bwIdx][segIdx];
          if (!seg) {
            debug(segIdx, `WARNING! The sequence[bw=${bwIdx}] pushed seg=${seg}`);
          }
          sequence[bwIdx].push(seg);
        }
        segIdx++;
      } else {
        //debug(`Pushing seq=${this.mediaSequences.length} firstSeg=${sequence[Object.keys(this.segments)[0]][0].uri}, length=${sequence[Object.keys(this.segments)[0]].length}, duration=${duration} < ${this.sequenceDuration}`);
        if (!sequence[Object.keys(this.segments)[0]][0].uri) {
          // If first element in the sequence is a discontinuity or a cue tag we need to 'skip' the following element that
          // contains the segment uri and is the actual playlist item to roll over the top.
          segOffset++;
        }
        video_duration = 0;
        video_sequence_list.push(sequence);
        this.mediaSequenceValues[seqIndex] = seqIndex;
        seqIndex++;
        sequence = {};
        segOffset++;
        segIdx = segOffset;
      }
    }

    // Final step (video)
    if (video_duration < this.sequenceDuration) {
      // We are out of segments but have not reached the full duration of a sequence
      video_duration = 0;
      video_sequence_list.push(sequence);
      this.mediaSequenceValues[seqIndex] = seqIndex;
      sequence = {};
    }

    return video_sequence_list;
  }
  generateSequencesTypeAExtraMedia(segments, firstGroupId, firstLanguage, type) {

    let segmentLength = segments[firstGroupId][firstLanguage].length;

    let duration = 0;
    let sequence = {};
    let sequenceList = [];
    let segIdx = 0;
    let seqIndex = 0;
    let segOffset = 0;

    while (segments[firstGroupId][firstLanguage][segIdx] && segIdx != segmentLength) {
      if (segments[firstGroupId][firstLanguage][segIdx].uri) {
        duration += segments[firstGroupId][firstLanguage][segIdx].duration;
      }
      if (duration < this.sequenceDuration) {
        if (firstGroupId) {
          const groupIds = Object.keys(segments);
          for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            if (!sequence[groupId]) {
              sequence[groupId] = {};
            }
            const langs = Object.keys(segments[groupId]);
            for (let k = 0; k < langs.length; k++) {
              const lang = langs[k];
              if (!sequence[groupId][lang]) {
                sequence[groupId][lang] = [];
              }
              let seg = segments[groupId][lang][segIdx];
              if (!seg) {
                if (type === "subtitle") {
                  const dummySeg = segments[firstGroupId][firstLanguage][segIdx];
                  if (dummySeg) {
                    sequence[groupId][lang].push(dummySeg);
                  } else {
                    sequence[groupId][lang].push(seg);
                    debug(segIdx, `WARNING! The ${type}Sequence[id=${groupId}][lang=${lang}] pushed seg=${seg}`);
                  }
                } else {
                  sequence[groupId][lang].push(seg);
                  debug(segIdx, `WARNING! The ${type}Sequence[id=${groupId}][lang=${lang}] pushed seg=${seg}`);
                }
              } else {
                sequence[groupId][lang].push(seg);
              }
            }
          }
        }
        segIdx++;
      } else {
        if (!sequence[firstGroupId][firstLanguage][0].uri) {
          // If first element in the sequence is a discontinuity or a cue tag we need to 'skip' the following element that
          // contains the segment uri and is the actual playlist item to roll over the top.
          segOffset++;
        }
        duration = 0;
        sequenceList.push(sequence);
        if (type === "audio") {
          this.mediaSequenceValuesAudio[seqIndex] = seqIndex;
        } else if (type === "subtitle") {
          this.mediaSequenceValuesSubtitle[seqIndex] = seqIndex;
        }
        seqIndex++;
        sequence = {};
        segOffset++;

        segIdx = segOffset;
      }
    }

    if (duration < this.sequenceDuration) {
      // We are out of segments but have not reached the full duration of a sequence
      duration = 0;
      sequenceList.push(sequence);
      if (type === "audio") {
        this.mediaSequenceValuesAudio[seqIndex] = seqIndex;
      } else if (type === "subtitle") {
        this.mediaSequenceValuesSubtitle[seqIndex] = seqIndex;
      }
      sequence = {};
    }
    return sequenceList
  }
  generateSequencesTypeBVideo(bw, bandwidths) {
    let seqIndex = 0;
    let totalRemovedDiscTags = 0;
    let sequence = {};
    const videoSequences = [];
    let totalSeqDurVideo = 0;
    let segIdxVideo = 0;
    let totalRemovedSegments = 0;
    const SIZE = this.segments[bw].length;
    // Process Video Segments
    while (this.segments[bw][segIdxVideo] && segIdxVideo < SIZE) {
      try {
        totalSeqDurVideo = 0;
        const _sequence = JSON.parse(JSON.stringify(sequence));
        if (_sequence[bw] && _sequence[bw].length > 0) {
          let temp = 0;
          _sequence[bw].forEach((seg) => {
            if (seg && seg.duration) {
              temp += seg.duration;
            }
          });
          totalSeqDurVideo = temp;
        }
        if (segIdxVideo === 0) {
          // Create the very first sequence. (No need to remove any segments)
          let seqDur = 0;
          let loop = true;
          while (loop && seqDur < this.sequenceDuration && segIdxVideo < SIZE) {
            bandwidths.forEach((_bw) => {
              if (!_sequence[_bw]) {
                _sequence[_bw] = [];
              }
              const seg = this.segments[_bw][segIdxVideo];
              if (seg && seg.duration && _bw === bw) {
                seqDur += seg.duration;
              }
              if (seg.vodTransition) {
                loop = false;
              } else {
                if (seqDur < this.sequenceDuration) {
                  if (!seg) {
                    debug(segIdxVideo, `WARNING! The _sequence[bw=${_bw}] pushed seg=${seg}`);
                  }
                  _sequence[_bw].push(seg);
                }
              }
            });
            if (loop && seqDur < this.sequenceDuration) {
              segIdxVideo++;
            }
          }
        } else {
          // Creating the rest of the sequences
          let newPushedSegmentsCount = 0;
          // 1 - Add new segments until we overflow (per variant)
          while (totalSeqDurVideo < this.sequenceDuration && segIdxVideo < SIZE) {
            bandwidths.forEach((_bw) => {
              if (!_sequence[_bw]) {
                _sequence[_bw] = [];
              }
              const seg = this.segments[_bw][segIdxVideo];
              if (seg && seg.duration && _bw === bw) {
                totalSeqDurVideo += seg.duration;
              }
              if (!seg) {
                debug(segIdxVideo, `WARNING! The _sequence[bw=${_bw}] pushed seg=${seg}`);
              }
              _sequence[_bw].push(seg);
              if (_bw === bandwidths[0] && seg.duration) {
                newPushedSegmentsCount++;
              }
            });
            segIdxVideo++;
          }
          let shiftOnce = true;
          let shiftedSegmentsCount = 0;
          // 2 - Shift excess segments and keep count of what has been removed (per variant)
          while (totalSeqDurVideo >= this.sequenceDuration|| (shiftOnce && segIdxVideo !== 0)) {
            shiftOnce = false;
            let timeToRemove = 0;
            let incrementDiscSeqCount = false;
            bandwidths.forEach((bw) => {
              let seg = _sequence[bw].shift();
              if (!seg) {
                // Should not happen, debug
                debug(`WARNING! The _sequence[bw=${bw}] shifted seg=${seg}`);
              } else {
                while (seg && !seg.duration && _sequence[bw].length > 0) {
                  incrementDiscSeqCount = true;
                  seg = _sequence[bw].shift();
                }
              }
              if (seg && seg.duration) {
                timeToRemove = seg.duration;
              }
            });
            if (timeToRemove) {
              totalSeqDurVideo -= timeToRemove;
              totalRemovedSegments++;
              shiftedSegmentsCount++;
            }
            if (incrementDiscSeqCount) {
              totalRemovedDiscTags++;
            }

            /*
            To avoid creating a sequence where we remove 2 segments to add 2 segments.
            Aim to add and remove as few segments as possible each sequence.
            */
            if (
              segIdxVideo < SIZE &&
              shiftedSegmentsCount === 1 &&
              newPushedSegmentsCount > 1 &&
              totalSeqDurVideo >= this.sequenceDuration
            ) {
              // pop video...
              bandwidths.forEach((_bw) => {
                let seg = _sequence[_bw].pop();
                if (seg && seg.duration) {
                  timeToRemove = seg.duration;
                }
              });
              // decrement...
              newPushedSegmentsCount--;
              segIdxVideo--;
              totalSeqDurVideo -= timeToRemove;
            }
          }
        }

        videoSequences.push(_sequence);
        this.mediaSequenceValues[seqIndex] = totalRemovedSegments;
        this.discontinuities[seqIndex] = totalRemovedDiscTags;
        sequence = _sequence;
        seqIndex++;
      } catch (err) {
        console.error(err);
      }
    }
    return videoSequences;
  }
  generateSequencesTypeBExtraMedia(segments, firstGroupId, firstLanguage, type) {
    let totalRemovedDiscTags = 0;
    let totalRemovedSegments = 0;
    let sequence = {};
    let segIdx = 0;
    let seqIndex = 0;
    let sequences = [];
    let SIZE = 0;
    if (type === "audio") {
      SIZE = segments[firstGroupId][firstLanguage].length;
    } else if (type === "subtitle") {
      SIZE = segments[firstGroupId][firstLanguage].length;
    }
    let totalSeqDur = 0;
    while (segments[firstGroupId][firstLanguage][segIdx] && segIdx < SIZE) {
      try {
        totalSeqDur = 0;
        const _sequence = JSON.parse(JSON.stringify(sequence));
        if (
          _sequence[firstGroupId] &&
          _sequence[firstGroupId][firstLanguage] &&
          _sequence[firstGroupId][firstLanguage].length > 0
        ) {
          let temp = 0;
          _sequence[firstGroupId][firstLanguage].forEach((seg) => {
            if (seg && seg.duration) {
              temp += seg.duration;
            }
          });
          totalSeqDur = temp;
        }
        if (segIdx === 0) {
          // Create the very first sequence. (No need to remove any segments)
          let seqDur = 0;
          let loop = true;
          while (loop && seqDur < this.sequenceDuration && segIdx < SIZE) {
            let first = true;
            const groupIds = Object.keys(segments);
            groupIds.forEach((groupId) => {
              if (!_sequence[groupId]) {
                _sequence[groupId] = {};
              }
              const langs = Object.keys(segments[groupId]);
              langs.forEach((lang) => {
                if (!_sequence[groupId][lang]) {
                  _sequence[groupId][lang] = [];
                }
                const seq_seg = segments[groupId][lang][segIdx];
                if (seq_seg && seq_seg.duration && first) {
                  first = false;
                  seqDur += seq_seg.duration;
                }
                if (seq_seg && seq_seg.vodTransition) {
                  loop = false;
                } else {
                  if (seqDur < this.sequenceDuration) {
                    if (!seq_seg) {
                      if (type === "subtitle") {
                        const dummySeg = segments[firstGroupId][firstLanguage][segIdx];
                        if (dummySeg) {
                          _sequence[groupId][lang].push(dummySeg);
                        }
                      } else {
                        _sequence[groupId][lang].push(seq_seg);
                      }
                      debug(segIdx, `WARNING! The _${type}Sequence[id=${groupId}][lang=${lang}] pushed seg=${seq_seg}`);
                    } else {
                      _sequence[groupId][lang].push(seq_seg);
                    }
                  }
                }
              });
            });
            if (loop && seqDur < this.sequenceDuration) {
              segIdx++;
            }
          }
        } else {
          // Creating the rest of the sequences
          let newPushedSegmentsCount = 0;
          // 1 - Add new segments until we overflow (per variant)
          while (totalSeqDur < this.sequenceDuration && segIdx < SIZE) {
            let first = true;
            const groupIds = Object.keys(segments);
            groupIds.forEach((groupId) => {
              if (!_sequence[groupId]) {
                _sequence[groupId] = {};
              }
              const langs = Object.keys(segments[groupId]);
              langs.forEach((lang) => {
                if (!_sequence[groupId][lang]) {
                  _sequence[groupId][lang] = [];
                }
                const seq_seg = segments[groupId][lang][segIdx];
                if (seq_seg && seq_seg.duration && first) {
                  first = false;
                  totalSeqDur += seq_seg.duration;
                  newPushedSegmentsCount++;
                }
                if (!seq_seg) {
                  if (type === "subtitle") {
                    const dummySeg = segments[firstGroupId][firstLanguage][segIdx];
                    if (dummySeg) {
                      _sequence[groupId][lang].push(dummySeg);
                    } else {
                      sequence[groupId][lang].push(seq_seg);
                    }
                  } else {
                    _sequence[groupId][lang].push(seq_seg);
                  }
                  debug(segIdx, `WARNING! The _${type}Sequence[id=${groupId}][lang=${lang}] pushed seg=${seq_seg}`);
                } else {
                  _sequence[groupId][lang].push(seq_seg);
                }
              });
            });
            segIdx++;
          }
          let shiftOnce = true;
          let shiftedSegmentsCount = 0;
          // 2 - Shift excess segments and keep count of what has been removed (per variant)
          while (totalSeqDur >= this.sequenceDuration || (shiftOnce && segIdx !== 0)) {  // TODO continue here
            shiftOnce = false;
            let timeToRemove = 0;
            let incrementDiscSeqCount = false;
            const groupIds = Object.keys(segments);
            let first = true;
            groupIds.forEach((groupId) => {
              if (!_sequence[groupId]) {
                _sequence[groupId] = {};
              }
              const langs = Object.keys(segments[groupId]);
              langs.forEach((lang) => {
                if (!_sequence[groupId][lang]) {
                  _sequence[groupId][lang] = [];
                }
                let seg = _sequence[groupId][lang].shift();
                if (!seg) {
                  // Should not happen, debug
                  debug(`WARNING! The _${type}Sequence[id=${groupId}][lang=${lang}] shifted seg=${seg}`);
                } else {
                  while (seg && !seg.duration && _sequence[groupId][lang].length > 0) {
                    incrementDiscSeqCount = true;
                    seg = _sequence[groupId][lang].shift();
                  }
                }
                if (seg && seg.duration && first) {
                  first = false;
                  timeToRemove = seg.duration;
                }
              });
            });
            if (timeToRemove) {
              totalSeqDur -= timeToRemove;
              totalRemovedSegments++;
              shiftedSegmentsCount++;
            }
            if (incrementDiscSeqCount) {
              totalRemovedDiscTags++;
            }

            /*
            To avoid creating a sequence where we remove 2 segments to add 2 segments.
            Aim to add and remove as few segments as possible each sequence.
            */
            if (
              segIdx < SIZE &&
              shiftedSegmentsCount === 1 &&
              newPushedSegmentsCount > 1 &&
              totalSeqDur >= this.sequenceDuration
            ) {
              // pop audio...
              if (firstGroupId) {
                const groupIds = Object.keys(segments);
                groupIds.forEach((groupId) => {
                  const langs = Object.keys(segments[groupId]);
                  langs.forEach((lang) => {
                    let seg = _sequence[groupId][lang].pop();
                    if (groupId === groupId && lang === firstLanguage) {
                      timeToRemove = seg.duration;
                    }
                  });
                });
              }
              // decrement...
              newPushedSegmentsCount--;
              segIdx--;
              totalSeqDur -= timeToRemove;
            }
          }
        }
        sequences.push(_sequence);

        if (type === "audio") {
          this.discontinuitiesAudio[seqIndex] = totalRemovedDiscTags;
          this.mediaSequenceValuesAudio[seqIndex] = totalRemovedSegments;
        } else if (type === "subtitle") {
          this.discontinuitiesSubtitle[seqIndex] = totalRemovedDiscTags;
          this.mediaSequenceValuesSubtitle[seqIndex] = totalRemovedSegments;
        }
        sequence = _sequence;
        seqIndex++;
      } catch (err) {
        console.error(err);
      }
    }
    return sequences;
  }

  calculateDeltaAndPositionExtraMedia(type) {
    let prevLastSegment = null;
    let discSeqNo = 0;
    if (type === "audio") {
      this.deltaTimesAudio.push({
        interval: 0,
        position: 0,
      });
    } else if (type === "subtitle") {
      this.deltaTimesSubtitle.push({
        interval: 0,
        position: 0,
      });
    }
    let lastPosition = 0;
    let lastPositionIncrement = 0;
    const sequenceCount = type === "audio" ? this.audioSequencesCount : this.subtitleSequencesCount
    for (let seqNo = 0; seqNo < sequenceCount; seqNo++) {
      const mseq = this.mediaSequences[seqNo];
      const groupId = type === "audio" ? Object.keys(mseq.audioSegments)[0] : Object.keys(mseq.subtitleSegments)[0];
      if (!groupId) {
        continue;
      }
      const lang = type === "audio" ? Object.keys(mseq.audioSegments[groupId])[0] : Object.keys(mseq.subtitleSegments[groupId])[0];
      if (!lang) {
        continue;
      }
      const segments = type === "audio" ? mseq.audioSegments[groupId][lang] : mseq.subtitleSegments[groupId][lang];
      if (segments && segments[0] && segments[0].discontinuity) {
        debug(`Discontinuity in first segment of media seq ${seqNo}`);
        discSeqNo++;
        debug(`Increasing discont sequence ${discSeqNo}`);
      }
      if (this.sequenceAlwaysContainNewSegments) {
        type === "audio" ? this.discontinuitiesAudio[seqNo] += discSeqNo : this.discontinuitiesSubtitle[seqNo] += discSeqNo;
        discSeqNo = 0;
      } else {
        type === "audio" ? this.discontinuitiesAudio[seqNo] = discSeqNo : this.discontinuitiesSubtitle[seqNo] = discSeqNo;
      }

      if (this.sequenceAlwaysContainNewSegments) {
        if (seqNo > 0) {
          let tpi = 0; // Total Position Increment (total newly added content in seconds)
          const prevLastSegIdx = findIndexReversed(segments, (seg) => {
            if (seg.byteRange) {
              if (seg.uri) {
                return seg.uri === prevLastSegment.uri && seg.byteRange === prevLastSegment.byteRange;
              }
            } else {
              if (seg.uri) {
                return seg.uri === prevLastSegment.uri;
              }
            }
            return false;
          });
          for (let i = prevLastSegIdx + 1; i < segments.length; i++) {
            const seg = segments[i];
            if (seg && seg.duration) {
              tpi += seg.duration;
            }
          }
          let lastSegment = segments[segments.length - 1];
          if (lastSegment && lastSegment.discontinuity) {
            lastSegment = segments[segments.length - 2];
          }
          const positionIncrement = lastSegment.duration;
          const interval = tpi - lastPositionIncrement;
          if (type === "audio") {
            this.deltaTimesAudio.push({
              interval: interval,
              position: positionIncrement ? lastPosition + tpi : lastPosition,
            });
          } else if (type === "subtitle") {
            this.deltaTimesSubtitle.push({
              interval: interval,
              position: positionIncrement ? lastPosition + tpi : lastPosition,
            });
          }
          if (positionIncrement) {
            lastPosition += tpi;
            lastPositionIncrement = positionIncrement;
          }
          if (lastSegment && lastSegment.uri) {
            prevLastSegment = lastSegment;
          }
        } else {
          if (segments) {
            let lastSegment = findBottomSegItem(segments);
            if (lastSegment && lastSegment.uri) {
              prevLastSegment = lastSegment;
            }
            lastPositionIncrement = lastSegment.duration;
          }
        }
      } else {
        if (seqNo > 0) {
          const positionIncrement = segments[segments.length - 1].discontinuity
            ? segments[segments.length - 2].duration
            : segments[segments.length - 1].duration;
          const interval = positionIncrement - lastPositionIncrement;
          if (type === "audio") {
            this.deltaTimesAudio.push({
              interval: interval,
              position: positionIncrement ? lastPosition + positionIncrement : lastPosition,
            });
          } else if (type === "subtitle") {
            this.deltaTimesSubtitle.push({
              interval: interval,
              position: positionIncrement ? lastPosition + positionIncrement : lastPosition,
            });
          }
          if (positionIncrement) {
            lastPosition += positionIncrement;
            lastPositionIncrement = positionIncrement;
          }
        } else {
          if (segments) {
            lastPositionIncrement = segments[segments.length - 1].discontinuity
              ? segments[segments.length - 2].duration
              : segments[segments.length - 1].duration;
          }
        }
      }
    }
  }

  // ----- PRIVATE METHODS BELOW ----
  _removedVideoDuration = 0;
  _removedSubtitleDuration = 0;

  _loadPrevious() {
    const bandwidths = this.previousVod.getBandwidths();
    for (let i = 0; i < bandwidths.length; i++) {
      const bw = bandwidths[i];
      this._copyFromPrevious(bw);
    }
    this._copyAudioGroupsFromPrevious();
    this._copySubtitleGroupsFromPrevious();
  }

  _hasMediaSequences(bandwidth) {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount();
    const lastMediaSequence = this.previousVod.getLiveMediaSequenceSegments(previousVodSeqCount - 1)[bandwidth];
    return lastMediaSequence && lastMediaSequence !== undefined;
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
    if (lastMediaSequence && lastMediaSequence.length > 0) {
      let start = this.sequenceAlwaysContainNewSegments ? 0 : 1;
      if (lastMediaSequence[0] && lastMediaSequence[0].discontinuity) {
        start = this.sequenceAlwaysContainNewSegments ? 1 : 2;
      }
      for (let idx = start; idx < lastMediaSequence.length; idx++) {
        let q = lastMediaSequence[idx];
        if (!q) {
          // should not happen, debug
          console.error(`Failed to get segment from lastMediaSequence[${idx}]`);
          console.error(lastMediaSequence);
        }
        if (q.vodTransition) {
          // Remove any vod disc boarders from prev vod
          q = {
            discontinuity: q.discontinuity,
            daterange: q.daterange,
          }
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
      vodTransition: true,
    });
  }

  /**
   * Gets previous VOD's audio -groupIds, -langs, -segments from its last sequence
   * and adds them to the current VOD's this.audioSegments property.
   */
  _copyAudioGroupsFromPrevious() {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount("audio");
    const audioGroups = this.previousVod.getAudioGroups();
    if (audioGroups.length > 0) {
      for (let i = 0; i < audioGroups.length; i++) {
        const audioGroupId = audioGroups[i];
        const audioLangs = this.previousVod.getAudioLangsForAudioGroup(audioGroupId);
        if (audioGroups.length === 1 && audioLangs.length === 1) {
          /**
           * TODO: Handle case where prevVod and nextVod have many groups and languages, but none of them match.
           * Currently, it only sets a default if there is only one possible group and lang to match with on
           * the prevVod.
           */
          this.defaultAudioGroupAndLang = {
            audioGroupId: audioGroups[0],
            audioLanguage: audioLangs[0],
          };
          debug(`Loading from previous - Default GroupID and lang selected=${JSON.stringify(this.defaultAudioGroupAndLang)}`);
        }
        for (let k = 0; k < audioLangs.length; k++) {
          const audioLang = audioLangs[k];
          const lastMediaAudioSequence = this.previousVod.getLiveMediaSequenceAudioSegments(audioGroupId, audioLang, previousVodSeqCount - 1);
          if (!this.audioSegments[audioGroupId]) {
            this.audioSegments[audioGroupId] = {};
          }
          if (!this.audioSegments[audioGroupId][audioLang]) {
            this.audioSegments[audioGroupId][audioLang] = [];
          }
          if (lastMediaAudioSequence && lastMediaAudioSequence.length > 0) {
            let start = this.sequenceAlwaysContainNewSegments ? 0 : 1;
            if (lastMediaAudioSequence[0] && lastMediaAudioSequence[0].discontinuity) {
              start = this.sequenceAlwaysContainNewSegments ? 1 : 2;
            }
            for (let idx = start; idx < lastMediaAudioSequence.length; idx++) {
              let q = lastMediaAudioSequence[idx];
              if (q.vodTransition) {
                // Remove any vod disc boarders from prev vod
                q = {
                  discontinuity: q.discontinuity,
                  daterange: q.daterange,
                }
              }
              this.audioSegments[audioGroupId][audioLang].push(q);
            }
          }
          this.audioSegments[audioGroupId][audioLang].push({
            discontinuity: true,
            daterange: this.rangeMetadata ? this.rangeMetadata : null,
            vodTransition: true
          });
        }
      }
    }
  }

  /**
   * Gets previous VOD's subtitle -groupIds, -langs, -segments from its last sequence
   * and adds them to the current VOD's this.subtitleSegments property.
   */
  _copySubtitleGroupsFromPrevious() {
    const previousVodSeqCount = this.previousVod.getLiveMediaSequencesCount("subtitle");
    const subtitleGroups = this.previousVod.getSubtitleGroups(true);
    if (subtitleGroups.length > 0) {
      for (let i = 0; i < subtitleGroups.length; i++) {
        const subtitleGroupId = subtitleGroups[i];
        const subtitleLangs = this.previousVod.getSubtitleLangsForSubtitleGroup(subtitleGroupId);

        for (let k = 0; k < subtitleLangs.length; k++) {
          const subtitleLang = subtitleLangs[k];
          const lastMediaSubtitleSequence = this.previousVod.getLiveMediaSequenceSubtitleSegments(subtitleGroupId, subtitleLang, previousVodSeqCount - 1);
          if (!this.subtitleSegments[subtitleGroupId]) {
            this.subtitleSegments[subtitleGroupId] = {};
          }
          if (!this.subtitleSegments[subtitleGroupId][subtitleLang]) {
            this.subtitleSegments[subtitleGroupId][subtitleLang] = [];
          }
          if (lastMediaSubtitleSequence && lastMediaSubtitleSequence.length > 0) {
            let start = this.sequenceAlwaysContainNewSegments ? 0 : 1;
            if (lastMediaSubtitleSequence[0] && lastMediaSubtitleSequence[0].discontinuity) {
              start = this.sequenceAlwaysContainNewSegments ? 1 : 2;
            }
            for (let idx = start; idx < lastMediaSubtitleSequence.length; idx++) {
              let q = lastMediaSubtitleSequence[idx];
              if (q.vodTransition) {
                // Remove any vod disc boarders from prev vod
                q = {
                  discontinuity: q.discontinuity,
                  daterange: q.daterange,
                }
              }
              this.subtitleSegments[subtitleGroupId][subtitleLang].push(q);
            }
          }
          this.subtitleSegments[subtitleGroupId][subtitleLang].push({
            discontinuity: true,
            daterange: this.rangeMetadata ? this.rangeMetadata : null,
            vodTransition: true
          });
        }
      }
    }
  }

  _cleanupUnused() {
    return new Promise((resolve, reject) => {
      // Remove all bandwidths that are remaining from previous VOD and has not been initiated
      let toRemove = [];
      Object.keys(this.segments).map((bw) => {
        if (!this.segmentsInitiated[bw]) {
          toRemove.push(bw);
        }
      });
      toRemove.map((bw) => {
        delete this.segments[bw];
      });
      // Compare Video Variant Lengths; If different, abort the vod load
      const segListSizes = Object.values(this.segments).map((arr) => arr.length);
      const uniqueSizes = new Set(segListSizes);
      if (uniqueSizes.size !== 1) {
        throw new Error("The VOD loading was rejected because it contains video variants with different segment counts");
      }
      resolve();
    });
  }

  _removeDoubleDiscontinuitiesFromExtraMedia(segmentList) {
    const groupIds = Object.keys(segmentList);
    for (let i = 0; i < groupIds.length; i++) {
      const groupId = groupIds[i];
      const langs = Object.keys(segmentList[groupId]);
      for (let k = 0; k < langs.length; k++) {
        const lang = langs[k];
        segmentList[groupId][lang] = segmentList[groupId][lang].filter((elem, idx, arr) => {
          if (idx > 0 && arr[idx - 1] && arr[idx]) {
            if (arr[idx - 1].discontinuity && arr[idx].discontinuity) {
              return false;
            }
          }
          return true;
        });
      }
    }
  }

  _createMediaSequences() {
    return new Promise((resolve, reject) => {
      const bw = this._getFirstBwWithSegments();
      const audioGroupId = this._getFirstAudioGroupWithSegments();
      const firstAudioLanguage = audioGroupId ? this._getFirstAudioLanguageWithSegments(audioGroupId) : null;
      const subtitleGroupId = this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID;
      const firstSubtitleLanguage = this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE;

      let video_sequence_list = []; // list of sequences
      let audio_sequence_list = []; // list of audioSequence
      let subtitle_sequence_list = []; // list of subtitleSequence

      // Remove all double discontinuities (video)
      const bandwidths = Object.keys(this.segments);
      for (let i = 0; i < bandwidths.length; i++) {
        const bwIdx = bandwidths[i];

        this.segments[bwIdx] = this.segments[bwIdx].filter((elem, idx, arr) => {
          if (idx > 0 && arr[idx - 1] && arr[idx]) {
            if (arr[idx - 1].discontinuity && arr[idx].discontinuity) {
              return false;
            }
          }
          return true;
        });
      }
      // Remove all double discontinuities (audio)
      if (audioGroupId) {
        this._removeDoubleDiscontinuitiesFromExtraMedia(this.audioSegments)
      }
      // Remove all double discontinuities (subtitle)
      if (subtitleGroupId) {
        this._removeDoubleDiscontinuitiesFromExtraMedia(this.subtitleSegments)
      }
      if (this.shouldContainSubtitles) {
        // we are doing all this to figure out the entire duration of the new vod so we can create a long subtitle segment that we can later chunk to smaller segments
        let duration = this.getDuration();
        let offset = 0;
        let tempDuration = 0;
        const bw = this.getBandwidths()[0];
        for (let index = 0; index < this.segments[bw].length; index++) {
          if (this.segments[bw][index].duration) {
            tempDuration += this.segments[bw][index].duration
          }
          if (this.segments[bw][index].vodTransition) {
            duration -= tempDuration;
            offset = index + 1;
            break;
          }
        }

        const fakeSubtileSegment = {
          duration: duration,
          timelinePosition: 0,
          cue: null,
          uri: this.dummySubtitleEndpoint,
        };


        const result = this.generateSmallerSubtitleSegments(fakeSubtileSegment, offset, 0, true, false, 0)
        this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE] = this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE].concat(result.newSegments)
      }

      if (!this.sequenceAlwaysContainNewSegments) {
        /*---------------------------------------------.
         * Generate Sequences out of segments (type-A) |
         *---------------------------------------------'
         * Each sequence may only step by 1 count, and we allow
         * for SKIPPING adding a segment if it would raise the
         * sequence duration to over the set limit.
         */

        video_sequence_list = this.generateSequencesTypeAVideo(bw);

        if (firstAudioLanguage) {
          audio_sequence_list = this.generateSequencesTypeAExtraMedia(this.audioSegments, audioGroupId, firstAudioLanguage, "audio");// segments,firstGroupId, firstLanguage, type
        }
        if (this.shouldContainSubtitles) {
          subtitle_sequence_list = this.generateSequencesTypeAExtraMedia(this.subtitleSegments, subtitleGroupId, firstSubtitleLanguage, "subtitle");
        }

        video_sequence_list.map((_, index) => {
          this.mediaSequences.push({
            segments: video_sequence_list[index],
            audioSegments: {},
            subtitleSegments: {},
          });
        });
        for (let i = 0; i < audio_sequence_list.length; i++) {
          if (i < this.mediaSequences.length) {
            this.mediaSequences[i].audioSegments = audio_sequence_list[i] ? audio_sequence_list[i] : {};
          } else {
            this.mediaSequences.push({
              segments: {},
              audioSegments: audio_sequence_list[i] ? audio_sequence_list[i] : {},
              subtitleSegments: {},
            });
          }
        }
        for (let i = 0; i < subtitle_sequence_list.length; i++) {
          if (i < this.mediaSequences.length) {
            this.mediaSequences[i].subtitleSegments = subtitle_sequence_list[i] ? subtitle_sequence_list[i] : {};
          } else {
            this.mediaSequences.push({
              segments: {},
              subtitleSegments: subtitle_sequence_list[i] ? subtitle_sequence_list[i] : {},
            });
          }
        }
        // Set Sequences Counts
        this.videoSequencesCount = video_sequence_list.length;
        this.audioSequencesCount = audio_sequence_list.length;
        this.subtitleSequencesCount = subtitle_sequence_list.length;
      } else {
        /*---------------------------------------------.
         * Generate Sequences out of segments (type-B) |
         *---------------------------------------------'
         * Each sequence may step more than 1 count if needed, also each sequence
         * must include an addition of a new segment. e.i. When adding a new segment,
         * if it would raise the sequence duration to over the set limit, then we
         * will remove yet another segment from the top of the segment list.
         */

        let videoSequences = [];
        videoSequences = this.generateSequencesTypeBVideo(bw, bandwidths);

        let audioSequences = [];
        if (audioGroupId) {
          audioSequences = this.generateSequencesTypeBExtraMedia(this.audioSegments, audioGroupId, firstAudioLanguage, "audio");
        }
        let subtitleSequences = [];
        if (this.shouldContainSubtitles) {
          subtitleSequences = this.generateSequencesTypeBExtraMedia(this.subtitleSegments, subtitleGroupId, firstSubtitleLanguage, "subtitle");

        }

        // Append newly generated video/audio/subtitle sequences
        videoSequences.map((_, index) => {
          this.mediaSequences.push({
            segments: videoSequences[index],
            audioSegments: {},
            subtitleSegments: {},
          });
        });
        for (let i = 0; i < audioSequences.length; i++) {
          if (i < this.mediaSequences.length) {
            this.mediaSequences[i].audioSegments = audioSequences[i] ? audioSequences[i] : {};
          } else {
            this.mediaSequences.push({
              segments: {},
              audioSegments: audioSequences[i] ? audioSequences[i] : {},
              subtitleSegments: {}
            });
          }
        }
        for (let i = 0; i < subtitleSequences.length; i++) {
          if (i < this.mediaSequences.length) {
            this.mediaSequences[i].subtitleSegments = subtitleSequences[i] ? subtitleSequences[i] : {};
          } else {
            this.mediaSequences.push({
              segments: {},
              audioSegments: {},
              subtitleSegments: subtitleSequences[i] ? subtitleSequences[i] : {},
            });
          }
        }

        this.videoSequencesCount = videoSequences.length;
        this.audioSequencesCount = audioSequences.length;
        this.subtitleSequencesCount = subtitleSequences.length
      }

      if (!this.mediaSequences) {
        reject("Failed to init media sequences");
      } else {
        let prevLastSegment = null;
        let discSeqNo = 0;
        this.deltaTimes.push({
          interval: 0,
          position: 0,
        });
        let lastPosition = 0;
        let lastPositionIncrement = 0;
        for (let seqNo = 0; seqNo < this.videoSequencesCount; seqNo++) {
          const mseq = this.mediaSequences[seqNo];
          if (!Object.keys(mseq.segments).length) {
            continue;
          }

          const bwIdx = Object.keys(mseq.segments)[0];
          const videoSegments = mseq.segments[bwIdx];
          if (videoSegments && videoSegments[0] && videoSegments[0].discontinuity) {
            debug(`Discontinuity in first segment of media seq ${seqNo}`);
            discSeqNo++;
            debug(`Increasing discont sequence ${discSeqNo}`);
          }
          if (this.sequenceAlwaysContainNewSegments) {
            this.discontinuities[seqNo] += discSeqNo;
            discSeqNo = 0;
          } else {
            this.discontinuities[seqNo] = discSeqNo;
          }
          if (this.sequenceAlwaysContainNewSegments) {
            if (seqNo > 0) {
              let tpi = 0; // Total Position Increment (total newly added content in seconds)
              const prevLastSegIdx = findIndexReversed(mseq.segments[bwIdx], (seg) => {
                if (seg.byteRange) {
                  if (seg.uri) {
                    return seg.uri === prevLastSegment.uri && seg.byteRange === prevLastSegment.byteRange;
                  }
                } else {
                  if (seg.uri) {
                    return seg.uri === prevLastSegment.uri;
                  }
                }
                return false;
              });
              for (let i = prevLastSegIdx + 1; i < mseq.segments[bwIdx].length; i++) {
                const seg = mseq.segments[bwIdx][i];
                if (seg && seg.duration) {
                  tpi += seg.duration;
                }
              }
              let lastSegment = mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1];
              if (lastSegment && lastSegment.discontinuity) {
                lastSegment = mseq.segments[bwIdx][mseq.segments[bwIdx].length - 2];
              }
              const positionIncrement = lastSegment.duration;
              const interval = tpi - lastPositionIncrement;
              this.deltaTimes.push({
                interval: interval,
                position: positionIncrement ? lastPosition + tpi : lastPosition,
              });
              if (positionIncrement) {
                lastPosition += tpi;
                lastPositionIncrement = positionIncrement;
              }
              if (lastSegment && lastSegment.uri) {
                prevLastSegment = lastSegment;
              }
            } else {
              if (videoSegments) {
                let lastSegment = findBottomSegItem(videoSegments);
                if (lastSegment && lastSegment.uri) {
                  prevLastSegment = lastSegment;
                }
                lastPositionIncrement = lastSegment.duration;
              }
            }
          } else {
            if (seqNo > 0) {
              const positionIncrement = mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].discontinuity
                ? mseq.segments[bwIdx][mseq.segments[bwIdx].length - 2].duration
                : mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].duration;
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
                lastPositionIncrement = mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].discontinuity
                  ? mseq.segments[bwIdx][mseq.segments[bwIdx].length - 2].duration
                  : mseq.segments[bwIdx][mseq.segments[bwIdx].length - 1].duration;
              }
            }
          }
        }
        // Audio Version
        if (this.mediaSequences[0].audioSegments) {
          this.calculateDeltaAndPositionExtraMedia("audio")
        }
        if (this.mediaSequences[0].subtitleSegments) {
          this.calculateDeltaAndPositionExtraMedia("subtitle")
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
    this.subtitleSegments = {};
    this.mediaSequences = [];
    this.targetDuration = {};
    this.targetAudioDuration = {};
    this.targetSubtitleDuration = {};
    this.usageProfile = [];
    this.segmentsInitiated = {};
    this.usageProfileMapping = null;
    this.usageProfileMappingRev = null;
    this.discontinuities = {};
    this.discontinuitiesAudio = {};
    this.mediaSequenceValues = {};
    this.mediaSequenceValuesAudio = {};
    this.mediaSequenceValuesSubtitle = {};
    this.sequenceAlwaysContainNewSegments = null;
    this.rangeMetadata = null;
    this.matchedBandwidths = {};
    this.deltaTimes = [];
    this.deltaTimesAudio = [];
    this.deltaTimesSubtitle = [];
  }

  _getFirstBwWithSegments() {
    const bandwidths = Object.keys(this.segments).filter((bw) => this.segmentsInitiated[bw]);
    if (bandwidths.length > 0) {
      return bandwidths[0];
    } else {
      console.log("ERROR: could not find any bw with segments");
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

  _getFirstSubtitleGroupWithSegments() {
    // # Looks for first subtitle group with segments by checking if any language
    // # track belonging to the group has segments.
    const subtitleGroupIds = Object.keys(this.subtitleSegments).filter((id) => {
      let idLangs = Object.keys(this.subtitleSegments[id]).filter((lang) => {
        return this.subtitleSegments[id][lang].length > 0;
      });
      return idLangs.length > 0;
    });
    if (subtitleGroupIds.length > 0) {
      return subtitleGroupIds[0];
    } else {
      return null;
    }
  }

  _getFirstSubtitleLanguageWithSegments(groupId) {
    // # Looks for first subtitle language in group with segments by checking if any language
    // # track belonging to the group has segments.
    const LangsWithSegments = Object.keys(this.subtitleSegments[groupId]).filter((lang) => {
      return this.subtitleSegments[groupId][lang].length > 0;
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
              let segmentUri;
              let baseUrl;
              let byteRange = undefined;

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
  }

  _similarSegItemDuration(playlistItems, startOffset) {
    let totalSegmentDuration = 0;
    let segmentCount = 0;
    playlistItems.map(seg => {
      if (seg.get("duration")) {
        segmentCount++;
        totalSegmentDuration += seg.get("duration");
      }
    })
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
  }

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
            const bw = this.getBandwidths()[0]
            for (let index = 0; index < this.segments[bw].length; index++) {
              if (this.segments[bw][index].vodTransition) {
                offset = index;
                break;
              }
            }
            const sameLength = this._similarSegItemDuration(m3u.items.PlaylistItem, offset);
            let remain = sameLength
              ? this.startTimeOffset
              : this.startTimeOffset + this.mediaStartExcessTime;

            while (remain > 0) {
              let removed;
              if (sameLength) {
                removed = m3u.items.PlaylistItem.shift();
              } else if (m3u.items.PlaylistItem[0] && m3u.items.PlaylistItem[0].get("duration") * 1000 < remain) {
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
  }

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
        const bw = this.getBandwidths()[0]
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
  }


  _getNearestBandwidthInList(bandwidthToMatch, array) {
    let bandwidth = bandwidthToMatch;
    const filteredBandwidths = array;
    const availableBandwidths = filteredBandwidths.sort((a, b) => a - b);

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
  }

  _getNearestBandwidth(bandwidth) {
    if (this.usageProfileMappingRev != null) {
      return this.usageProfileMappingRev[bandwidth];
    }
    const filteredBandwidths = Object.keys(this.segments).filter((bw) => this.segments[bw].length > 0);
    const availableBandwidths = filteredBandwidths.sort((a, b) => a - b);

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

    const filteredBandwidths = Object.keys(this.segments)
      .filter((bw) => this.segments[bw].length > 0)
      .filter((a) => this._hasMediaSequences(a));
    const availableBandwidths = filteredBandwidths.sort((a, b) => b - a);
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
    const filteredBandwidths = Object.keys(this.segments).filter((bw) => this.segmentsInitiated[bw]);
    const availableBandwidths = filteredBandwidths.sort((a, b) => a - b);

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
  }

  _getNearestBandwidthForSplice(splice, bandwidth) {
    const availableBandwidths = Object.keys(splice.segments);
    if (this.usageProfileMapping != null && availableBandwidths.length === Object.keys(this.usageProfileMapping).length) {
      let mapping = {};
      const sortedAvailable = availableBandwidths.sort((a, b) => a - b);
      const sortedUsageProfile = Object.keys(this.usageProfileMapping).sort((a, b) => a - b);
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
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  }

  _getAudioSegmentsLength(group) {
    try {
      const langs = Object.keys(this.audioSegments[group]);
      if (!!langs.length) {
        return this.audioSegments[group][langs[0]].length;
      }
    } catch (err) {
      console.error("Issue calculating length: ", err);
    }
  }

  _getSubtitleSegmentsLength(group) {
    try {
      const langs = Object.keys(this.subtitleSegments[group]);
      if (!!langs.length) {
        return this.subtitleSegments[group][langs[0]].length;
      }
    } catch (err) {
      console.error("Issue calculating length: ", err);
    }
  }

}

module.exports = HLSVod;
