const debug = require("debug")("hls-vodtolive");
const {
  findIndexReversed,
  findBottomSegItem,
  inspectForVodTransition,
} = require("../utils.js");

import type { HLSVodInstance } from "./types";

const methods: Record<string, (...args: any[]) => any> & ThisType<HLSVodInstance> = {
  toJSON() {
    const serialized = {
      masterManifestUri: this.masterManifestUri,
      segments: this.segments,
      audioSegments: this.audioSegments,
      subtitleSegments: this.subtitleSegments,
      shouldContainSubtitles: this.shouldContainSubtitles,
      expectedSubtitleTracks: this.expectedSubtitleTracks,
      expectedAudioLanguages: this.expectedAudioLanguages,
      expectedAudioCodecs: this.expectedAudioCodecs,
      mediaSequences: this.skipSerializeMediaSequences ? null : this.mediaSequences,
      SEQUENCE_DURATION: this.SEQUENCE_DURATION,
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
      videoSequencesCount: this.skipSerializeMediaSequences ? 0 : this.videoSequencesCount,
      audioSequencesCount: this.skipSerializeMediaSequences ? 0 : this.audioSequencesCount,
      subtitleSequencesCount: this.skipSerializeMediaSequences ? 0 : this.subtitleSequencesCount,
      mediaStartExcessTime: this.mediaStartExcessTime,
      audioCodecsMap: this.audioCodecsMap,
      alwaysMapBandwidthByNearest: this.alwaysMapBandwidthByNearest,
      skipSerializeMediaSequences: this.skipSerializeMediaSequences,
      cuedHlsInterstitialTag: this.cuedHlsInterstitialTag,
      calculatePDT: this.calculatePDT,
      unknownMasterData: this.unknownMasterData
    };
    return JSON.stringify(serialized);
  },

  fromJSON(serialized) {
    const de = JSON.parse(serialized);
    this.masterManifestUri = de.masterManifestUri;
    this.segments = de.segments;
    this.audioSegments = de.audioSegments;
    this.subtitleSegments = de.subtitleSegments;
    this.shouldContainSubtitles = de.shouldContainSubtitles;
    this.expectedSubtitleTracks = de.expectedSubtitleTracks;
    this.expectedAudioLanguages = de.expectedAudioLanguages;
    this.expectedAudioCodecs = de.expectedAudioCodecs;
    this.mediaSequences = de.mediaSequences;
    this.SEQUENCE_DURATION = de.SEQUENCE_DURATION;
    this.targetDuration = de.targetDuration;
    this.targetAudioDuration = de.targetAudioDuration;
    this.targetSubtitleDuration = de.targetSubtitleDuration;
    const prevVod: any = new (this as any).constructor();
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
    this.subtitleSequencesCount = de.subtitleSequencesCount;
    this.mediaStartExcessTime = de.mediaStartExcessTime;
    this.audioCodecsMap = de.audioCodecsMap;
    this.alwaysMapBandwidthByNearest = de.alwaysMapBandwidthByNearest;
    this.skipSerializeMediaSequences = de.skipSerializeMediaSequences;
    this.cuedHlsInterstitialTag = de.cuedHlsInterstitialTag;
    this.calculatePDT = de.calculatePDT;
    // Backfill the pass-through container when deserializing a blob serialized before the
    // model existed (#146), so the shape is always present and stable after fromJSON.
    this.unknownMasterData = de.unknownMasterData || (this.constructor as any).emptyUnknownMasterData();
  },
  _createMediaSequences(mode = false) {
    return new Promise<void>((resolve, reject) => {
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
        this._removeDoubleDiscontinuitiesFromExtraMedia(this.audioSegments);
      }
      // Remove all double discontinuities (subtitle)
      if (subtitleGroupId) {
        this._removeDoubleDiscontinuitiesFromExtraMedia(this.subtitleSegments);
      }
      if (this.shouldContainSubtitles && !mode) {
        // we are doing all this to figure out the entire duration of the new vod so we can create a long subtitle segment that we can later chunk to smaller segments
        let duration = this.getDuration();
        let offset = 0;
        let tempDuration = 0;
        const bw = this.getBandwidths()[0];
        for (let index = 0; index < this.segments[bw].length; index++) {
          if (this.segments[bw][index].duration) {
            tempDuration += this.segments[bw][index].duration;
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
        this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE] = this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE].concat(result.newSegments);
        // If the expected tracks are set and are not filled with new source segments, then let them have dummy segments
        if (this.expectedSubtitleTracks.length && this.expectedSubtitleTracks.length > 0) {
          for (let i = 0; i < this.expectedSubtitleTracks.length; i++) {
            const track = this.expectedSubtitleTracks[i];
            const [numSegsAfterVT, hasVT] = inspectForVodTransition(this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][track.language]);
            // Case: Loading vod after 
            if (numSegsAfterVT === 0 && hasVT) {
              this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][track.language] = this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][track.language].concat(result.newSegments);
            }
            // Case: Loading vod first time
            if (this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][track.language].length === 0) {
              const emptySubtitleSegList = this.subtitleSegments[this.DUMMY_DEFAULT_SUBTITLE_GROUP_ID][this.DUMMY_DEFAULT_SUBTITLE_LANGUAGE];
              this.subtitleSegments[this.DEFAULT_SUBTITLE_GROUP_ID][track.language] = emptySubtitleSegList;
            }
          }
        }
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
              subtitleSegments: {},
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
        this.subtitleSequencesCount = subtitleSequences.length;
      }

      if (!this.mediaSequences) {
        reject("Failed to init media sequences");
      } else if (this.mediaSequences.length > 0 && this.skipSerializeMediaSequences && this.deltaTimes.length > 0 && this.mediaSequences.length === this.deltaTimes.length) {
        debug(`Discontinuities, MediaSequencesValues, Delta times & positions have already been calculated. Skipping this step!`);
        resolve()
      } else {
        // Calculate Delta Times and Position for Video
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
              // Sum the duration of EVERY segment newly added after the previous
              // sequence's last segment, not only the last one. A sequence may add
              // 2+ segments when a longer segment is popped from the front (e.g. pop
              // a 6s segment, add two 3s segments) and all of them must advance the
              // playhead. Mirrors the type-B tpi logic.
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
              if (mseq.segments[bwIdx]) {
                let lastSegment = findBottomSegItem(mseq.segments[bwIdx]);
                if (lastSegment && lastSegment.uri) {
                  prevLastSegment = lastSegment;
                }
                lastPositionIncrement = lastSegment.duration;
              }
            }
          }
        }
        // Audio Version
        if (this.mediaSequences[0].audioSegments) {
          this.calculateDeltaAndPositionExtraMedia("audio");
        }
        if (this.mediaSequences[0].subtitleSegments) {
          this.calculateDeltaAndPositionExtraMedia("subtitle");
        }
        resolve();
      }
    });
  },
};
module.exports = methods;
