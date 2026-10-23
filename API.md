## Classes

<dl>
<dt><a href="#HLSVod">HLSVod</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#UnknownSegmentData">UnknownSegmentData</a> : <code>Object</code></dt>
<dd><p>Per-segment pass-through bag for HLS data the library does not natively
  interpret. Every segment object (video, audio and subtitle) carries these two fields so
  the shape is stable whether or not anything was captured.</p>
</dd>
<dt><a href="#UnknownMasterEntry">UnknownMasterEntry</a> : <code>Object</code></dt>
<dd><p>Pass-through bag for a single master-playlist entry (a <code>#EXT-X-STREAM-INF</code>
  stream or a <code>#EXT-X-MEDIA</code> rendition).</p>
</dd>
<dt><a href="#UnknownMasterData">UnknownMasterData</a> : <code>Object</code></dt>
<dd><p>Master-playlist-level pass-through container held on the VOD instance and
  serialized with it.</p>
</dd>
</dl>

<a name="HLSVod"></a>

## HLSVod
**Kind**: global class  

* [HLSVod](#HLSVod)
    * [new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset, header, opts)](#new_HLSVod_new)
    * _instance_
        * [.defaultAudioGroupAndLang](#HLSVod+defaultAudioGroupAndLang)
        * [.load()](#HLSVod+load)
        * [.loadAfter(previousVod, _injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest)](#HLSVod+loadAfter)
        * [.reload(mediaSeqNo, additionalSegments, additionalAudioSegments, insertAfter)](#HLSVod+reload) ⇒
        * [.addMetadata(key, value)](#HLSVod+addMetadata)
        * [.getVodUri()](#HLSVod+getVodUri)
        * [.getLiveMediaSequenceSegments(seqIdx)](#HLSVod+getLiveMediaSequenceSegments)
        * [.getLiveAudioSequenceSegments(seqIdx)](#HLSVod+getLiveAudioSequenceSegments)
        * [.getMediaSegments()](#HLSVod+getMediaSegments)
        * [.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx)](#HLSVod+getLiveMediaSequenceAudioSegments)
        * [.getLiveMediaSequenceSubtitleSegments(subtitleGroupId, subtitleLanguage, seqIdx)](#HLSVod+getLiveMediaSequenceSubtitleSegments)
        * [.getBandwidths()](#HLSVod+getBandwidths)
        * [.getLiveMediaSequencesCount()](#HLSVod+getLiveMediaSequencesCount)
        * [.getLastSequenceMediaSequenceValue()](#HLSVod+getLastSequenceMediaSequenceValue)
        * [.getLastSequenceMediaSequenceValueAudio()](#HLSVod+getLastSequenceMediaSequenceValueAudio)
        * [.getLastSequenceMediaSequenceValueSubtitle()](#HLSVod+getLastSequenceMediaSequenceValueSubtitle)
        * [.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset, padding, forceTargetDuration)](#HLSVod+getLiveMediaSequences)
        * [.getLiveMediaAudioSequences()](#HLSVod+getLiveMediaAudioSequences)
        * [.getLiveMediaSubtitleSequences()](#HLSVod+getLiveMediaSubtitleSequences)
        * [.getUsageProfiles()](#HLSVod+getUsageProfiles)
        * [.getUnknownMasterData()](#HLSVod+getUnknownMasterData) ⇒ [<code>UnknownMasterData</code>](#UnknownMasterData)
        * [.getLastDiscontinuity()](#HLSVod+getLastDiscontinuity)
        * [.getLastDiscontinuityAudio()](#HLSVod+getLastDiscontinuityAudio)
        * [.getDeltaTimes()](#HLSVod+getDeltaTimes)
        * [.getPlayheadPositions()](#HLSVod+getPlayheadPositions)
        * [.releasePreviousVod()](#HLSVod+releasePreviousVod)
        * [.getDuration()](#HLSVod+getDuration)
        * [.getNextVodDuration()](#HLSVod+getNextVodDuration)
        * [.getLastUsedDiscSeq()](#HLSVod+getLastUsedDiscSeq)
        * [._copyAudioGroupsFromPrevious()](#HLSVod+_copyAudioGroupsFromPrevious)
        * [._copySubtitleGroupsFromPrevious()](#HLSVod+_copySubtitleGroupsFromPrevious)
        * [._persistMissingAudioLanguages()](#HLSVod+_persistMissingAudioLanguages)
        * [._persistMissingAudioCodecs()](#HLSVod+_persistMissingAudioCodecs)
    * _static_
        * [.emptyUnknownMasterData()](#HLSVod.emptyUnknownMasterData) ⇒ [<code>UnknownMasterData</code>](#UnknownMasterData)

<a name="new_HLSVod_new"></a>

### new HLSVod(vodManifestUri, splices, timeOffset, startTimeOffset, header, opts)
Create an HLS VOD instance


| Param | Type | Description |
| --- | --- | --- |
| vodManifestUri | <code>string</code> | the uri to the master manifest of the VOD |
| splices | <code>Object</code> | an array of ad splice objects |
| timeOffset | <code>number</code> | time offset as unix timestamp ms |
| startTimeOffset | <code>number</code> | start time offset in N ms from start |
| header | <code>string</code> | prepend the m3u8 playlist with this text |
| opts | <code>Object</code> | other options |
| opts.expectedAudioLanguages | <code>Array</code> | explicit list of audio language codes that must always   be present in the generated live output, regardless of what any individual VOD contains. When a   loaded VOD is missing one of these languages, the default (first available) language's audio   segments are injected for it. When omitted, the set of audio languages is determined by the first   VOD loaded and is then persisted across all following VODs (it is never shrunk when a later VOD   exposes fewer languages). |
| opts.expectedAudioCodecs | <code>Array</code> | explicit list of audio codecs (e.g. ["mp4a.40.2", "ec-3"])   that the generated live output must contain exactly. Audio groups whose codec is not in this list   are dropped, and when a loaded VOD is missing one of the listed codecs the default (first available)   codec's audio segments are reused for that codec's track so it keeps playing. When omitted, the set   of audio codecs is determined by the first VOD loaded and is then persisted across all following   VODs (it is never shrunk when a later VOD exposes fewer codecs). |

<a name="HLSVod+defaultAudioGroupAndLang"></a>

### hlsVod.defaultAudioGroupAndLang
TODO: Handle case where prevVod and nextVod have many groups and languages, but none of them match.
Currently, it only sets a default if there is only one possible group and lang to match with on
the prevVod.

**Kind**: instance property of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+load"></a>

### hlsVod.load()
Load and parse the HLS VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+loadAfter"></a>

### hlsVod.loadAfter(previousVod, _injectMasterManifest, _injectMediaManifest, _injectAudioManifest, _injectSubtitleManifest)
Load and parse the HLS VOD where the first media sequences
contains the end sequences of the previous VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| previousVod | [<code>HLSVod</code>](#HLSVod) | the previous VOD to concatenate to |
| _injectMasterManifest | <code>function</code> | optional master manifest injection function |
| _injectMediaManifest | <code>function</code> | optional media manifest injection function |
| _injectAudioManifest | <code>function</code> | optional audio manifest injection function |
| _injectSubtitleManifest | <code>function</code> | optional subtitle manifest injection function |

<a name="HLSVod+reload"></a>

### hlsVod.reload(mediaSeqNo, additionalSegments, additionalAudioSegments, insertAfter) ⇒
Removes all segments that come before or after a specified media sequence.
Then adds the new additional segments in front or behind.
It finally creates new media sequences with the updated collection of segments.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
**Returns**: A promise that new Media Sequences have been made  

| Param | Type | Description |
| --- | --- | --- |
| mediaSeqNo | <code>number</code> | The media Sequence index that is the live index. |
| additionalSegments | <code>object</code> | New group of segments to merge with a possible subset of this.segments |
| additionalAudioSegments | <code>object</code> | New group of audio segments to merge with a possible subset of this.segments |
| insertAfter | <code>boolean</code> | Whether the additional segments are to be added in front of the live index or behind |

<a name="HLSVod+addMetadata"></a>

### hlsVod.addMetadata(key, value)
Add metadata timed for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>key</code> | EXT-X-DATERANGE attribute key |
| value | <code>\*</code> |  |

<a name="HLSVod+getVodUri"></a>

### hlsVod.getVodUri()
Retrieve master manifest Uri for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequenceSegments"></a>

### hlsVod.getLiveMediaSequenceSegments(seqIdx)
Get all segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getLiveAudioSequenceSegments"></a>

### hlsVod.getLiveAudioSequenceSegments(seqIdx)
Get all audio segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getMediaSegments"></a>

### hlsVod.getMediaSegments()
Get all segments (duration, uri)

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequenceAudioSegments"></a>

### hlsVod.getLiveMediaSequenceAudioSegments(audioGroupId, audioLanguage, seqIdx)
Get all audio segments (duration, uri) for a specific media sequence based on audio group and lang

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| audioGroupId | <code>string</code> | audio group Id |
| audioLanguage | <code>string</code> | audio language |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getLiveMediaSequenceSubtitleSegments"></a>

### hlsVod.getLiveMediaSequenceSubtitleSegments(subtitleGroupId, subtitleLanguage, seqIdx)
Get all subtitle segments (duration, uri) for a specific media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| subtitleGroupId | <code>string</code> | subtitle group Id |
| subtitleLanguage | <code>string</code> | subtitle language |
| seqIdx | <code>number</code> | media sequence index (first is 0) |

<a name="HLSVod+getBandwidths"></a>

### hlsVod.getBandwidths()
Get the available bandwidths for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequencesCount"></a>

### hlsVod.getLiveMediaSequencesCount()
Get the number of media sequences for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastSequenceMediaSequenceValue"></a>

### hlsVod.getLastSequenceMediaSequenceValue()
Get the media-sequence value for the last media sequence of this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastSequenceMediaSequenceValueAudio"></a>

### hlsVod.getLastSequenceMediaSequenceValueAudio()
Get the media-sequence value for the last audio media sequence of this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastSequenceMediaSequenceValueSubtitle"></a>

### hlsVod.getLastSequenceMediaSequenceValueSubtitle()
Get the media-sequence value for the last subtitle media sequence of this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSequences"></a>

### hlsVod.getLiveMediaSequences(offset, bandwidth, seqIdx, discOffset, padding, forceTargetDuration)
Get the HLS live media sequence for a specific media sequence and bandwidth

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>number</code> | add this offset to all media sequences in the EXT-X-MEDIA-SEQUENCE tag |
| bandwidth | <code>string</code> |  |
| seqIdx | <code>number</code> |  |
| discOffset | <code>number</code> | add this offset to all discontinuity sequences in the EXT-X-DISCONTINUITY-SEQUENCE tag |
| padding | <code>number</code> | add extra seconds on the EXT-X-TARGETDURATION |
| forceTargetDuration | <code>number</code> | enforce a fixed EXT-X-TARGETDURATION |

<a name="HLSVod+getLiveMediaAudioSequences"></a>

### hlsVod.getLiveMediaAudioSequences()
Gets a hls/makes m3u8-file with all of the correct audio segments
belonging to a given groupID & language for a particular sequence.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLiveMediaSubtitleSequences"></a>

### hlsVod.getLiveMediaSubtitleSequences()
Gets a hls/makes m3u8-file with all of the correct subtitle segments
belonging to a given groupID & language for a particular sequence.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getUsageProfiles"></a>

### hlsVod.getUsageProfiles()
Get the usage profile for this VOD

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getUnknownMasterData"></a>

### hlsVod.getUnknownMasterData() ⇒ [<code>UnknownMasterData</code>](#UnknownMasterData)
Get the master-level pass-through container: EXT-X-STREAM-INF / EXT-X-MEDIA attributes the
library does not natively interpret, preserved verbatim at parse time so a consumer (e.g.
channel-engine) can re-emit them. See the UnknownMasterData typedef for the exact shape.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
**Returns**: [<code>UnknownMasterData</code>](#UnknownMasterData) - the captured master-level unknown tags/attributes  
<a name="HLSVod+getLastDiscontinuity"></a>

### hlsVod.getLastDiscontinuity()
Get the last discontinuity sequence number

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastDiscontinuityAudio"></a>

### hlsVod.getLastDiscontinuityAudio()
Get the last audio discontinuity sequence number

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getDeltaTimes"></a>

### hlsVod.getDeltaTimes()
Get the delta times for each media sequence.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getPlayheadPositions"></a>

### hlsVod.getPlayheadPositions()
Returns the playhead position for each media sequence

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+releasePreviousVod"></a>

### hlsVod.releasePreviousVod()
Remove pointers to previous VOD and release to garbage collector

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getDuration"></a>

### hlsVod.getDuration()
Returns the current duration calculated from the sum of the duration of all segments

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getNextVodDuration"></a>

### hlsVod.getNextVodDuration()
Returns the current duration calculated from the sum of the duration of all segments
belonging to the next VOD, excludeing the copied segments from previous VOD, if any.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+getLastUsedDiscSeq"></a>

### hlsVod.getLastUsedDiscSeq()
Returns the last added Discontinuity sequence count from getLiveMediaSequences()

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_copyAudioGroupsFromPrevious"></a>

### hlsVod.\_copyAudioGroupsFromPrevious()
Gets previous VOD's audio -groupIds, -langs, -segments from its last sequence
and adds them to the current VOD's this.audioSegments property.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_copySubtitleGroupsFromPrevious"></a>

### hlsVod.\_copySubtitleGroupsFromPrevious()
Gets previous VOD's subtitle -groupIds, -langs, -segments from its last sequence
and adds them to the current VOD's this.subtitleSegments property.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_persistMissingAudioLanguages"></a>

### hlsVod.\_persistMissingAudioLanguages()
Ensures every persisted/expected audio language is present after all audio manifests
have loaded. For any expected language that the currently loaded VOD does not actually
provide, the default (first available) language's segments are copied in so the language
keeps playing instead of being dropped. The explicit `opts.expectedAudioLanguages` list
and the languages carried over from previous VODs both feed into this persisted set.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod+_persistMissingAudioCodecs"></a>

### hlsVod.\_persistMissingAudioCodecs()
Ensures every persisted/expected audio codec is present after all audio manifests have loaded.
Audio codecs map to distinct audio groups, so persistence is handled at the group level here:
for any audio group that the currently loaded VOD does not actually provide (i.e. a group that
only exists because it was carried over from a previous VOD, belonging to a codec this VOD is
missing), the segments of a default group that the current VOD DID provide are reused so the
codec keeps playing instead of starving the whole audio track. When `opts.expectedAudioCodecs`
is configured, the live output is additionally restricted to exactly those codecs: any audio
group whose codec is not in the list (and its codec -> group mapping) is dropped.

**Kind**: instance method of [<code>HLSVod</code>](#HLSVod)  
<a name="HLSVod.emptyUnknownMasterData"></a>

### HLSVod.emptyUnknownMasterData() ⇒ [<code>UnknownMasterData</code>](#UnknownMasterData)
The default, empty pass-through container for master-level data. Used to initialise the
field and to backfill it when deserializing a blob produced before the model existed.

**Kind**: static method of [<code>HLSVod</code>](#HLSVod)  
**Returns**: [<code>UnknownMasterData</code>](#UnknownMasterData) - an empty master-level pass-through container  
<a name="UnknownSegmentData"></a>

## UnknownSegmentData : <code>Object</code>
Per-segment pass-through bag for HLS data the library does not natively
  interpret. Every segment object (video, audio and subtitle) carries these two fields so
  the shape is stable whether or not anything was captured.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| unknownTags | <code>Array.&lt;string&gt;</code> | Ordered list of complete, raw tag lines (e.g.   `"#EXT-X-CUSTOM-MARKER:foo=bar"`) that appeared immediately before this segment's URI in   the media playlist and that the library does not natively interpret. Source order is   preserved; on re-emission (#148) they are written verbatim, in array order, immediately   before the segment's own recognized tags/URI. |
| unknownAttributes | <code>Object.&lt;string, string&gt;</code> | Map of attribute-name to its raw,   uninterpreted string value for attributes that live on a tag the library DOES recognize   structurally but whose specific attribute it does not read (e.g. a vendor attribute on   `#EXTINF` or `#EXT-X-KEY`). Values are stored verbatim and never parsed. |

<a name="UnknownMasterEntry"></a>

## UnknownMasterEntry : <code>Object</code>
Pass-through bag for a single master-playlist entry (a `#EXT-X-STREAM-INF`
  stream or a `#EXT-X-MEDIA` rendition).

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| unknownAttributes | <code>Object.&lt;string, string&gt;</code> | Map of attribute-name to its raw,   uninterpreted string value for attributes on that entry the library does not read. |

<a name="UnknownMasterData"></a>

## UnknownMasterData : <code>Object</code>
Master-playlist-level pass-through container held on the VOD instance and
  serialized with it.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| tags | <code>Array.&lt;string&gt;</code> | Raw, uninterpreted master-level tag lines, in source order. |
| streams | <code>Object.&lt;string, UnknownMasterEntry&gt;</code> | Stream entries keyed by bandwidth   (string), each mirroring a `#EXT-X-STREAM-INF`. |
| media | <code>Object.&lt;string, UnknownMasterEntry&gt;</code> | Media/rendition entries keyed by   `${type}-${groupId}-${language}`, each mirroring a `#EXT-X-MEDIA`. |

