const debug = require("debug")("hls-vodtolive");
const {
  findIndexReversed,
  findBottomSegItem,
  fixedNumber,
  inspectForVodTransition,
} = require("../utils.js");

import type { HLSVodInstance } from "./types";

// `reject` is referenced in `generateSequencesTypeAVideo`'s "should not happen"
// guard but was never in scope in the original JavaScript (that method is not a
// Promise executor). Declared ambient so the faithful 1:1 port type-checks;
// runtime behavior (a ReferenceError if that guard is ever hit) is unchanged.
declare const reject: (reason?: any) => void;

const methods: Record<string, (...args: any[]) => any> & ThisType<HLSVodInstance> = {
  generateSmallerSubtitleSegments(segment, offset, leftover, useDummyUrl, first, elapsedTime) {
    if (leftover === null) {
      leftover = {};
    }
    const bandwidths = Object.keys(this.segments);
    let segmentList = this.segments[bandwidths[0]];
    const subsGroupIdCount = Object.keys(this.subtitleSegments).length;

    if (useDummyUrl && subsGroupIdCount > 1) {
      let subTrax = [];
      for (let group of Object.keys(this.subtitleSegments)) {
        for (let lang of Object.keys(this.subtitleSegments[group])) {
          subTrax.push({ trackId: `${group}:::${lang}`, seglist: this.subtitleSegments[group][lang] });
        }
      }
      subTrax = subTrax.reverse();
      const findItemWithLargestSize = (list) => {
        return list.reduce((largestItem, currentItem) => {
          return currentItem.seglist.length > largestItem.seglist.length ? currentItem : largestItem;
        }).trackId;
      };
      const track = findItemWithLargestSize(subTrax);
      const [g , l] = track.split(":::");
      const subsegs =  this.subtitleSegments[g][l];
      const trackHasDummySpliceSegments = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const seg = arr[i];
          if (seg.uri) {
            const p = /starttime=.*endtime=.*elapsedtime=/;
            return p.test(seg.uri);
          };
        }
      }
      // Only generate smaller subtitle segments based on loaded subtitle segments, rather than video segments,
      // if loaded subtitle segments exist (and are not 'splice' segments)   
      if (subsegs.length > 0 && !trackHasDummySpliceSegments(subsegs)) {
        const [numSegsAfterVT, hasVT] = inspectForVodTransition(subsegs);
        if (numSegsAfterVT > 0 || !hasVT) {
          segmentList = this.subtitleSegments[g][l];
          let dur = 0;
          segmentList.map(s => {
            if (s.duration) {
              dur += s.duration;
            }
          });
         segment.duration = dur;
        }
      }

    }
    let newSegmentList = [];
    let totalSubtitleSegmentDuration = segment.duration;
    let index = offset;
    let allVideoDurationUsed = false;
    while (index < segmentList.length && totalSubtitleSegmentDuration > 0) {
      totalSubtitleSegmentDuration = Math.round(totalSubtitleSegmentDuration * 1000) / 1000;
      if (segmentList[index].discontinuity) {
        if (!segmentList[index].vodTransition) {
          newSegmentList.push(segmentList[index])
        }
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
      const endTime = startTime + Math.min(segmentList[index].duration, totalSubtitleSegmentDuration) - consumedVideoDuration;

      if (!useDummyUrl) {
        params.append("vtturi", segment.uri)
        if (leftover.previousSegmentUri) {
          params.append("previousvtturi", leftover.previousSegmentUri);
        }
        params.append("starttime", startTime as any)
        params.append("endtime", endTime as any)
        params.append("elapsedtime", elapsedTime)
      } else {
        params.append("p", index as any)
      }

      const base = useDummyUrl ? this.dummySubtitleEndpoint : this.subtitleSliceEndpoint;
      const newUri = base + "?" + params;
      let newSegment = { ...segment };
      newSegment.uri = newUri;

      if (leftover.duration) {
        newSegment.duration = leftover.duration + leftover.consumedVideoDuration;
        totalSubtitleSegmentDuration -= leftover.duration;
        if (leftover.duration + leftover.consumedVideoDuration === segmentList[index].duration) {
          allVideoDurationUsed = true;
        }
        leftover = {};
      }
      else if (segmentList[index].duration < totalSubtitleSegmentDuration) {
        newSegment.duration = segmentList[index].duration;
        totalSubtitleSegmentDuration -= segmentList[index].duration;
        allVideoDurationUsed = true;
      } else if (segmentList[index].duration === totalSubtitleSegmentDuration) {
        newSegment.duration = totalSubtitleSegmentDuration;
        totalSubtitleSegmentDuration = 0;
        allVideoDurationUsed = true;
      } else {
        leftover = {
          duration: segmentList[index].duration - totalSubtitleSegmentDuration,
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
  },

  generateSequencesTypeAVideo(bw) {
    let seqIndex = 0;
    let video_duration = 0;
    const length = this.segments[bw].length;
    let segOffset = 0;
    let segIdx = 0;
    let sequence = {};
    let video_sequence_list = [];
    while (this.segments[bw][segIdx] && segIdx != length) {
      if (this.segments[bw][segIdx].uri) {
        video_duration += this.segments[bw][segIdx].duration;
      }
      if (video_duration < this.SEQUENCE_DURATION) {
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
        //debug(`Pushing seq=${this.mediaSequences.length} firstSeg=${sequence[Object.keys(this.segments)[0]][0].uri}, length=${sequence[Object.keys(this.segments)[0]].length}, duration=${duration} < ${this.SEQUENCE_DURATION}`);
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
    if (video_duration < this.SEQUENCE_DURATION) {
      // We are out of segments but have not reached the full duration of a sequence
      video_duration = 0;
      video_sequence_list.push(sequence);
      this.mediaSequenceValues[seqIndex] = seqIndex;
      sequence = {};
    }

    return video_sequence_list;
  },
  
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
      if (duration < this.SEQUENCE_DURATION) {
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

    if (duration < this.SEQUENCE_DURATION) {
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
    return sequenceList;
  },

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
          while (loop && seqDur < this.SEQUENCE_DURATION && segIdxVideo < SIZE) {
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
                if (seqDur < this.SEQUENCE_DURATION) {
                  if (!seg) {
                    debug(segIdxVideo, `WARNING! The _sequence[bw=${_bw}] pushed seg=${seg}`);
                  }
                  _sequence[_bw].push(seg);
                }
              }
            });
            if (loop && seqDur < this.SEQUENCE_DURATION) {
              segIdxVideo++;
            }
          }
        } else {
          // Creating the rest of the sequences
          let newPushedSegmentsCount = 0;
          // 1 - Add new segments until we overflow (per variant)
          while (totalSeqDurVideo < this.SEQUENCE_DURATION && segIdxVideo < SIZE) {
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
          while (totalSeqDurVideo >= this.SEQUENCE_DURATION || (shiftOnce && segIdxVideo !== 0)) {
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
            if (segIdxVideo < SIZE && shiftedSegmentsCount === 1 && newPushedSegmentsCount > 1 && totalSeqDurVideo >= this.SEQUENCE_DURATION) {
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
        if (!this.mediaSequenceValues[seqIndex]) {
          this.mediaSequenceValues[seqIndex] = totalRemovedSegments;
        }
        if (!this.discontinuities[seqIndex]) {
          this.discontinuities[seqIndex] = totalRemovedDiscTags;
        }
        sequence = _sequence;
        seqIndex++;
      } catch (err) {
        console.error(err);
      }
    }
    return videoSequences;
  },

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
        if (_sequence[firstGroupId] && _sequence[firstGroupId][firstLanguage] && _sequence[firstGroupId][firstLanguage].length > 0) {
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
          while (loop && seqDur < this.SEQUENCE_DURATION && segIdx < SIZE) {
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
                  if (seqDur < this.SEQUENCE_DURATION) {
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
                      if (!(type === "subtitle" && seq_seg && seq_seg.cue && seq_seg.cue.in && !seq_seg.uri)) {
                        _sequence[groupId][lang].push(seq_seg);
                      }
                    }
                  }
                }
              });
            });
            if (loop && seqDur < this.SEQUENCE_DURATION) {
              segIdx++;
            }
          }
        } else {
          // Creating the rest of the sequences
          let newPushedSegmentsCount = 0;
          // 1 - Add new segments until we overflow (per variant)
          while (totalSeqDur < this.SEQUENCE_DURATION && segIdx < SIZE) {
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
                  if (totalSeqDur >= this.SEQUENCE_DURATION && segIdx + 1 == SIZE) {
                    // Special Case where we have a cuein and no uri in the last segment.
                    // We want to include it.
                    const seq_seg = segments[groupId][lang][segIdx+1];
                    if (seq_seg) {
                      _sequence[groupId][lang].push(seq_seg);
                    }
                  }
                }
              });
            });
            segIdx++;
          }
          let shiftOnce = true;
          let shiftedSegmentsCount = 0;
          // 2 - Shift excess segments and keep count of what has been removed (per variant)
          while (totalSeqDur >= this.SEQUENCE_DURATION || (shiftOnce && segIdx !== 0)) { 
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
              totalSeqDur = fixedNumber(totalSeqDur);
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
            if (segIdx < SIZE && shiftedSegmentsCount === 1 && newPushedSegmentsCount > 1 && totalSeqDur >= this.SEQUENCE_DURATION) {
              // pop audio...
              if (firstGroupId) {
                const groupIds = Object.keys(segments);
                groupIds.forEach((groupId) => {
                  const langs = Object.keys(segments[groupId]);
                  langs.forEach((lang) => {
                    let seg = _sequence[groupId][lang].pop();
                    if (groupId === firstGroupId && lang === firstLanguage) {
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
          if (!this.discontinuitiesAudio[seqIndex]) {
            this.discontinuitiesAudio[seqIndex] = totalRemovedDiscTags;
          }
          if (!this.mediaSequenceValuesAudio[seqIndex]) {
            this.mediaSequenceValuesAudio[seqIndex] = totalRemovedSegments;
          }
        } else if (type === "subtitle") {
          if (!this.discontinuitiesSubtitle[seqIndex]) {
            this.discontinuitiesSubtitle[seqIndex] = totalRemovedDiscTags;
          }
          if (!this.mediaSequenceValuesSubtitle[seqIndex]) {
            this.mediaSequenceValuesSubtitle[seqIndex] = totalRemovedSegments;
          }
        }
        sequence = _sequence;
        seqIndex++;
      } catch (err) {
        console.error(err);
      }
    }
    return sequences;
  },

  generateMediaSequences() {
    this.mediaSequences = [];
    return new Promise<void>((resolve, reject) => {
      this._createMediaSequences(1).then(resolve).catch(reject);
    });
  },

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
        type === "audio" ? (this.discontinuitiesAudio[seqNo] += discSeqNo) : (this.discontinuitiesSubtitle[seqNo] += discSeqNo);
        discSeqNo = 0;
      } else {
        type === "audio" ? (this.discontinuitiesAudio[seqNo] = discSeqNo) : (this.discontinuitiesSubtitle[seqNo] = discSeqNo);
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
              position: positionIncrement ? fixedNumber(lastPosition + tpi) : lastPosition,
            });
          } else if (type === "subtitle") {
            this.deltaTimesSubtitle.push({
              interval: interval,
              position: positionIncrement ? fixedNumber(lastPosition + tpi) : lastPosition,
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
          // Sum the duration of EVERY segment newly added after the previous
          // sequence's last segment, not only the last one (see video branch /
          // type-B tpi logic). A sequence may add 2+ segments at once.
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
              position: positionIncrement ? fixedNumber(lastPosition + tpi) : lastPosition,
            });
          } else if (type === "subtitle") {
            this.deltaTimesSubtitle.push({
              interval: interval,
              position: positionIncrement ? fixedNumber(lastPosition + tpi) : lastPosition,
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
      }
    }
  },
};
module.exports = methods;
