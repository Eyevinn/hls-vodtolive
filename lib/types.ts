// Public type definitions for the hls-vodtolive library.
//
// These describe the PUBLIC surface of the `HLSVod` class: the constructor
// options, the segment/sequence shapes returned by the getter methods, and the
// JSON serialization shape produced by `toJSON()`/consumed by `fromJSON()`.
//
// `HLSVodInstance` is the structural interface of an `HLSVod` instance. It is
// merged onto the `HLSVod` class (via `interface HLSVod extends HLSVodInstance {}`)
// so that methods composed onto the prototype at runtime via `Object.assign`
// (from `lib/sequence-generation`, `lib/manifest-loading`, `lib/bandwidth-helpers`
// and `lib/serialization`) are visible on the class type, and so that each of
// those mixin modules can type `this` as a full `HLSVod` instance.
//
// Internal members were untyped in the original JavaScript; they are kept loose
// (`any` / permissive signatures) here. The public members listed in the issue
// (constructor options, serialization shape, segment/sequence return types) are
// given real types.

/** A DRM key descriptor as carried on a segment (see `keysToM3u8`). */
export interface SegmentKey {
  method?: string;
  uri?: string;
  iv?: string;
  keyId?: string;
  keyFormatVersions?: string;
  keyFormat?: string;
}

/** Ad-marker / cue metadata carried on a segment. */
export interface SegmentCue {
  out?: boolean;
  cont?: number | null;
  in?: boolean;
  duration?: number;
  scteData?: string | null;
  assetData?: string | null;
}

/**
 * Per-segment pass-through bag for HLS data the library does not natively
 * interpret. Every segment object carries these two fields so the shape is
 * stable whether or not anything was captured.
 */
export interface UnknownSegmentData {
  /** Ordered raw tag lines that appeared immediately before this segment's URI. */
  unknownTags: string[];
  /** Attribute-name -> raw (uninterpreted) string value. */
  unknownAttributes: { [name: string]: string };
}

/**
 * A single media segment (video, audio or subtitle). All fields are optional
 * because discontinuity markers, init-segment markers and real media segments
 * all share this shape.
 */
export interface Segment {
  duration?: number;
  uri?: string;
  timelinePosition?: number | null;
  discontinuity?: boolean;
  daterange?: { [attr: string]: any } | null;
  cue?: SegmentCue | null;
  byteRange?: string;
  initSegment?: string;
  initSegmentByteRange?: string;
  keys?: { [format: string]: SegmentKey };
  vodTransition?: boolean;
  unknownData?: UnknownSegmentData;
  [key: string]: any;
}

/** A single live media sequence: one window of video/audio/subtitle segments. */
export interface MediaSequence {
  segments: { [bandwidth: string]: Segment[] };
  audioSegments: { [groupId: string]: { [language: string]: Segment[] } };
  subtitleSegments: { [groupId: string]: { [language: string]: Segment[] } };
}

/** An ad-splice descriptor passed to the constructor. */
export interface HLSVodSplice {
  position: number;
  segments: { [bandwidth: string]: any[] };
  [key: string]: any;
}

/** An expected subtitle track descriptor. */
export interface SubtitleTrack {
  language: string;
  name?: string;
  [key: string]: any;
}

/** Pass-through bag for a single master-playlist entry (stream or rendition). */
export interface UnknownMasterEntry {
  unknownAttributes: { [name: string]: string };
}

/** Master-playlist-level pass-through container held on the VOD instance. */
export interface UnknownMasterData {
  tags: string[];
  streams: { [bandwidth: string]: UnknownMasterEntry };
  media: { [key: string]: UnknownMasterEntry };
}

/** Options accepted by the `HLSVod` constructor (`opts` argument). */
export interface HLSVodOptions {
  /** Audio language codes that must always be present in the generated output. */
  expectedAudioLanguages?: string[];
  /** Audio codecs the generated output must contain exactly. */
  expectedAudioCodecs?: string[];
  /** Each sequence must include at least one new segment. */
  sequenceAlwaysContainNewSegments?: boolean;
  /** Force demuxed (separate audio) mode. */
  forcedDemuxMode?: boolean;
  /** Endpoint used for generated dummy subtitle segments. */
  dummySubtitleEndpoint?: string;
  /** Endpoint used to slice subtitle segments. */
  subtitleSliceEndpoint?: string;
  /** Whether the generated output should contain subtitles. */
  shouldContainSubtitles?: boolean;
  /** Explicit list of subtitle tracks the output must contain. */
  expectedSubtitleTracks?: SubtitleTrack[];
  /** Always map bandwidths to the nearest available instead of 1:1. */
  alwaysMapBandwidthByNearest?: boolean;
  /** Skip serializing media sequences in `toJSON()`. */
  skipSerializeMediaSequences?: boolean;
  /** Emit EXT-X-PROGRAM-DATE-TIME based on wallclock. */
  calculatePDT?: boolean;
  [key: string]: any;
}

/** The object shape serialized by `toJSON()` (returned JSON-stringified). */
export interface HLSVodSerialized {
  masterManifestUri: string;
  segments: { [bandwidth: string]: Segment[] };
  audioSegments: { [groupId: string]: { [language: string]: Segment[] } };
  subtitleSegments: { [groupId: string]: { [language: string]: Segment[] } };
  shouldContainSubtitles?: boolean;
  expectedSubtitleTracks?: SubtitleTrack[];
  expectedAudioLanguages?: string[];
  expectedAudioCodecs?: string[];
  mediaSequences: MediaSequence[] | null;
  SEQUENCE_DURATION: number | string;
  targetDuration: { [bandwidth: string]: number };
  targetAudioDuration: { [groupId: string]: number };
  targetSubtitleDuration: { [groupId: string]: number };
  previousVod: string | null;
  usageProfile: any[];
  segmentsInitiated: { [bandwidth: string]: boolean };
  splices: HLSVodSplice[];
  timeOffset: number | null;
  startTimeOffset: number | null;
  usageProfileMapping: { [bandwidth: string]: string } | null;
  usageProfileMappingRev: { [bandwidth: string]: number } | null;
  discontinuities: { [seqNo: number]: number };
  discontinuitiesAudio: { [seqNo: number]: number };
  discontinuitiesSubtitle: { [seqNo: number]: number };
  deltaTimes: any[];
  deltaTimesAudio: any[];
  deltaTimesSubtitle: any[];
  header?: string;
  lastUsedDiscSeq: number | null;
  mediaSequenceValues: { [seqNo: number]: number };
  mediaSequenceValuesAudio: { [seqNo: number]: number };
  mediaSequenceValuesSubtitle: { [seqNo: number]: number };
  sequenceAlwaysContainNewSegments: boolean;
  forcedDemuxMode?: boolean;
  dummySubtitleEndpoint?: string;
  subtitleSliceEndpoint?: string;
  videoSequencesCount: number;
  audioSequencesCount: number;
  subtitleSequencesCount: number;
  mediaStartExcessTime: number;
  audioCodecsMap: { [codec: string]: { [channels: string]: string } };
  alwaysMapBandwidthByNearest?: boolean;
  skipSerializeMediaSequences: boolean;
  cuedHlsInterstitialTag: any;
  calculatePDT?: boolean;
  unknownMasterData: UnknownMasterData;
}

/** Media kind selector used by several getter methods. */
export type MediaType = "video" | "audio" | "subtitle";

/**
 * Structural interface of an `HLSVod` instance. Merged onto the class and used
 * as the `this` type inside the prototype-mixin modules. Public members are
 * typed accurately; internal members are permissive, mirroring the original JS.
 */
export interface HLSVodInstance {
  // ---- Public / semi-public instance state ----
  masterManifestUri: string;
  segments: { [bandwidth: string]: Segment[] };
  audioSegments: { [groupId: string]: { [language: string]: Segment[] } };
  subtitleSegments: { [groupId: string]: { [language: string]: Segment[] } };
  mediaSequences: MediaSequence[];
  splices: HLSVodSplice[];
  timeOffset: number | null;
  startTimeOffset: number | null;
  header: string | undefined;
  SEQUENCE_DURATION: number | string;
  unknownMasterData: UnknownMasterData;
  expectedAudioLanguages?: string[];
  expectedAudioCodecs?: string[];
  expectedSubtitleTracks: SubtitleTrack[];
  shouldContainSubtitles?: boolean;
  previousVod: HLSVodInstance | null;

  // ---- Internal instance state (was untyped) ----
  DEFAULT_SUBTITLE_GROUP_ID: string;
  DUMMY_DEFAULT_SUBTITLE_GROUP_ID: string;
  DUMMY_DEFAULT_SUBTITLE_LANGUAGE: string;
  _audioGroupsInCurrentVod: any;
  _audioLanguagesInCurrentVod: any;
  _removedSubtitleDuration: number;
  _removedVideoDuration: number;
  alwaysMapBandwidthByNearest?: boolean;
  audioCodecsMap: any;
  audioSequences: any;
  audioSequencesCount: number;
  calculatePDT?: boolean;
  cuedHlsInterstitialTag: any;
  defaultAudioGroupAndLang: any;
  deltaTimes: any[];
  deltaTimesAudio: any[];
  deltaTimesSubtitle: any[];
  discontinuities: any;
  discontinuitiesAudio: any;
  discontinuitiesSubtitle: any;
  dummySubtitleEndpoint?: string;
  forcedDemuxMode?: boolean;
  lastUsedDiscSeq: number | null;
  matchedBandwidths: any;
  mediaSequenceValues: any;
  mediaSequenceValuesAudio: any;
  mediaSequenceValuesSubtitle: any;
  mediaStartExcessTime: number;
  rangeMetadata: any;
  segmentsInitiated: any;
  sequenceAlwaysContainNewSegments: boolean;
  skipSerializeMediaSequences: boolean;
  subtitleSequencesCount: number;
  subtitleSliceEndpoint?: string;
  targetAudioDuration: any;
  targetDuration: any;
  targetSubtitleDuration: any;
  usageProfile: any[];
  usageProfileMapping: any;
  usageProfileMappingRev: any;
  videoSequencesCount: number;

  // ---- Public API (real signatures; physical defs in index.ts win in d.ts) ----
  load(...args: any[]): Promise<any>;
  loadAfter(...args: any[]): Promise<any>;
  reload(...args: any[]): Promise<any>;
  addMetadata(key: string, value: any): void;
  getVodUri(): string;
  getLiveMediaSequenceSegments(seqIdx: number): { [bandwidth: string]: Segment[] };
  getLiveAudioSequenceSegments(seqIdx: number): { [groupId: string]: { [language: string]: Segment[] } };
  getMediaSegments(): { [bandwidth: string]: Segment[] };
  getAudioSegments(): { [groupId: string]: { [language: string]: Segment[] } };
  getLiveMediaSequenceAudioSegments(audioGroupId: string, audioLanguage: string, seqIdx: number): Segment[];
  getLiveMediaSequenceSubtitleSegments(subtitleGroupId: string, subtitleLanguage: string, seqIdx: number): Segment[];
  getBandwidths(): string[];
  getAudioGroups(): string[];
  getAudioLangsForAudioGroup(groupId: string): string[];
  getAudioGroupIdForCodecs(audioCodecs: string, channels: string): string | undefined;
  getAudioCodecsAndChannelsForGroupId(groupId: string): [string | undefined, string | undefined];
  getSubtitleGroups(all?: boolean): string[];
  getSubtitleLangsForSubtitleGroup(groupId: string): string[];
  getLiveMediaSequencesCount(media?: MediaType): number;
  getLastSequenceMediaSequenceValue(): number;
  getLastSequenceMediaSequenceValueAudio(): number;
  getLastSequenceMediaSequenceValueSubtitle(): number;
  getLiveMediaSequences(
    offset: number,
    bandwidth: string,
    seqIdx: number,
    discOffset?: number,
    padding?: number,
    forceTargetDuration?: number
  ): string;
  getLiveMediaAudioSequences(
    offset: number,
    audioGroupId: string,
    audioLanguage: string,
    seqIdx: number,
    discOffset?: number,
    padding?: number,
    forceTargetDuration?: number
  ): string | null;
  getLiveMediaSubtitleSequences(
    offset: number,
    subtitleGroupId: string,
    subtitleLanguage: string,
    seqIdx: number,
    discOffset?: number,
    padding?: number,
    forceTargetDuration?: number
  ): string;
  getUsageProfiles(): any[];
  getUnknownMasterData(): UnknownMasterData;
  getLastDiscontinuity(): number;
  getLastDiscontinuityAudio(): number;
  getLastDiscontinuitySubtitle(): number;
  getDeltaTimes(media?: MediaType): number[];
  getPlayheadPositions(media?: MediaType): number[];
  releasePreviousVod(): void;
  getDuration(): number | null;
  getNextVodDuration(): number | null;
  getLastUsedDiscSeq(): number | null;

  // ---- Serialization (defined in lib/serialization; typed here) ----
  toJSON(): string;
  fromJSON(serialized: string): any;

  // ---- Internal methods (were untyped) ----
  _createMediaSequences(mode?: boolean): Promise<void>;
  generateSmallerSubtitleSegments(...args: any[]): any;
  generateSequencesTypeAVideo(...args: any[]): any;
  generateSequencesTypeAExtraMedia(...args: any[]): any;
  generateSequencesTypeBVideo(...args: any[]): any;
  generateSequencesTypeBExtraMedia(...args: any[]): any;
  generateMediaSequences(...args: any[]): any;
  calculateDeltaAndPositionExtraMedia(...args: any[]): any;
  _loadMediaManifest(...args: any[]): any;
  _similarSegItemDuration(...args: any[]): any;
  _loadAudioManifest(...args: any[]): any;
  _loadSubtitleManifest(...args: any[]): any;
  _getNearestBandwidthInList(...args: any[]): any;
  _getTrueNearestBandwidth(...args: any[]): any;
  _getNearestBandwidthWithInitiatedSegments(...args: any[]): any;
  _getNearestBandwidthForSplice(...args: any[]): any;
  _loadPrevious(...args: any[]): any;
  _hasMediaSequences(...args: any[]): any;
  _copyFromPrevious(...args: any[]): any;
  _copyAudioGroupsFromPrevious(...args: any[]): any;
  _copySubtitleGroupsFromPrevious(...args: any[]): any;
  _persistMissingAudioLanguages(...args: any[]): any;
  _persistMissingAudioCodecs(...args: any[]): any;
  _cleanupUnused(...args: any[]): any;
  _removeDoubleDiscontinuitiesFromExtraMedia(...args: any[]): any;
  _cleanupOnFailure(...args: any[]): any;
  _getFirstBwWithSegments(...args: any[]): any;
  _getFirstAudioGroupWithSegments(...args: any[]): any;
  _getFirstAudioLanguageWithSegments(...args: any[]): any;
  _getFirstSubtitleGroupWithSegments(...args: any[]): any;
  _getFirstSubtitleLanguageWithSegments(...args: any[]): any;
  _determineTargetDuration(...args: any[]): any;
  _inspect(...args: any[]): any;
  _isEmpty(...args: any[]): any;
  _getAudioSegmentsLength(...args: any[]): any;
  _getSubtitleSegmentsLength(...args: any[]): any;
  _getLastTimelinePositionVideo(...args: any[]): any;
  _getLastTimelinePositionAudio(...args: any[]): any;
  _captureUnknownMasterData(m3u: any): void;
}
