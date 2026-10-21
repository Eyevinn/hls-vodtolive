const m3u8 = require("@eyevinn/m3u8");
const debug = require("debug")("hls-vodtolive");
const verbose = require("debug")("hls-vodtolive-verbose");
const {
  findIndexReversed,
  fetchWithRetry,
  urlResolve,
  segToM3u8,
  findBottomSegItem,
  fixedNumber,
  inspectForVodTransition,
  playlistItemWithInterstitialsMetadata,
  appendHlsInterstitialLineWithCUE,
} = require("./utils.js");

class HLSVod {
  /**
   * Create an HLS VOD instance
   * @param {string} vodManifestUri - the uri to the master manifest of the VOD
   * @param {Object} splices - an array of ad splice objects
   * @param {number} timeOffset - time offset as unix timestamp ms
   * @param {number} startTimeOffset - start time offset in N ms from start
   * @param {string} header - prepend the m3u8 playlist with this text
   * @param {Object} opts - other options
   * @param {Array} opts.expectedAudioLanguages - explicit list of audio language codes that must always
   *   be present in the generated live output, regardless of what any individual VOD contains. When a
   *   loaded VOD is missing one of these languages, the default (first available) language's audio
   *   segments are injected for it. When omitted, the set of audio languages is determined by the first
   *   VOD loaded and is then persisted across all following VODs (it is never shrunk when a later VOD
   *   exposes fewer languages).
   * @param {Array} opts.expectedAudioCodecs - explicit list of audio codecs (e.g. ["mp4a.40.2", "ec-3"])
   *   that the generated live output must contain exactly. Audio groups whose codec is not in this list
   *   are dropped, and when a loaded VOD is missing one of the listed codecs the default (first available)
   *   codec's audio segments are reused for that codec's track so it keeps playing. When omitted, the set
   *   of audio codecs is determined by the first VOD loaded and is then persisted across all following
   *   VODs (it is never shrunk when a later VOD exposes fewer codecs).
   */
  constructor(vodManifestUri, splices, timeOffset, startTimeOffset, header, opts) {
    this.masterManifestUri = vodManifestUri;
    this.segments = {};
    this.audioSegments = {};
    this.subtitleSegments = {};
    this.mediaSequences = [];
    this.SEQUENCE_DURATION = process.env.SEQUENCE_DURATION ? process.env.SEQUENCE_DURATION : 60;
    this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID = "dummyDefaultSubtitleGroupId";
    this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE = "dummyDefaultSubtitleLanguage";
    this.DEFAULT_SUBTITLE_GROUP_ID = "subtitles";
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
    this.skipSerializeMediaSequences = false;
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
    if (opts && opts.expectedAudioLanguages) {
      this.expectedAudioLanguages = opts.expectedAudioLanguages;
    }
    if (opts && opts.expectedAudioCodecs) {
      this.expectedAudioCodecs = opts.expectedAudioCodecs;
    }
    if (opts && opts.alwaysMapBandwidthByNearest) {
      this.alwaysMapBandwidthByNearest = opts.alwaysMapBandwidthByNearest;
    }
    if (opts && opts.skipSerializeMediaSequences) {
      this.skipSerializeMediaSequences = opts.skipSerializeMediaSequences;
    }
    if (opts && opts.calculatePDT) {
      this.calculatePDT = opts.calculatePDT
    }
    this.videoSequencesCount = 0;
    this.audioSequencesCount = 0;
    this.defaultAudioGroupAndLang = null;
    this.subtitleSequencesCount = 0;
    this.mediaStartExcessTime = 0;
    this.audioCodecsMap = {};
    this.cuedHlsInterstitialTag = null;
    // # Tracks which audio languages the currently loading VOD actually provides,
    // # per audio group. Used to decide which persisted/expected languages are
    // # missing from this VOD and must fall back to the default language's segments.
    this._audioLanguagesInCurrentVod = {};
    // # Tracks which audio groups the currently loading VOD actually provides. A group
    // # carried over from a previous VOD (i.e. belonging to a codec this VOD no longer
    // # exposes) that is not in this list is "missing" from the current VOD and must fall
    // # back to a default group's segments so the codec is not lost across the transition.
    this._audioGroupsInCurrentVod = [];
    // # Pass-through model for HLS tags/attributes the library does not natively interpret.
    // # This is the FOUNDATION scaffolding defined in issue #146: the shape exists and is
    // # stable and round-trips through toJSON/fromJSON, but nothing populates it yet.
    // # Parse-time capture from @eyevinn/m3u8 is #147, output re-emission in segToM3u8 is
    // # #148, and master-level wiring is #149. See the "Pass-through model for unknown HLS
    // # tags/attributes" section in API.md for the full contract.
    // #
    // # Master-playlist-level pass-through container. `tags` holds raw, uninterpreted
    // # master-level tag lines in source order; `streams` is keyed by bandwidth (string)
    // # and `media` by `${type}-${groupId}-${language}`, each entry carrying an
    // # `unknownAttributes` map of attribute-name -> raw (uninterpreted, string) value.
    this.unknownMasterData = HLSVod.emptyUnknownMasterData();
  }

  /**
   * @typedef {Object} UnknownSegmentData
   * @description Per-segment pass-through bag for HLS data the library does not natively
   *   interpret. Every segment object (video, audio and subtitle) carries these two fields so
   *   the shape is stable whether or not anything was captured.
   * @property {string[]} unknownTags - Ordered list of complete, raw tag lines (e.g.
   *   `"#EXT-X-CUSTOM-MARKER:foo=bar"`) that appeared immediately before this segment's URI in
   *   the media playlist and that the library does not natively interpret. Source order is
   *   preserved; on re-emission (#148) they are written verbatim, in array order, immediately
   *   before the segment's own recognized tags/URI.
   * @property {Object.<string,string>} unknownAttributes - Map of attribute-name to its raw,
   *   uninterpreted string value for attributes that live on a tag the library DOES recognize
   *   structurally but whose specific attribute it does not read (e.g. a vendor attribute on
   *   `#EXTINF` or `#EXT-X-KEY`). Values are stored verbatim and never parsed.
   */

  /**
   * @typedef {Object} UnknownMasterEntry
   * @description Pass-through bag for a single master-playlist entry (a `#EXT-X-STREAM-INF`
   *   stream or a `#EXT-X-MEDIA` rendition).
   * @property {Object.<string,string>} unknownAttributes - Map of attribute-name to its raw,
   *   uninterpreted string value for attributes on that entry the library does not read.
   */

  /**
   * @typedef {Object} UnknownMasterData
   * @description Master-playlist-level pass-through container held on the VOD instance and
   *   serialized with it.
   * @property {string[]} tags - Raw, uninterpreted master-level tag lines, in source order.
   * @property {Object.<string,UnknownMasterEntry>} streams - Stream entries keyed by bandwidth
   *   (string), each mirroring a `#EXT-X-STREAM-INF`.
   * @property {Object.<string,UnknownMasterEntry>} media - Media/rendition entries keyed by
   *   `${type}-${groupId}-${language}`, each mirroring a `#EXT-X-MEDIA`.
   */

  /**
   * The default, empty pass-through container for master-level data. Used to initialise the
   * field and to backfill it when deserializing a blob produced before the model existed.
   * @returns {UnknownMasterData} an empty master-level pass-through container
   */
  static emptyUnknownMasterData() {
    return { tags: [], streams: {}, media: {} };
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
        let defaultAudioTargetLoaded = false;
        let baseUrl;
        const m = this.masterManifestUri.match("^(.*)/.*?$");
        if (m) {
          baseUrl = m[1] + "/";
        }
        const HAS_AUDIO_DEFAULTS = this.defaultAudioGroupAndLang === null ? false : true;
        if (!this.alwaysMapBandwidthByNearest && this.previousVod && this.previousVod.getBandwidths().length === m3u.items.StreamItem.length) {
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
                return itemLang;
              });

              // # Remember which languages this VOD actually provides for this group. Any
              // # persisted/expected language not in this list is "missing" from the current
              // # VOD and will later fall back to the default language's segments.
              this._audioLanguagesInCurrentVod[audioGroupId] = audioLanguages.slice();

              // # Remember that the current VOD actually provides this audio group (and hence the
              // # codec it maps to). Any group only present because it was carried over from a
              // # previous VOD is "missing" here and is filled from a default group later in
              // # _persistMissingAudioCodecs().
              if (!this._audioGroupsInCurrentVod.includes(audioGroupId)) {
                this._audioGroupsInCurrentVod.push(audioGroupId);
              }

              // # When an explicit list of expected audio languages is configured, make sure a
              // # track exists for every one of them (even if the first VOD does not contain it),
              // # so the language is always generated and always present in the live output.
              if (!HAS_AUDIO_DEFAULTS && this.expectedAudioLanguages && this.expectedAudioLanguages.length > 0) {
                for (let i = 0; i < this.expectedAudioLanguages.length; i++) {
                  const expectedLang = this.expectedAudioLanguages[i];
                  if (!this.audioSegments[audioGroupId][expectedLang]) {
                    this.audioSegments[audioGroupId][expectedLang] = [];
                  }
                }
              }

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

              // # Need to clean up langs. that neither the current VOD nor the persisted/expected
              // # set contains. Languages carried over from a previous VOD (previousVODLanguages)
              // # and any explicitly expected languages must NEVER be dropped here - otherwise the
              // # live output would permanently lose languages once a VOD with fewer languages is
              // # loaded. Missing persisted/expected languages are filled from the default language
              // # later in _persistMissingAudioLanguages().
              if (!HAS_AUDIO_DEFAULTS) {
                const keepLanguages = new Set([...audioLanguages, ...previousVODLanguages]);
                if (this.expectedAudioLanguages) {
                  this.expectedAudioLanguages.forEach((lang) => keepLanguages.add(lang));
                }
                let allLangs = Object.keys(this.audioSegments[audioGroupId]);
                let toRemove = [];
                allLangs.map((junkLang) => {
                  if (!keepLanguages.has(junkLang)) {
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
                      // When multiple source languages map to the same default target,
                      // only load the first one to avoid doubling audio segments.
                      if (defaultAudioTargetLoaded) {
                        debug(`Audio manifest for default target [${targetGroup}][${targetLang}] already loaded, skipping "${audioLang}"`);
                        continue;
                      }
                      defaultAudioTargetLoaded = true;
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
                if (!this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID]) {
                  this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID] = {};
                }
                if (!this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE]) {
                  this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE] = [];
                }
              }

              if (!this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID]) {
                this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID] = {};
              }
              for (let i = 0; i < this.expectedSubtitleTracks.length; i++) {
                const element = this.expectedSubtitleTracks[i];
                if (!this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][element.language]) {
                  this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][element.language] = [];
                }
              }
              if (streamItem.get("subtitles")) {
                if (!subtitleGroups[this.DEFAULT_SUBTITLE_GROUP_ID]) {
                  subtitleGroups[this.DEFAULT_SUBTITLE_GROUP_ID] = {};
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
                      return element.language;
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
          .then(this._persistMissingAudioLanguages.bind(this))
          .then(this._persistMissingAudioCodecs.bind(this))
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
   * @param {function} _injectMasterManifest - optional master manifest injection function
   * @param {function} _injectMediaManifest - optional media manifest injection function
   * @param {function} _injectAudioManifest - optional audio manifest injection function
   * @param {function} _injectSubtitleManifest - optional subtitle manifest injection function
   */
  loadAfter(previousVod, _injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest) {
    debug(`Initializing Load VOD After VOD...`);
    return new Promise((resolve, reject) => {
      this.previousVod = previousVod;

      if (this.calculatePDT) {
        const previousDuration = previousVod.getNextVodDuration(); 
        if (previousVod.timeOffset) {
          console.log("time offset in previous vod")
            this.timeOffset = previousVod.timeOffset + (previousDuration * 1000);
            debug(`Calculated PDT for chained VOD: ${this.timeOffset}`);
        } else {
          console.log("No time offset in previous vod")
          this.timeOffset = Date.now();
          debug(`Previous VOD has no timeOffset, using current time for PDT: ${this.timeOffset}`);
        }
      }
      
      try {
        this._loadPrevious();
        this.load(_injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest)
          .then(() => {
            this.releasePreviousVod();
            resolve();
          })
          .catch((err) => {
            this.releasePreviousVod();
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
        // First handle case where we reload segments with Program Date time positions.
        let newTimeOffset = this._getLastTimelinePositionVideo(additionalSegments);
        let newTimeOffsetAudio = this._getLastTimelinePositionAudio(additionalAudioSegments);
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

        if (!this._isEmpty(this.audioSegments) && additionalAudioSegments) {
          const groupIds = this.getAudioGroups();
          const lang = this.getAudioLangsForAudioGroup(groupIds[0])[0];

          if (mediaSeqNo > 0) {
            let targetUri = "";
            let size = this.mediaSequences[mediaSeqNo].audioSegments[groupIds[0]][lang].length;
            for (let idx = size - 1; idx >= 0; idx--) {
              const segItem = this.mediaSequences[mediaSeqNo].audioSegments[groupIds[0]][lang][idx];
              if (segItem.uri) {
                targetUri = segItem.uri;
                break;
              }
            }
            let targetPos = 0;
            for (let i = mediaSeqNo; i < this.audioSegments[groupIds[0]][lang].length; i++) {
              if (this.audioSegments[groupIds[0]][lang][i].uri === targetUri) {
                targetPos = i;
                break;
              }
            }
            for (let i = 0; i < groupIds.length; i++) {
              const groupId = groupIds[i];
              const langs = this.getAudioLangsForAudioGroup(groupId);
              for (let j = 0; j < langs.length; j++) {
                const lang = langs[j];
                this.audioSegments[groupId][lang] = this.audioSegments[groupId][lang].slice(targetPos);
              }
            }
          }
        }

        // Find nearest BW in SFL and prepend them to the corresponding segments bandwidth
        allBandwidths.forEach((bw) => {
          if (newTimeOffset > 0) {
            let totalTimelinePos = 0;
            for (let i = 0; i < this.segments[bw].length; i++) {
              const segment = this.segments[bw][i];
              if (segment.duration) {
                totalTimelinePos += segment.duration * 1000;
                this.segments[bw][i].timelinePosition = newTimeOffset + totalTimelinePos;
              }
            }
          }
          let nearestBw = this._getNearestBandwidthInList(bw, Object.keys(additionalSegments));
          this.segments[bw] = additionalSegments[nearestBw].concat(this.segments[bw]);
        });

        if (!this._isEmpty(this.audioSegments) && additionalAudioSegments) {
          const groupIdsInVod = this.getAudioGroups();
          const groupIdsInSegments = Object.keys(additionalAudioSegments);

          for (let i = 0; i < groupIdsInSegments.length; i++) {
            let groupIdForVod = groupIdsInSegments[i];
            let indexOfGroupId = groupIdsInVod.indexOf(groupIdsInSegments[i]);
            if (indexOfGroupId < 0) {
              groupIdForVod = groupIdsInVod[0];
            } else {
              groupIdForVod = groupIdsInVod[indexOfGroupId];
            }

            const langsInVod = this.getAudioLangsForAudioGroup(groupIdForVod);
            const langsInSegment = Object.keys(additionalAudioSegments[groupIdsInSegments[i]]);

            for (let j = 0; j < langsInSegment.length; j++) {
              let langForVod = langsInSegment[j];
              let indexOfLang = langsInVod.indexOf(langsInSegment[j]);
              if (indexOfLang < 0) {
                langForVod = langsInVod[0];
              } else {
                langForVod = langsInVod[indexOfLang];
              }
              if (newTimeOffsetAudio > 0) {
                let totalTimelinePos = 0;
                for (let i = 0; i < this.audioSegments[groupIdForVod][langForVod].length; i++) {
                  const segment = this.audioSegments[groupIdForVod][langForVod][i];
                  if (segment.duration) {
                    totalTimelinePos += segment.duration * 1000;
                    this.audioSegments[groupIdForVod][langForVod][i].timelinePosition = newTimeOffsetAudio + totalTimelinePos;
                  }
                }
              }
              this.audioSegments[groupIdForVod][langForVod] = additionalAudioSegments[groupIdsInSegments[i]][langsInSegment[j]].concat(
                this.audioSegments[groupIdForVod][langForVod]
              );
            }
          }
        }
      } else {
        // First handle case where we reload segments with Program Date time positions.
        let newTimeOffset = this._getLastTimelinePositionVideo(this.segments);
        let newTimeOffsetAudio = this._getLastTimelinePositionAudio(this.audioSegments);
        // Slice Video segments
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
        // Slice Audio segments
        if (!this._isEmpty(this.audioSegments) && additionalAudioSegments) {
          const groupIds = this.getAudioGroups();
          const lang = this.getAudioLangsForAudioGroup(groupIds[0])[0];
          if (mediaSeqNo >= 0) {
            let size = this.mediaSequences[mediaSeqNo].audioSegments[groupIds[0]][lang].length;
            let targetUri = this.mediaSequences[mediaSeqNo].audioSegments[groupIds[0]][lang][0].uri;
            let targetPos = 0;
            for (let i = mediaSeqNo; i < this.audioSegments[groupIds[0]][lang].length; i++) {
              if (this.audioSegments[groupIds[0]][lang][i].uri === targetUri) {
                targetPos = i;
                break;
              }
            }
            for (let i = 0; i < groupIds.length; i++) {
              const groupId = groupIds[i];
              const langs = this.getAudioLangsForAudioGroup(groupId);
              for (let j = 0; j < langs.length; j++) {
                const lang = langs[j];
                this.audioSegments[groupId][lang] = this.audioSegments[groupId][lang].slice(targetPos, targetPos + size);
              }
            }
          }
        }
        // Update Program Date Time positions in the additional segments video
        if (newTimeOffset > 0) {
          const allAdditionalSegmentsBandwidths = Object.keys(additionalSegments);
          allAdditionalSegmentsBandwidths.forEach((bw) => {
            let totalTimelinePos = 0;
            for (let i = 0; i < additionalSegments[bw].length; i++) {
              const segment = additionalSegments[bw][i];
              if (segment.duration) {
                totalTimelinePos += segment.duration * 1000;
                additionalSegments[bw][i].timelinePosition = newTimeOffset + totalTimelinePos;
              }
            }
          });          
        }

        allBandwidths.forEach((bw) => {
          let nearestBw = this._getNearestBandwidthInList(bw, Object.keys(additionalSegments));
          this.segments[bw] = this.segments[bw].concat(additionalSegments[nearestBw]);
        });

        if (!this._isEmpty(this.audioSegments) && additionalAudioSegments) {
          const groupIdsInVod = this.getAudioGroups();
          const groupIdsInSegments = Object.keys(additionalAudioSegments);

          for (let i = 0; i < groupIdsInSegments.length; i++) {
            let groupIdForVod = groupIdsInSegments[i];
            let indexOfGroupId = groupIdsInVod.indexOf(groupIdsInSegments[i]);
            if (indexOfGroupId < 0) {
              groupIdForVod = groupIdsInVod[0];
            } else {
              groupIdForVod = groupIdsInVod[indexOfGroupId];
            }

            const langsInVod = this.getAudioLangsForAudioGroup(groupIdForVod);
            const langsInSegment = Object.keys(additionalAudioSegments[groupIdsInSegments[i]]);

            for (let j = 0; j < langsInSegment.length; j++) {
              let langForVod = langsInSegment[j];
              let indexOfLang = langsInVod.indexOf(langsInSegment[j]);
              if (indexOfLang < 0) {
                langForVod = langsInVod[0];
              } else {
                langForVod = langsInVod[indexOfLang];
              }
              if (newTimeOffsetAudio > 0) {
                let totalTimelinePos = 0;
                for (let x = 0; x < additionalAudioSegments[groupIdsInSegments[i]][langsInSegment[j]].length; x++) {
                  const segment = additionalAudioSegments[groupIdsInSegments[i]][langsInSegment[j]][x];
                  if (segment.duration) {
                    totalTimelinePos += segment.duration * 1000;
                    additionalAudioSegments[groupIdsInSegments[i]][langsInSegment[j]][x].timelinePosition =
                      newTimeOffsetAudio + totalTimelinePos;
                  }
                }
              }
              this.audioSegments[groupIdForVod][langForVod] = this.audioSegments[groupIdForVod][langForVod].concat(
                additionalAudioSegments[groupIdsInSegments[i]][langsInSegment[j]]
              );
            }
          }
        }
      }

      // Clean up/Reset HLSVod data since we are going to create new data
      this.mediaSequences = [];
      this.audioSequences = [];
      this.mediaSequenceValues = {};
      this.mediaSequenceValuesAudio = {};
      this.discontinuities = {};
      this.discontinuitiesAudio = {};
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
   * Get all audio segments (duration, uri) for a specific media sequence
   *
   * @param {number} seqIdx - media sequence index (first is 0)
   */
  getLiveAudioSequenceSegments(seqIdx) {
    return this.mediaSequences[seqIdx].audioSegments;
  }

  /**
   * Get all segments (duration, uri)
   *
   */
  getMediaSegments() {
    return this.segments;
  }

  getAudioSegments() {
    return this.audioSegments;
  }

  /**
   * Get all audio segments (duration, uri) for a specific media sequence based on audio group and lang
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
        subtitleGroupId = this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID;
      }

      if (!this.mediaSequences[seqIdx].subtitleSegments[subtitleGroupId][subtitleLanguage]) {
        const fallbackLang = this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE;
        subtitleGroupId = this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID;
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
    Object.keys(this.audioCodecsMap[audioCodecs]).map((channelsKey) => {
      if (channelsKey === channels) {
        audioGroupId = this.audioCodecsMap[audioCodecs][channelsKey];
      }
    });
    return audioGroupId;
  }

  getAudioCodecsAndChannelsForGroupId(groupId) {
    let audioCodecs;
    let channels;
    Object.keys(this.audioCodecsMap).map((codecKey) => {
      Object.keys(this.audioCodecsMap[codecKey]).map((channelsKey) => {
        if (this.audioCodecsMap[codecKey][channelsKey] === groupId) {
          audioCodecs = codecKey;
          channels = channelsKey;
        }
      });
    });
    return [audioCodecs, channels];
  }

  getSubtitleGroups(all = false) {
    return Object.keys(this.subtitleSegments).filter((groupId) => groupId !== this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID || all);
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
        m3u8 += segToM3u8(
          v,
          i,
          this.mediaSequences[seqIdx].segments[bw].length,
          this.mediaSequences[seqIdx].segments[bw][i + 1],
          previousSegment
        );
        previousSegment = v;
      }
    }
    // FOR LIVE AND CUED HLS-INTERSTITIAL TAGS, Place them at the bottom of each window
    if (this.cuedHlsInterstitialTag) {
      m3u8 = appendHlsInterstitialLineWithCUE(m3u8, this.cuedHlsInterstitialTag);
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
        m3u8 += segToM3u8(v, i, mediaSeqAudioSegments.length, mediaSeqAudioSegments[i + 1], previousSegment);
        previousSegment = v;
      }
    }
    // FOR LIVE AND CUED HLS-INTERSTITIAL TAGS, Place them at the bottom of each window
    if (this.cuedHlsInterstitialTag) {
      m3u8 = appendHlsInterstitialLineWithCUE(m3u8, this.cuedHlsInterstitialTag);
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
        m3u8 += segToM3u8(v, i, mediaSeqSubtitleSegments.length, mediaSeqSubtitleSegments[i + 1], previousSegment);
        previousSegment = v;
      }
    }
    // FOR LIVE AND CUED HLS-INTERSTITIAL TAGS, Place them at the bottom of each window
    if (this.cuedHlsInterstitialTag) {
      m3u8 = appendHlsInterstitialLineWithCUE(m3u8, this.cuedHlsInterstitialTag);
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
   * Returns the current duration calculated from the sum of the duration of all segments
   * belonging to the next VOD, excludeing the copied segments from previous VOD, if any.
   */
  getNextVodDuration() {
    if (!this.segments) {
      return null;
    }
    const bw = Object.keys(this.segments)[0];
    if (!bw) {
      return null;
    }

    const segments = Array.isArray(this.segments[bw]) ? this.segments[bw] : [];
    const sumDuration = (list) =>
      list.reduce((acc, s) => acc + (typeof s?.duration === "number" ? s.duration : 0), 0);

    const vodTransitionIndex = segments.findIndex((segment) => !!segment?.vodTransition);
    if (vodTransitionIndex >= 0) {
      const segmentsAfterTransition = segments.slice(vodTransitionIndex);
      return sumDuration(segmentsAfterTransition);
    }
    
    return sumDuration(segments);
  }

  /**
   * Returns the last added Discontinuity sequence count from getLiveMediaSequences()
   */
  getLastUsedDiscSeq() {
    return this.lastUsedDiscSeq;
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
          };
        }
        this.segments[destBw].push(q);
      }
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
    // # Persist the codec -> audioGroupId mapping from the previous VOD so that codecs a later
    // # VOD no longer carries are not lost from the live output. The current VOD's own codecs are
    // # (re)added as its master manifest is parsed in load(); existing entries are never overwritten.
    const previousCodecsMap = this.previousVod.audioCodecsMap || {};
    Object.keys(previousCodecsMap).forEach((codec) => {
      if (!this.audioCodecsMap[codec]) {
        this.audioCodecsMap[codec] = {};
      }
      Object.keys(previousCodecsMap[codec]).forEach((channels) => {
        if (!this.audioCodecsMap[codec][channels]) {
          this.audioCodecsMap[codec][channels] = previousCodecsMap[codec][channels];
        }
      });
    });
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
                };
              }
              this.audioSegments[audioGroupId][audioLang].push(q);
            }
          }
          this.audioSegments[audioGroupId][audioLang].push({
            discontinuity: true,
            daterange: this.rangeMetadata ? this.rangeMetadata : null,
            vodTransition: true,
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
                };
              }
              this.subtitleSegments[subtitleGroupId][subtitleLang].push(q);
            }
          }
          this.subtitleSegments[subtitleGroupId][subtitleLang].push({
            discontinuity: true,
            daterange: this.rangeMetadata ? this.rangeMetadata : null,
            vodTransition: true,
          });
        }
      }
    }
  }

  /**
   * Ensures every persisted/expected audio language is present after all audio manifests
   * have loaded. For any expected language that the currently loaded VOD does not actually
   * provide, the default (first available) language's segments are copied in so the language
   * keeps playing instead of being dropped. The explicit `opts.expectedAudioLanguages` list
   * and the languages carried over from previous VODs both feed into this persisted set.
   */
  _persistMissingAudioLanguages() {
    return new Promise((resolve) => {
      // # The HAS_AUDIO_DEFAULTS path collapses every incoming language onto a single default
      // # target (see the audio load loop); leave it untouched here.
      if (this.defaultAudioGroupAndLang) {
        resolve();
        return;
      }
      const audioGroupIds = Object.keys(this.audioSegments);
      for (let g = 0; g < audioGroupIds.length; g++) {
        const groupId = audioGroupIds[g];
        const currentLangs = this._audioLanguagesInCurrentVod[groupId] || [];
        // # Pick a default language that the current VOD actually provides (and has segments),
        // # so missing languages fall back to freshly loaded audio rather than stale segments.
        let defaultLang = currentLangs.find(
          (lang) => this.audioSegments[groupId][lang] && this.audioSegments[groupId][lang].length > 0
        );
        if (!defaultLang) {
          defaultLang = this._getFirstAudioLanguageWithSegments(groupId);
        }
        if (!defaultLang) {
          continue;
        }
        const allLangs = Object.keys(this.audioSegments[groupId]);
        for (let i = 0; i < allLangs.length; i++) {
          const lang = allLangs[i];
          if (lang === defaultLang) {
            continue;
          }
          // # A language that the current VOD does not provide is a persisted/expected one that
          // # is missing here - fall back to a copy of the default language's segments.
          if (!currentLangs.includes(lang)) {
            this.audioSegments[groupId][lang] = this.audioSegments[groupId][defaultLang].map((seg) => ({ ...seg }));
          }
        }
      }
      resolve();
    });
  }

  /**
   * Ensures every persisted/expected audio codec is present after all audio manifests have loaded.
   * Audio codecs map to distinct audio groups, so persistence is handled at the group level here:
   * for any audio group that the currently loaded VOD does not actually provide (i.e. a group that
   * only exists because it was carried over from a previous VOD, belonging to a codec this VOD is
   * missing), the segments of a default group that the current VOD DID provide are reused so the
   * codec keeps playing instead of starving the whole audio track. When `opts.expectedAudioCodecs`
   * is configured, the live output is additionally restricted to exactly those codecs: any audio
   * group whose codec is not in the list (and its codec -> group mapping) is dropped.
   */
  _persistMissingAudioCodecs() {
    return new Promise((resolve) => {
      // # The HAS_AUDIO_DEFAULTS path collapses every incoming group onto a single default target
      // # (see the audio load loop); leave it untouched here.
      if (this.defaultAudioGroupAndLang) {
        resolve();
        return;
      }

      // # When an explicit codec list is configured the output must contain EXACTLY those codecs:
      // # drop any audio group whose codec is not in the list, and prune the codec -> group map.
      if (this.expectedAudioCodecs && this.expectedAudioCodecs.length > 0) {
        Object.keys(this.audioSegments).forEach((groupId) => {
          const [codec] = this.getAudioCodecsAndChannelsForGroupId(groupId);
          if (codec && !this.expectedAudioCodecs.includes(codec)) {
            delete this.audioSegments[groupId];
          }
        });
        Object.keys(this.audioCodecsMap).forEach((codec) => {
          if (!this.expectedAudioCodecs.includes(codec)) {
            delete this.audioCodecsMap[codec];
          }
        });
      }

      // # Pick a default source group that the current VOD actually provides (and that has
      // # segments), so missing-codec groups fall back to freshly loaded audio rather than the
      // # short, stale segment list carried over from the previous VOD.
      let defaultGroupId = this._audioGroupsInCurrentVod.find(
        (groupId) => this.audioSegments[groupId] && this._getFirstAudioLanguageWithSegments(groupId)
      );
      if (!defaultGroupId) {
        defaultGroupId = this._getFirstAudioGroupWithSegments();
      }
      if (!defaultGroupId) {
        resolve();
        return;
      }
      const defaultLang = this._getFirstAudioLanguageWithSegments(defaultGroupId);
      const defaultSegments = this.audioSegments[defaultGroupId][defaultLang];

      const groupIds = Object.keys(this.audioSegments);
      for (let g = 0; g < groupIds.length; g++) {
        const groupId = groupIds[g];
        // # A group the current VOD did not provide belongs to a codec that is missing from this
        // # VOD - reuse the default group's segments for each of its languages so the codec track
        // # stays the same length as the rest of the audio instead of being dropped.
        if (!this._audioGroupsInCurrentVod.includes(groupId)) {
          const langs = Object.keys(this.audioSegments[groupId]);
          for (let i = 0; i < langs.length; i++) {
            this.audioSegments[groupId][langs[i]] = defaultSegments.map((seg) => ({ ...seg }));
          }
        }
      }
      resolve();
    });
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

  _getLastTimelinePositionVideo(ObjectOfSegments) {
    let newTimeOffset = 0;
    if (!this._isEmpty(ObjectOfSegments)) {
      // For Video
      if (ObjectOfSegments[Object.keys(ObjectOfSegments)[0]].length > 0) {
        for (let i = ObjectOfSegments[Object.keys(ObjectOfSegments)[0]].length - 1; i >= 0; i--) {
          if (ObjectOfSegments[Object.keys(ObjectOfSegments)[0]][i].uri && !ObjectOfSegments[Object.keys(ObjectOfSegments)[0]][i].timelinePosition) {
            break;
          }
          if (ObjectOfSegments[Object.keys(ObjectOfSegments)[0]][i].timelinePosition) {
            newTimeOffset = ObjectOfSegments[Object.keys(ObjectOfSegments)[0]][i].timelinePosition;
            break;
          }
        }
      }
    }
    return newTimeOffset;
  }

  _getLastTimelinePositionAudio(ObjectOfSegments) {
    let newTimeOffsetAudio = 0;
    if (!this._isEmpty(ObjectOfSegments)) {
      // For Audio
      const groupIdsInSegments = Object.keys(ObjectOfSegments);
      const langsInSegment = Object.keys(ObjectOfSegments[groupIdsInSegments[0]]);
      if (!this._isEmpty(langsInSegment) && ObjectOfSegments[groupIdsInSegments[0]][langsInSegment[0]].length > 0) {
        for (let i = ObjectOfSegments[groupIdsInSegments[0]][langsInSegment[0]].length - 1; i >= 0; i--) {
          if (ObjectOfSegments[groupIdsInSegments[0]][langsInSegment[0]][i].uri && !ObjectOfSegments[groupIdsInSegments[0]][langsInSegment[0]][i].timelinePosition) {
            break;
          }
          if (ObjectOfSegments[groupIdsInSegments[0]][langsInSegment[0]][i].timelinePosition) {
            newTimeOffsetAudio = ObjectOfSegments[groupIdsInSegments[0]][langsInSegment[0]][i].timelinePosition;
            break;
          }
        }
      }
    }
    return newTimeOffsetAudio;
  }
}

// Compose cohesive method groups (split out of this file) onto the prototype.
// Behavior and `this`-semantics are identical to defining them inline.
Object.assign(HLSVod.prototype, require("./lib/sequence-generation.js"));
Object.assign(HLSVod.prototype, require("./lib/manifest-loading.js"));
Object.assign(HLSVod.prototype, require("./lib/bandwidth-helpers.js"));
Object.assign(HLSVod.prototype, require("./lib/serialization.js"));

module.exports = HLSVod;
